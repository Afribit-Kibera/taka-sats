// SPDX-License-Identifier: AGPL-3.0-only

import { eq } from 'drizzle-orm';
import type { Session } from 'next-auth';
import { NextRequest } from 'next/server';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/jobs', () => ({ enqueueProcessPayoutSafely: vi.fn() }));

import { auth } from '@/auth';
import { authenticateApiKey, createApiKey, hashApiKey, revokeApiKey } from '@/lib/auth/api-keys';
import { getActor, requireScope } from '@/lib/auth/session';
import { attachDestination, enrolCollector } from '@/lib/collectors';
import { DestinationReplaceForbiddenError } from '@/lib/collectors/errors';
import { getDb } from '@/lib/db/client';
import {
  apiKeys,
  collectionEvents,
  collectorPaymentDestinations,
  supervisors,
} from '@/lib/db/schema';
import { createPayoutForEvent } from '@/lib/payouts/process';
import { reviewPayout } from '@/lib/payouts/review';
import { createCollector, createStaff, resetCollectorTables } from '@/lib/testing/fixtures';
import { seedCollectionEvent, seedPayoutWorld } from '@/lib/testing/payout-fixtures';
import { GET as readSessions } from '../sessions/route';
import { POST as revokeRoute } from './[id]/revoke/route';
import { GET, POST } from './route';

const authMock = auth as unknown as ReturnType<typeof vi.fn<() => Promise<Session | null>>>;
const hasDatabase = Boolean(process.env.DATABASE_URL);

