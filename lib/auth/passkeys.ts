// SPDX-License-Identifier: AGPL-3.0-only

import { createHash, randomBytes } from 'node:crypto';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { and, eq, gt, isNull, lt } from 'drizzle-orm';
import { z } from 'zod';
import { getSettings } from '@/lib/config';
import { type Database, type Queryable } from '@/lib/db/client';
import { staffAuthChallenges, staffPasskeys, supervisors } from '@/lib/db/schema';
import { isRole } from './permissions';

export class PasskeyError extends Error {
  constructor(
    public readonly code:
      'invalid_passkey' | 'recent_login_required' | 'wrong_origin' | 'rate_limited',
    public readonly status = 400,
  ) {
    super(code);
  }
}

export function passkeyOrigin() {
  return getSettings().auth.passkey_origin;
}
export function passkeyRpId() {
  return new URL(passkeyOrigin()).hostname;
}
export function passkeyCookie(kind: 'ceremony' | 'ticket') {
  return `${passkeyOrigin().startsWith('https:') ? '__Host-' : ''}takasats-passkey-${kind}`;
}
export function readPasskeyCookie(request: Request, kind: 'ceremony' | 'ticket'): string | null {
  const name = passkeyCookie(kind);
  const value = request.headers
    .get('cookie')
    ?.split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}
export function requirePasskeyOrigin(request: Request) {
  if (
    request.headers.get('origin') !== passkeyOrigin() ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  ) {
    throw new PasskeyError('wrong_origin', 403);
  }
}

// A bounded global budget avoids unbounded anonymous challenge storage. No proxy IP is trusted.
let budgetStart = 0;
let budgetCount = 0;
export function spendOptionsBudget(now = Date.now()) {
  if (now - budgetStart >= 60_000) {
    budgetStart = now;
    budgetCount = 0;
  }
  if (++budgetCount > getSettings().auth.passkey_options_per_minute)
    throw new PasskeyError('rate_limited', 429);
}
export const secretHash = (s: string) => createHash('sha256').update(s).digest('hex');
const newSecret = () => randomBytes(32).toString('base64url');
const invalid = () => new PasskeyError('invalid_passkey');

export type FreshStaff = { id: string; authEpoch: number; authTime: number };
export function requireRecentLogin(staff: FreshStaff, now = Date.now()) {
  const age = now - staff.authTime;
  if (
    !Number.isFinite(age) ||
    age < 0 ||
    age > getSettings().auth.passkey_recent_login_seconds * 1000
  ) {
    throw new PasskeyError('recent_login_required', 401);
  }
}
async function activeStaff(db: Queryable, id: string, lock = false) {
  const query = db.select().from(supervisors).where(eq(supervisors.id, id));
  const [row] = await (lock ? query.for('update') : query);
  if (!row?.active || !isRole(row.role) || row.role === 'partner') throw invalid();
  return { ...row, role: row.role };
}

async function storeChallenge(
  db: Queryable,
  kind: 'register' | 'login',
  challenge: string,
  staff?: FreshStaff,
) {
  const nonce = newSecret();
  await db.delete(staffAuthChallenges).where(lt(staffAuthChallenges.expiresAt, new Date()));
  await db.insert(staffAuthChallenges).values({
    nonceHash: secretHash(nonce),
    kind,
    challenge,
    supervisorId: staff?.id ?? null,
    authEpoch: staff?.authEpoch ?? null,
    expiresAt: new Date(Date.now() + getSettings().auth.passkey_challenge_seconds * 1000),
  });
  return nonce;
}
async function consumeChallenge(
  db: Queryable,
  nonce: string | null,
  kind: 'register' | 'login' | 'ticket',
) {
  if (!nonce) throw invalid();
  const [challenge] = await db
    .delete(staffAuthChallenges)
    .where(
      and(
        eq(staffAuthChallenges.nonceHash, secretHash(nonce)),
        eq(staffAuthChallenges.kind, kind),
        gt(staffAuthChallenges.expiresAt, new Date()),
      ),
    )
    .returning();
  if (!challenge) throw invalid();
  return challenge;
}
async function issueTicket(db: Queryable, staff: { id: string; authEpoch: number }) {
  const ticket = newSecret();
  await db.insert(staffAuthChallenges).values({
    nonceHash: secretHash(ticket),
    kind: 'ticket',
    challenge: '',
    supervisorId: staff.id,
    authEpoch: staff.authEpoch,
    expiresAt: new Date(Date.now() + getSettings().auth.passkey_ticket_seconds * 1000),
  });
  return ticket;
}

export async function registrationOptions(db: Database, staff: FreshStaff) {
  requireRecentLogin(staff);
  const row = await activeStaff(db, staff.id);
  if (row.authEpoch !== staff.authEpoch) throw invalid();
  const existing = await db
    .select()
    .from(staffPasskeys)
    .where(and(eq(staffPasskeys.supervisorId, staff.id), isNull(staffPasskeys.revokedAt)));
  const options = await generateRegistrationOptions({
    rpName: 'Taka Sats',
    rpID: passkeyRpId(),
    userName: row.phone,
    userDisplayName: row.name,
    userID: new TextEncoder().encode(row.id),
    attestationType: 'none',
    supportedAlgorithmIDs: [-7, -257],
    excludeCredentials: existing.map((k) => ({ id: k.credentialId })),
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'required',
      authenticatorAttachment: 'platform',
    },
    timeout: getSettings().auth.passkey_challenge_seconds * 1000,
  });
  return { options, nonce: await storeChallenge(db, 'register', options.challenge, staff) };
}
export async function authenticationOptions(db: Database) {
  const options = await generateAuthenticationOptions({
    rpID: passkeyRpId(),
    allowCredentials: [],
    userVerification: 'required',
    timeout: getSettings().auth.passkey_challenge_seconds * 1000,
  });
  return { options, nonce: await storeChallenge(db, 'login', options.challenge) };
}

