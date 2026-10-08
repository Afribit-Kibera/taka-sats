// SPDX-License-Identifier: AGPL-3.0-only
import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import {
  authenticationOptions,
  registrationOptions,
  verifyAuthentication,
  verifyRegistration,
  passkeyCookie,
  passkeyOrigin,
  readPasskeyCookie,
  requirePasskeyOrigin,
  spendOptionsBudget,
  PasskeyError,
  type FreshStaff,
} from '@/lib/auth/passkeys';
import { getSettings } from '@/lib/config';
import { getDb } from '@/lib/db/client';
import { staffPasskeys, supervisors } from '@/lib/db/schema';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'no-store' };
const bodySchema = z
  .object({
    action: z.enum(['register-options', 'register-verify', 'login-options', 'login-verify']),
    response: z.unknown().optional(),
  })
  .strict();

async function signedInStaff(request: Request): Promise<FreshStaff> {
  if (request.headers.has('authorization')) throw new PasskeyError('invalid_passkey', 401);
  const session = await auth();
  if (!session?.user || session.user.role === 'partner')
    throw new PasskeyError('invalid_passkey', 401);
  return {
    id: session.user.id,
    authEpoch: session.user.authEpoch ?? 0,
    authTime: session.user.authTime ?? 0,
  };
}
function withSecret(value: unknown, kind: 'ceremony' | 'ticket', secret: string) {
  const response = NextResponse.json(value, { headers });
  response.cookies.set(passkeyCookie(kind), secret, {
    httpOnly: true,
    secure: passkeyOrigin().startsWith('https:'),
    sameSite: 'strict',
    path: '/',
    maxAge:
      kind === 'ticket'
        ? getSettings().auth.passkey_ticket_seconds
        : getSettings().auth.passkey_challenge_seconds,
  });
  if (kind === 'ticket')
    response.cookies.set(passkeyCookie('ceremony'), '', {
      httpOnly: true,
      secure: passkeyOrigin().startsWith('https:'),
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    });
  return response;
}
export async function GET(request: Request) {
  try {
    const staff = await signedInStaff(request);
    const db = getDb();
    const keys = await db
      .select({ id: staffPasskeys.credentialId })
      .from(staffPasskeys)
      .where(and(eq(staffPasskeys.supervisorId, staff.id), isNull(staffPasskeys.revokedAt)));
    const [row] = await db
      .select({ disabled: supervisors.passwordLoginDisabled })
      .from(supervisors)
      .where(eq(supervisors.id, staff.id));
    return NextResponse.json(
      {
        enrolled: keys.length > 0,
        passwordDisabled: row?.disabled ?? false,
        canonicalOrigin: passkeyOrigin(),
      },
      { headers },
    );
  } catch {
    return NextResponse.json({ error: 'invalid_passkey' }, { status: 401, headers });
  }
}
export async function POST(request: Request) {
  try {
    requirePasskeyOrigin(request);
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      throw new PasskeyError('invalid_passkey');
    const reader = request.body?.getReader();
    if (!reader) throw new PasskeyError('invalid_passkey');
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 65536) {
        await reader.cancel();
        throw new PasskeyError('invalid_passkey', 413);
      }
      chunks.push(value);
    }
    const text = Buffer.concat(chunks).toString('utf8');
    const body = bodySchema.parse(JSON.parse(text));
    if (body.action === 'register-options') {
      const staff = await signedInStaff(request);
      spendOptionsBudget();
      const result = await registrationOptions(getDb(), staff);
      return withSecret(result.options, 'ceremony', result.nonce);
    }
    if (body.action === 'login-options') {
      spendOptionsBudget();
      const result = await authenticationOptions(getDb());
      return withSecret(result.options, 'ceremony', result.nonce);
    }
    const nonce = readPasskeyCookie(request, 'ceremony');
    const staff = body.action === 'register-verify' ? await signedInStaff(request) : null;
    const ticket =
      body.action === 'register-verify'
        ? await verifyRegistration(getDb(), staff!, nonce, body.response)
        : await verifyAuthentication(getDb(), nonce, body.response);
    return withSecret({ ok: true }, 'ticket', ticket);
  } catch (error) {
    const known = error instanceof PasskeyError;
    // Cryptographic errors never echo credential, account, or authenticator material.
    return NextResponse.json(
      { error: known ? error.code : 'invalid_passkey' },
      { status: known ? error.status : 400, headers },
    );
  }
}