function request(token?: string, body?: unknown) {
  return new NextRequest('https://example.test/api/v1/api-keys', {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(token !== undefined ? { Authorization: token } : {}),
      'Content-Type': 'application/json',
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

describe('API key management authentication', () => {
  beforeEach(() => authMock.mockReset());
  it('denies anonymous key creation before touching the DB', async () => {
    authMock.mockResolvedValue(null);
    expect((await POST(request(undefined, {}))).status).toBe(401);
  });
  it('does not fall back to a valid administrator cookie for malformed bearer input', async () => {
    authMock.mockResolvedValue({
      user: { id: 'admin', role: 'admin', locale: 'en' },
      expires: '2099-01-01',
    });
    expect((await GET(request('Bearer invalid'))).status).toBe(401);
    expect(authMock).not.toHaveBeenCalled();
  });
});

describe.skipIf(!hasDatabase)('scoped API keys (isolated Postgres)', () => {
  const db = hasDatabase ? getDb() : undefined!;
  let owner: { id: string; role: 'admin' };
  const input = () => ({
    name: 'Own dashboard',
    scopes: ['payout:read'],
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  });
  beforeEach(async () => {
    await resetCollectorTables(db);
    owner = (await createStaff(db, 'admin')) as typeof owner;
    authMock.mockReset();
    authMock.mockResolvedValue({
      user: { id: owner.id, role: 'admin', locale: 'en' },
      expires: '2099-01-01',
    });
  });
  afterAll(async () => resetCollectorTables(db));

  it('returns a token once, stores only its hash and lists metadata without credentials', async () => {
    const response = await POST(request(undefined, input()));
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toContain('no-store');
    const created = (await response.json()) as Awaited<ReturnType<typeof createApiKey>>;
    expect(created.token).toMatch(/^tks_[A-Za-z0-9_-]{43}$/);
    const [stored] = await db.select().from(apiKeys).where(eq(apiKeys.id, created.key.id));
    expect(stored?.tokenHash).toBe(hashApiKey(created.token));
    expect(JSON.stringify(stored)).not.toContain(created.token);
    const list = await GET(request());
    expect(list.headers.get('cache-control')).toContain('no-store');
    const listText = await list.text();
    expect(listText).not.toContain(created.token);
    expect(listText).not.toContain('tokenHash');
    expect(listText).toContain(created.key.id);
  });

  it('authenticates with owner identity and rejects a scope outside the key grants', async () => {
    const created = await createApiKey(db, owner.id, input());
    const req = request(`Bearer ${created.token}`);
    expect((await requireScope('payout:read', req)).id).toBe(owner.id);
    await expect(requireScope('payout:approve', req)).rejects.toMatchObject({
      scope: 'payout:approve',
    });
    expect((await readSessions(req)).status).toBe(403);
  });

  it('forbids bearer key creation, listing and revocation even with a valid admin cookie', async () => {
    const created = await createApiKey(db, owner.id, input());
    expect((await POST(request(`Bearer ${created.token}`, input()))).status).toBe(403);
    expect((await GET(request(`Bearer ${created.token}`))).status).toBe(403);
    expect(
      (
        await revokeRoute(request(`Bearer ${created.token}`, {}), {
          params: Promise.resolve({ id: created.key.id }),
        })
      ).status,
    ).toBe(403);
  });

  it('makes revocation immediate and idempotent, preserving the first revoker', async () => {
    const created = await createApiKey(db, owner.id, input());
    const other = await createStaff(db, 'admin');
    const revoked = await revokeApiKey(db, created.key.id, owner.id);
    expect((await revokeApiKey(db, created.key.id, other.id)).revokedBy).toBe(revoked.revokedBy);
    expect(await authenticateApiKey(db, created.token)).toBeNull();
    expect(await getActor(request(`Bearer ${created.token}`))).toBeNull();
  });

  it('rejects an expired key and unknown well-formed token without cookie fallback', async () => {
    const created = await createApiKey(db, owner.id, input());
    await db
      .update(apiKeys)
      .set({
        createdAt: new Date(Date.now() - 172_800_000),
        expiresAt: new Date(Date.now() - 86_400_000),
      })
      .where(eq(apiKeys.id, created.key.id));
    expect(await getActor(request(`Bearer ${created.token}`))).toBeNull();
    expect(await getActor(request(`Bearer tks_${'Z'.repeat(43)}`))).toBeNull();
    expect(authMock).not.toHaveBeenCalled();
  });

  it('deactivation and live-role demotion immediately remove access', async () => {
    const created = await createApiKey(db, owner.id, {
      ...input(),
      scopes: ['payout:approve', 'payout:read'],
    });
    await db.update(supervisors).set({ role: 'supervisor' }).where(eq(supervisors.id, owner.id));
    const req = request(`Bearer ${created.token}`);
    await expect(requireScope('payout:approve', req)).rejects.toMatchObject({
      scope: 'payout:approve',
    });
    expect((await requireScope('payout:read', req)).role).toBe('supervisor');
    await db.update(supervisors).set({ active: false }).where(eq(supervisors.id, owner.id));
    expect(await getActor(req)).toBeNull();
  });

  it('rejects past, excessive and missing expiry and never issues an execution or management key', async () => {
    for (const body of [
      { ...input(), expiresAt: new Date(Date.now() - 1).toISOString() },
      { ...input(), expiresAt: new Date(Date.now() + 366 * 86_400_000).toISOString() },
      { name: 'Missing expiry', scopes: ['payout:read'] },
      { ...input(), scopes: ['payout:execute'] },
      { ...input(), scopes: ['apikey:manage'] },
    ])
      expect((await POST(request(undefined, body))).status).toBe(400);
  });

  it('cannot silently preauthorize enrolment or replace a verified wallet through an enrol-only key', async () => {
    const created = await createApiKey(db, owner.id, { ...input(), scopes: ['collector:enrol'] });
    const actor = await authenticateApiKey(db, created.token);
    if (!actor) throw new Error('Expected valid fixture key');
    const registered = await enrolCollector(db, { alias: 'Key enrolment' }, actor);
    expect(registered.status).toBe('pending');
    const active = await createCollector(db, { registeredBy: owner.id });
    await db.insert(collectorPaymentDestinations).values({
      collectorId: active.id,
      type: 'lightning_address',
      address: 'existing@wallet.example',
      status: 'verified',
      verifiedAt: new Date(),
      createdBy: owner.id,
    });
    const provider = { resolveReceiveAddress: vi.fn() };
    await expect(
      attachDestination(
        db,
        provider,
        {
          collectorId: active.id,
          rawCode: 'replacement@wallet.example',
        },
        actor,
      ),
    ).rejects.toThrow(DestinationReplaceForbiddenError);
    expect(provider.resolveReceiveAddress).not.toHaveBeenCalled();
  });

  it('preserves recorder identity so separate keys cannot approve their owner’s own work', async () => {
    const world = await seedPayoutWorld(db);
    const eventId = await seedCollectionEvent(db, world);
    await db
      .update(collectionEvents)
      .set({ supervisorId: world.adminId })
      .where(eq(collectionEvents.id, eventId));
    const payout = await createPayoutForEvent(db, eventId);
    if (!payout) throw new Error('Expected payout fixture');
    const created = await createApiKey(db, world.adminId, {
      ...input(),
      scopes: ['payout:approve'],
    });
    const actor = await authenticateApiKey(db, created.token);
    if (!actor) throw new Error('Expected valid fixture key');
    await expect(
      reviewPayout(db, {
        payoutId: payout.id,
        actor,
        decision: 'approved',
        reason: 'Same owner different credential',
      }),
    ).rejects.toMatchObject({ reason: 'self_approval' });
  });
});
