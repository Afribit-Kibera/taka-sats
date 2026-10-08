// SPDX-License-Identifier: AGPL-3.0-only
import { randomInt } from 'node:crypto';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { getSettings } from '@/lib/config';
import { type Database } from '@/lib/db/client';
import { staffAuthChallenges, staffPasskeys, supervisors } from '@/lib/db/schema';
import words from './bootstrap-words.json';
import { hashPassword } from './password';

/** Six independently selected EFF short words (~62 bits); no staff-code-derived secrets. */
export function memorableSetupPhrase(): string {
  return Array.from({ length: 6 }, () => words[randomInt(words.length)]!).join(' ');
}

/** Explicit operator recovery: staff lock serializes enrollment, login and revocation. */
export async function resetStaffPhoneAccess(
  db: Database,
  identifiers: readonly string[],
  beforeCommit?: (
    credentials: readonly { identifier: string; password: string; expiresAt: Date }[],
  ) => void,
) {
  if (!identifiers.length || new Set(identifiers).size !== identifiers.length)
    throw new Error('Provide distinct staff codes');
  const phrases = await Promise.all(
    identifiers.map(async (identifier) => {
      const password = memorableSetupPhrase();
      return { identifier, password, hash: await hashPassword(password) };
    }),
  );
  const expiresAt = new Date(Date.now() + getSettings().auth.bootstrap_password_days * 86400_000);
  await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(supervisors)
      .where(inArray(supervisors.phone, [...identifiers]))
      .orderBy(supervisors.id)
      .for('update');
    if (rows.length !== identifiers.length || rows.some((r) => !r.active))
      throw new Error('Staff codes must identify existing active accounts');
    for (const phrase of phrases) {
      const row = rows.find((r) => r.phone === phrase.identifier)!;
      await tx
        .update(supervisors)
        .set({
          passwordHash: phrase.hash,
          passwordLoginDisabled: false,
          bootstrapPasswordExpiresAt: expiresAt,
          authEpoch: sql`${supervisors.authEpoch} + 1`,
        })
        .where(eq(supervisors.id, row.id));
      await tx
        .update(staffPasskeys)
        .set({ revokedAt: new Date() })
        .where(and(eq(staffPasskeys.supervisorId, row.id), isNull(staffPasskeys.revokedAt)));
      await tx.delete(staffAuthChallenges).where(eq(staffAuthChallenges.supervisorId, row.id));
    }
    // A failed private-file write aborts recovery rather than leaving staff without their new phrase.
    beforeCommit?.(
      phrases.map(({ identifier, password }) => ({ identifier, password, expiresAt })),
    );
  });
  return phrases.map(({ identifier, password }) => ({ identifier, password, expiresAt }));
}
