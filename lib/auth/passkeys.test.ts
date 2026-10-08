// SPDX-License-Identifier: AGPL-3.0-only
import { randomBytes } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb, type Database } from '@/lib/db/client';
import { staffAuthChallenges, staffPasskeys, supervisors } from '@/lib/db/schema';
import { memorableSetupPhrase, resetStaffPhoneAccess } from './bootstrap';
import { hashPassword, verifyPassword, weakPasswordReason } from './password';
import {
  authenticationOptions,
  consumePasskeyTicket,
  passkeyCookie,
  passkeyOrigin,
  readPasskeyCookie,
  registrationOptions,
  requirePasskeyOrigin,
  requireRecentLogin,
  secretHash,
  verifyAuthentication,
} from './passkeys';

describe('passkey boundaries', () => {
  it('requires exact configured origin, ignoring hostile forwarded hosts', () => {
    const request = (origin: string) =>
      new Request(`${passkeyOrigin()}/api/auth/passkeys`, {
        headers: { origin, 'x-forwarded-host': 'attacker.test' },
      });
    expect(() => requirePasskeyOrigin(request(passkeyOrigin()))).not.toThrow();
    for (const origin of ['https://attacker.test', 'null', `${passkeyOrigin()}.attacker.test`])
      expect(() => requirePasskeyOrigin(request(origin))).toThrow('wrong_origin');
    expect(() => requirePasskeyOrigin(new Request(passkeyOrigin()))).toThrow('wrong_origin');
  });
  it('enrollment requires recent authentication, not a weeks-old session', () => {
    const now = Date.now();
    const staff = { id: 'test', authEpoch: 0, authTime: now };
    expect(() => requireRecentLogin(staff, now)).not.toThrow();
    for (const authTime of [0, now + 1, NaN, now - 901_000])
      expect(() => requireRecentLogin({ ...staff, authTime }, now)).toThrow(
        'recent_login_required',
      );
  });
  it('reads only a well-formed HttpOnly proof cookie, never a posted staff ID/token', () => {
    const nonce = randomBytes(32).toString('base64url');
    const request = (cookie: string) => new Request(passkeyOrigin(), { headers: { cookie } });
    expect(readPasskeyCookie(request(`${passkeyCookie('ticket')}=${nonce}`), 'ticket')).toBe(nonce);
    for (const cookie of ['', 'ticket=123', `${passkeyCookie('ticket')}=short`])
      expect(readPasskeyCookie(request(cookie), 'ticket')).toBeNull();
    expect(secretHash(nonce)).not.toContain(nonce);
  });
  it('generates distinct short-word phrases that meet the password floor', () => {
    const phrases = Array.from({ length: 30 }, memorableSetupPhrase);
    expect(new Set(phrases).size).toBe(30);
    for (const phrase of phrases) {
      expect(phrase.split(' ')).toHaveLength(6);
      expect(weakPasswordReason(phrase)).toBeNull();
    }
  });
});

