// SPDX-License-Identifier: AGPL-3.0-only

import { createHash, randomBytes } from 'node:crypto';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getSettings } from '@/lib/config';
import type { Database } from '@/lib/db/client';
import { apiKeys, supervisors } from '@/lib/db/schema';
import { decodeCursor, encodeCursor } from '@/lib/pagination';
import { isRole, roleHasScope, SCOPES, type Scope } from './permissions';

/** Credential-format constants, not deployment policy. Tokens contain 256 random bits. */
const TOKEN_PATTERN = /^tks_[A-Za-z0-9_-]{43}$/;
export const API_KEY_SCOPES: readonly Scope[] = SCOPES.filter(
  (scope) => scope !== 'payout:execute' && scope !== 'apikey:manage',
);
const scopesSchema = z
  .array(z.enum(SCOPES))
  .min(1)
  .max(SCOPES.length)
  .refine((scopes) => new Set(scopes).size === scopes.length, 'scopes must be unique')
  .refine(
    (scopes) => scopes.every((scope) => API_KEY_SCOPES.includes(scope)),
    'scope cannot be delegated',
  );
export const createApiKeySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    scopes: scopesSchema,
    expiresAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export class ApiKeyInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiKeyInputError';
  }
}
export class ApiKeyNotFoundError extends Error {
  constructor() {
    super('API key not found');
    this.name = 'ApiKeyNotFoundError';
  }
}

export function hashApiKey(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** null means absent; false means present but malformed and MUST NOT fall back to a cookie. */
export function bearerToken(request: Request): string | null | false {
  const header = request.headers.get('authorization');
  if (header === null) return null;
  const match = /^Bearer (tks_[A-Za-z0-9_-]{43})$/i.exec(header);
  return match?.[1] ?? false;
}

export async function authenticateApiKey(db: Database, token: string) {
  if (!TOKEN_PATTERN.test(token)) return null;
  const [row] = await db
    .select({
      id: apiKeys.id,
      ownerId: apiKeys.ownerId,
      scopes: apiKeys.scopes,
      role: supervisors.role,
    })
    .from(apiKeys)
    .innerJoin(supervisors, eq(supervisors.id, apiKeys.ownerId))
    .where(
      and(
        eq(apiKeys.tokenHash, hashApiKey(token)),
        isNull(apiKeys.revokedAt),
        gt(apiKeys.expiresAt, sql`now()`),
        eq(supervisors.active, true),
      ),
    );
  if (!row || !isRole(row.role) || row.role === 'partner') return null;
  const parsed = scopesSchema.safeParse(row.scopes);
  if (!parsed.success) return null;
  return {
    kind: 'supervisor' as const,
    id: row.ownerId,
    role: row.role,
    apiKeyId: row.id,
    scopes: parsed.data.filter((scope) =>
      roleHasScope(row.role as Exclude<typeof row.role, 'partner'>, scope),
    ),
  };
}

const metadata = {
  id: apiKeys.id,
  ownerId: apiKeys.ownerId,
  name: apiKeys.name,
  tokenPrefix: apiKeys.tokenPrefix,
  scopes: apiKeys.scopes,
  createdAt: apiKeys.createdAt,
  expiresAt: apiKeys.expiresAt,
  revokedAt: apiKeys.revokedAt,
  revokedBy: apiKeys.revokedBy,
};

/** Only the creating admin owns the key. No arbitrary staff impersonation. */
export async function createApiKey(db: Database, ownerId: string, body: unknown) {
  const input = createApiKeySchema.parse(body);
  if (input.scopes.some((scope) => !roleHasScope('admin', scope))) {
    throw new ApiKeyInputError('Requested scopes must be granted to the key owner');
  }
  const now = new Date();
  const expiresAt = new Date(input.expiresAt);
  const maximum = now.getTime() + getSettings().auth.api_key_max_age_days * 86_400_000;
  if (expiresAt.getTime() <= now.getTime() || expiresAt.getTime() > maximum) {
    throw new ApiKeyInputError(
      'expiresAt must be in the future and within auth.api_key_max_age_days',
    );
  }
  return db.transaction(async (tx) => {
    const [owner] = await tx
      .select({ role: supervisors.role, active: supervisors.active })
      .from(supervisors)
      .where(eq(supervisors.id, ownerId))
      .for('share');
    if (!owner?.active || owner.role !== 'admin')
      throw new ApiKeyInputError('An active administrator must own the key');
    const token = `tks_${randomBytes(32).toString('base64url')}`;
    const [key] = await tx
      .insert(apiKeys)
      .values({
        ownerId,
        name: input.name,
        scopes: input.scopes,
        createdAt: now,
        expiresAt,
        tokenHash: hashApiKey(token),
        tokenPrefix: token.slice(0, 12),
      })
      .returning(metadata);
    if (!key) throw new Error('API key creation returned no row');
    return { key, token };
  });
}

/** Admin metadata list: no plaintext token and no hash, including revoked/expired entries. */
export async function listApiKeys(
  db: Database,
  input: { limit: number; cursor?: string | undefined },
) {
  const cursor = input.cursor ? decodeCursor(input.cursor) : null;
  const rows = await db
    .select({ ...metadata, cursorTs: sql<string>`${apiKeys.createdAt}::text` })
    .from(apiKeys)
    .where(
      cursor
        ? sql`(${apiKeys.createdAt}, ${apiKeys.id}) < (${cursor.ts}::timestamptz, ${cursor.id}::uuid)`
        : undefined,
    )
    .orderBy(desc(apiKeys.createdAt), desc(apiKeys.id))
    .limit(input.limit + 1);
  const page = rows.slice(0, input.limit);
  const last = page.at(-1);
  return {
    keys: page.map(({ cursorTs: _cursorTs, ...key }) => key),
    nextCursor: rows.length > input.limit && last ? encodeCursor(last.cursorTs, last.id) : null,
  };
}

/** Idempotent revocation; the first revoker is retained for accountability. */
export async function revokeApiKey(db: Database, id: string, revokedBy: string) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select(metadata)
      .from(apiKeys)
      .where(eq(apiKeys.id, id))
      .for('update');
    if (!existing) throw new ApiKeyNotFoundError();
    if (existing.revokedAt) return existing;
    const [key] = await tx
      .update(apiKeys)
      .set({ revokedAt: new Date(), revokedBy })
      .where(eq(apiKeys.id, id))
      .returning(metadata);
    if (!key) throw new ApiKeyNotFoundError();
    return key;
  });
}