const base64 = z
  .string()
  .min(1)
  .max(65536)
  .regex(/^[A-Za-z0-9_-]+$/);
const credentialBase = z.object({
  id: base64.max(2048),
  rawId: base64.max(2048),
  type: z.literal('public-key'),
  clientExtensionResults: z
    .object({ credProps: z.object({ rk: z.boolean().optional() }).optional() })
    .passthrough(),
  authenticatorAttachment: z.enum(['platform', 'cross-platform']).optional(),
});
const registerSchema = credentialBase.extend({
  response: z.object({
    clientDataJSON: base64,
    attestationObject: base64,
    transports: z
      .array(z.enum(['ble', 'cable', 'hybrid', 'internal', 'nfc', 'smart-card', 'usb']))
      .max(8)
      .optional(),
  }),
});
const loginSchema = credentialBase.extend({
  response: z.object({
    clientDataJSON: base64,
    authenticatorData: base64,
    signature: base64,
    userHandle: base64,
  }),
});

export async function verifyRegistration(
  db: Database,
  staff: FreshStaff,
  nonce: string | null,
  raw: unknown,
) {
  requireRecentLogin(staff);
  // Consumed before verification, outside the credential transaction: even failed proofs cannot replay.
  const challenge = await consumeChallenge(db, nonce, 'register');
  if (challenge.supervisorId !== staff.id || challenge.authEpoch !== staff.authEpoch)
    throw invalid();
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success || parsed.data.clientExtensionResults.credProps?.rk !== true) throw invalid();
  const result = await verifyRegistrationResponse({
    response: parsed.data as RegistrationResponseJSON,
    expectedChallenge: challenge.challenge,
    expectedOrigin: passkeyOrigin(),
    expectedRPID: passkeyRpId(),
    requireUserVerification: true,
    supportedAlgorithmIDs: [-7, -257],
  });
  if (!result.verified) throw invalid();
  const info = result.registrationInfo;
  return db.transaction(async (tx) => {
    const row = await activeStaff(tx, staff.id, true);
    if (row.authEpoch !== staff.authEpoch) throw invalid();
    await tx.insert(staffPasskeys).values({
      credentialId: info.credential.id,
      supervisorId: row.id,
      publicKey: Buffer.from(info.credential.publicKey).toString('base64url'),
      counter: info.credential.counter,
      transports: info.credential.transports ?? [],
      deviceType: info.credentialDeviceType,
      backedUp: info.credentialBackedUp,
    });
    const authEpoch = row.authEpoch + 1;
    await tx
      .update(supervisors)
      .set({ passwordLoginDisabled: true, bootstrapPasswordExpiresAt: null, authEpoch })
      .where(eq(supervisors.id, row.id));
    return issueTicket(tx, { id: row.id, authEpoch });
  });
}

export async function verifyAuthentication(db: Database, nonce: string | null, raw: unknown) {
  const challenge = await consumeChallenge(db, nonce, 'login');
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) throw invalid();
  const response = parsed.data as AuthenticationResponseJSON;
  const [candidate] = await db
    .select()
    .from(staffPasskeys)
    .where(eq(staffPasskeys.credentialId, response.id));
  if (!candidate) throw invalid();
  return db.transaction(async (tx) => {
    const row = await activeStaff(tx, candidate.supervisorId, true);
    const [key] = await tx
      .select()
      .from(staffPasskeys)
      .where(eq(staffPasskeys.credentialId, response.id))
      .for('update');
    if (
      !key ||
      key.revokedAt ||
      response.response.userHandle !== Buffer.from(row.id).toString('base64url')
    )
      throw invalid();
    const result = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: passkeyOrigin(),
      expectedRPID: passkeyRpId(),
      requireUserVerification: true,
      credential: {
        id: key.credentialId,
        publicKey: new Uint8Array(Buffer.from(key.publicKey, 'base64url')),
        counter: key.counter,
        transports: key.transports,
      },
    });
    if (!result.verified) throw invalid();
    await tx
      .update(staffPasskeys)
      .set({
        counter: result.authenticationInfo.newCounter,
        backedUp: result.authenticationInfo.credentialBackedUp,
        lastUsedAt: new Date(),
      })
      .where(eq(staffPasskeys.credentialId, key.credentialId));
    return issueTicket(tx, row);
  });
}

/** Only Auth.js consumes this HttpOnly proof; no raw browser payload can sign in. */
export async function consumePasskeyTicket(db: Database, request: Request) {
  const secret = readPasskeyCookie(request, 'ticket');
  if (!secret) return null;
  // Commit consumption even when the account was recovered or deactivated.
  let proof;
  try {
    proof = await consumeChallenge(db, secret, 'ticket');
  } catch {
    return null;
  }
  if (!proof.supervisorId) return null;
  try {
    return await db.transaction(async (tx) => {
      const row = await activeStaff(tx, proof.supervisorId!, true);
      if (row.authEpoch !== proof.authEpoch) return null;
      await tx
        .update(supervisors)
        .set({ lastLoginAt: new Date() })
        .where(eq(supervisors.id, row.id));
      return {
        id: row.id,
        name: row.name,
        role: row.role,
        locale: row.locale,
        authEpoch: row.authEpoch,
        authTime: Date.now(),
        authMethod: 'passkey' as const,
      };
    });
  } catch {
    return null;
  }
}