describe.skipIf(!process.env.DATABASE_URL)('passkeys with an isolated real DB', () => {
  let db: Database;
  beforeEach(async () => {
    db = getDb();
    await db.execute(sql`truncate supervisors cascade`);
  });
  const create = async () =>
    (
      await db
        .insert(supervisors)
        .values({
          name: 'Passkey test',
          phone: 'PASSKEYTEST',
          passwordHash: await hashPassword('isolated-password-9'),
        })
        .returning()
    )[0]!;
  const ticket = async (
    id: string,
    authEpoch: number,
    expiresAt = new Date(Date.now() + 60000),
  ) => {
    const secret = randomBytes(32).toString('base64url');
    await db.insert(staffAuthChallenges).values({
      nonceHash: secretHash(secret),
      kind: 'ticket',
      challenge: '',
      supervisorId: id,
      authEpoch,
      expiresAt,
    });
    return new Request(passkeyOrigin(), {
      headers: { cookie: `${passkeyCookie('ticket')}=${secret}` },
    });
  };
  it('requires verified discoverable credentials with platform UV and no username login list', async () => {
    const row = await create();
    const result = await registrationOptions(db, {
      id: row.id,
      authEpoch: 0,
      authTime: Date.now(),
    });
    expect(result.options.authenticatorSelection).toMatchObject({
      residentKey: 'required',
      userVerification: 'required',
      authenticatorAttachment: 'platform',
    });
    const login = await authenticationOptions(db);
    expect(login.options.allowCredentials).toEqual([]);
    expect(login.options.userVerification).toBe('required');
    await expect(verifyAuthentication(db, login.nonce, {})).rejects.toThrow();
    await expect(verifyAuthentication(db, login.nonce, {})).rejects.toThrow('invalid_passkey');
    expect(
      await db
        .select()
        .from(staffAuthChallenges)
        .where(eq(staffAuthChallenges.nonceHash, secretHash(login.nonce))),
    ).toHaveLength(0);
  });
  it('proofs are one-use, expire, and do not permit arbitrary account impersonation', async () => {
    const row = await create();
    const proof = await ticket(row.id, 0);
    expect(await consumePasskeyTicket(db, proof)).toMatchObject({
      id: row.id,
      authMethod: 'passkey',
    });
    expect(await consumePasskeyTicket(db, proof)).toBeNull();
    expect(
      await consumePasskeyTicket(db, await ticket(row.id, 0, new Date(Date.now() - 1))),
    ).toBeNull();
    expect(
      await consumePasskeyTicket(
        db,
        new Request(passkeyOrigin(), { method: 'POST', body: JSON.stringify({ id: row.id }) }),
      ),
    ).toBeNull();
  });
  it('deactivation and epoch changes refuse even already verified login proofs', async () => {
    const row = await create();
    const proof = await ticket(row.id, 0);
    await db.update(supervisors).set({ authEpoch: 1 }).where(eq(supervisors.id, row.id));
    expect(await consumePasskeyTicket(db, proof)).toBeNull();
    const next = await ticket(row.id, 1);
    await db.update(supervisors).set({ active: false }).where(eq(supervisors.id, row.id));
    expect(await consumePasskeyTicket(db, next)).toBeNull();
  });
  it('operator recovery revokes all old credentials/proofs and resets only requested staff', async () => {
    const row = await create();
    await db.insert(staffPasskeys).values({
      credentialId: 'test-key',
      supervisorId: row.id,
      publicKey: 'public',
      counter: 0,
      deviceType: 'singleDevice',
      backedUp: false,
    });
    const proof = await ticket(row.id, 0);
    await db
      .update(supervisors)
      .set({ passwordLoginDisabled: true })
      .where(eq(supervisors.id, row.id));
    const credentials = await resetStaffPhoneAccess(db, ['PASSKEYTEST']);
    const [updated] = await db.select().from(supervisors).where(eq(supervisors.id, row.id));
    expect(updated).toMatchObject({ authEpoch: 1, passwordLoginDisabled: false });
    expect(await verifyPassword(credentials[0]!.password, updated!.passwordHash)).toBe(true);
    expect(await verifyPassword('isolated-password-9', updated!.passwordHash)).toBe(false);
    expect((await db.select().from(staffPasskeys))[0]!.revokedAt).not.toBeNull();
    expect(await consumePasskeyTicket(db, proof)).toBeNull();
    await expect(resetStaffPhoneAccess(db, ['PASSKEYTEST', 'MISSING'])).rejects.toThrow();
    expect((await db.select().from(supervisors))[0]!.authEpoch).toBe(1);
    await expect(
      resetStaffPhoneAccess(db, ['PASSKEYTEST'], () => {
        throw new Error('private disk full');
      }),
    ).rejects.toThrow('private disk full');
    expect((await db.select().from(supervisors))[0]!.authEpoch).toBe(1);
  });
});
