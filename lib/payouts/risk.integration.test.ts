// SPDX-License-Identifier: AGPL-3.0-only

import { randomBytes } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSettingsCache } from '@/lib/config';
import { getDb } from '@/lib/db/client';
import { anomalyFlags, collectionEvents, collectors, payouts } from '@/lib/db/schema';
import { verifyChain } from '@/lib/ledger';
import { FakeLightningProvider } from '@/lib/lightning';
import { photoUrlFor } from '@/lib/storage';
import {
  NOW,
  PAYOUT_TRUNCATE,
  seedCollectionEvent,
  seedPayoutWorld,
  type PayoutWorld,
} from '@/lib/testing/payout-fixtures';
import { createPayoutForEvent, processPayout, retryPayout } from './process';
import { reviewPayout } from './review';

vi.mock('@/lib/storage', () => ({
  photoUrlFor: vi.fn(async () => 'https://storage.example/photo'),
}));
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)('risk-based payout engine (isolated Postgres)', () => {
  const db = hasDatabase ? getDb() : undefined!;
  let world: PayoutWorld;
  let fake: FakeLightningProvider;
  const keys = [
    'TAKASATS__PAYOUTS__APPROVAL_MODE',
    'TAKASATS__PAYOUTS__REVIEW_THRESHOLD_FIAT_MINOR',
    'TAKASATS__VERIFICATION__PROVIDER',
    'TAKASATS__VERIFICATION__OCR_REQUIRED_FOR_AUTOPAY',
  ] as const;
  beforeEach(async () => {
    process.env.TAKASATS__PAYOUTS__APPROVAL_MODE = 'risk_based';
    process.env.TAKASATS__PAYOUTS__REVIEW_THRESHOLD_FIAT_MINOR = '100000';
    process.env.TAKASATS__VERIFICATION__PROVIDER = 'none';
    process.env.TAKASATS__VERIFICATION__OCR_REQUIRED_FOR_AUTOPAY = 'false';
    resetSettingsCache();
    vi.mocked(photoUrlFor).mockResolvedValue('https://storage.example/photo');
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    world = await seedPayoutWorld(db);
    fake = new FakeLightningProvider();
  });
  afterEach(() => {
    for (const key of keys) delete process.env[key];
    resetSettingsCache();
    vi.restoreAllMocks();
  });
  afterAll(async () => {
    if (hasDatabase) await db.execute(PAYOUT_TRUNCATE);
  });
  async function make(weightKg = '8.4') {
    const id = await seedCollectionEvent(db, world, { weightKg });
    await db
      .update(collectionEvents)
      .set({
        photoSha256: randomBytes(32).toString('hex'),
        evidenceStatus: 'matched',
        ocrWeightKg: weightKg,
      })
      .where(eq(collectionEvents.id, id));
    return createPayoutForEvent(db, id);
  }
  const reviewer = () => ({ id: world.hubLeadId, role: 'hub_lead' }) as const;
  async function held() {
    const payout = await make('60');
    return processPayout(db, fake, payout.id, NOW);
  }
  it('individual low-risk work auto-pays exactly once, without approval', async () => {
    const payout = await make();
    await Promise.all(Array.from({ length: 6 }, () => processPayout(db, fake, payout.id, NOW)));
    const [stored] = await db.select().from(payouts).where(eq(payouts.id, payout.id));
    expect(stored?.status).toBe('paid');
    expect(stored?.approvedBy).toBeNull();
    expect(fake.paymentsSent()).toHaveLength(1);
    expect((await verifyChain(db)).ok).toBe(true);
  });
  it('collective work produces one payout to the registered group wallet', async () => {
    await db
      .update(collectors)
      .set({ recipientType: 'collective' })
      .where(eq(collectors.id, world.collectorId));
    const payout = await make('42.6');
    expect((await processPayout(db, fake, payout.id, NOW)).status).toBe('paid');
    expect(fake.paymentsSent()).toHaveLength(1);
  });
  it('missing photo blocks all approval modes and resumes only when stored', async () => {
    const payout = await make();
    vi.mocked(photoUrlFor).mockResolvedValueOnce(null);
    const waiting = await processPayout(db, fake, payout.id, NOW);
    expect(waiting.status).toBe('awaiting_rate');
    expect(waiting.lastError).toBe('photo_missing');
    expect(fake.paymentsSent()).toHaveLength(0);
    expect((await processPayout(db, fake, payout.id, NOW)).status).toBe('paid');
  });
  it('storage unavailable is retryable, not approval or payment', async () => {
    const payout = await make();
    vi.mocked(photoUrlFor).mockRejectedValueOnce(new Error('storage down'));
    expect((await processPayout(db, fake, payout.id, NOW)).lastError).toBe('photo_unavailable');
    expect(fake.paymentsSent()).toHaveLength(0);
  });
  it('entered18.4 vs photographed8.4 is held, with unchanged recorded weight', async () => {
    const payout = await make('18.4');
    await db
      .update(collectionEvents)
      .set({ ocrWeightKg: '8.4', evidenceStatus: 'mismatch' })
      .where(eq(collectionEvents.id, payout.collectionEventId));
    expect((await processPayout(db, fake, payout.id, NOW)).lastError).toBe('weight_mismatch');
    expect(fake.paymentsSent()).toHaveLength(0);
    const [event] = await db
      .select()
      .from(collectionEvents)
      .where(eq(collectionEvents.id, payout.collectionEventId));
    expect(event?.weightKg).toBe('18.400');
  });
  it('duplicate photo holds even when the asynchronous detector has not written a flag', async () => {
    const first = await make();
    const second = await make();
    const [event] = await db
      .select()
      .from(collectionEvents)
      .where(eq(collectionEvents.id, first.collectionEventId));
    await db
      .update(collectionEvents)
      .set({ photoSha256: event!.photoSha256 })
      .where(eq(collectionEvents.id, second.collectionEventId));
    expect((await processPayout(db, fake, second.id, NOW)).lastError).toBe('duplicate_photo');
    expect(fake.paymentsSent()).toHaveLength(0);
  });
  it('large fiat payout needs a distinct reviewer; approval is ledgered then worker pays', async () => {
    const payout = await held();
    expect(payout.lastError).toBe('payout_threshold');
    await expect(
      reviewPayout(db, {
        payoutId: payout.id,
        actor: { id: world.recorderId, role: 'admin' },
        decision: 'approved',
        reason: 'Checked',
      }),
    ).rejects.toMatchObject({ reason: 'self_approval' });
    const input = {
      payoutId: payout.id,
      actor: reviewer(),
      decision: 'approved' as const,
      reason: 'Scale reviewed',
    };
    expect((await reviewPayout(db, input)).changed).toBe(true);
    expect((await reviewPayout(db, input)).changed).toBe(false);
    expect((await processPayout(db, fake, payout.id, NOW)).status).toBe('paid');
    expect(fake.paymentsSent()).toHaveLength(1);
    expect((await verifyChain(db)).ok).toBe(true);
    expect(
      (
        await db.execute(
          sql`select count(*)::int n from ledger_entries where entry_type = 'correction'`,
        )
      )[0]?.n,
    ).toBe(1);
  });
  it.each(['rejected', 'reweigh'] as const)(
    '%s work cannot be retried or swept into a payment',
    async (decision) => {
      const payout = await held();
      const input = {
        payoutId: payout.id,
        actor: reviewer(),
        decision,
        reason: 'Need new collection evidence',
      };
      expect((await reviewPayout(db, input)).payout.status).toBe('failed');
      expect((await reviewPayout(db, input)).changed).toBe(false);
      await expect(retryPayout(db, payout.id)).rejects.toThrow();
      expect((await processPayout(db, fake, payout.id, NOW)).status).toBe('failed');
      expect(fake.paymentsSent()).toHaveLength(0);
    },
  );
  it('a supervisor or partner cannot review even when calling domain code directly', async () => {
    const payout = await held();
    for (const role of ['supervisor', 'partner'] as const) {
      await expect(
        reviewPayout(db, {
          payoutId: payout.id,
          actor: { id: world.otherSupervisorId, role },
          decision: 'approved',
          reason: 'Not authorised',
        }),
      ).rejects.toMatchObject({ reason: 'not_permitted' });
    }
    expect(fake.paymentsSent()).toHaveLength(0);
  });
  it('a review cannot approve a photograph that disappeared from storage', async () => {
    const payout = await held();
    vi.mocked(photoUrlFor).mockResolvedValueOnce(null);
    await expect(
      reviewPayout(db, {
        payoutId: payout.id,
        actor: reviewer(),
        decision: 'approved',
        reason: 'Checked',
      }),
    ).rejects.toThrow();
    expect(fake.paymentsSent()).toHaveLength(0);
  });
  it('new evidence after approval invalidates it; worker does not pay a new mismatch', async () => {
    const payout = await held();
    await reviewPayout(db, {
      payoutId: payout.id,
      actor: reviewer(),
      decision: 'approved',
      reason: 'Checked original',
    });
    await db
      .update(collectionEvents)
      .set({ ocrWeightKg: '1', evidenceStatus: 'mismatch' })
      .where(eq(collectionEvents.id, payout.collectionEventId));
    const result = await processPayout(db, fake, payout.id, NOW);
    expect(result.status).toBe('pending_approval');
    expect(result.approvedBy).toBeNull();
    expect(fake.paymentsSent()).toHaveLength(0);
  });
  it('mass balance risk holds new work, without reversing any prior payout', async () => {
    const first = await make();
    await processPayout(db, fake, first.id, NOW);
    await db
      .insert(anomalyFlags)
      .values({ flagType: 'mass_balance_variance', supervisorId: world.recorderId });
    const next = await make('5');
    expect((await processPayout(db, fake, next.id, NOW)).lastError).toBe('mass_balance_variance');
    expect(fake.paymentsSent()).toHaveLength(1);
    expect((await processPayout(db, fake, first.id, NOW)).status).toBe('paid');
  });
  it('new risk after approval invalidates the reviewed snapshot', async () => {
    const payout = await held();
    await reviewPayout(db, {
      payoutId: payout.id,
      actor: reviewer(),
      decision: 'approved',
      reason: 'Original checked',
    });
    await db
      .insert(anomalyFlags)
      .values({ flagType: 'weight_outlier', collectionEventId: payout.collectionEventId });
    expect((await processPayout(db, fake, payout.id, NOW)).status).toBe('pending_approval');
    expect(fake.paymentsSent()).toHaveLength(0);
  });
  it('empty wallet preserves work and external funding safely resumes exactly once', async () => {
    const payout = await make();
    const empty = new FakeLightningProvider({ initialFloatSats: 1 });
    expect((await processPayout(db, empty, payout.id, NOW)).status).toBe('pending_float');
    expect(empty.paymentsSent()).toHaveLength(0);
    expect((await processPayout(db, fake, payout.id, NOW)).status).toBe('paid');
    expect((await processPayout(db, fake, payout.id, NOW)).status).toBe('paid');
    expect(fake.paymentsSent()).toHaveLength(1);
  });
  it('corrupt photo is never payable even after human approval', async () => {
    const payout = await held();
    await db
      .update(collectionEvents)
      .set({ evidenceStatus: 'invalid' })
      .where(eq(collectionEvents.id, payout.collectionEventId));
    await expect(
      reviewPayout(db, {
        payoutId: payout.id,
        actor: reviewer(),
        decision: 'approved',
        reason: 'Cannot override hash',
      }),
    ).rejects.toThrow();
    expect((await processPayout(db, fake, payout.id, NOW)).lastError).toBe('photo_hash_mismatch');
    expect(fake.paymentsSent()).toHaveLength(0);
  });
  it('an approval cleared during float lookup prevents a stale worker claim', async () => {
    const payout = await held();
    await reviewPayout(db, {
      payoutId: payout.id,
      actor: reviewer(),
      decision: 'approved',
      reason: 'Original checked',
    });
    const balance = fake.getFloatBalance.bind(fake);
    vi.spyOn(fake, 'getFloatBalance').mockImplementation(async () => {
      await db
        .update(payouts)
        .set({
          approvedBy: null,
          approvedAt: null,
          reviewRiskHash: null,
          status: 'pending_approval',
        })
        .where(eq(payouts.id, payout.id));
      return balance();
    });
    expect((await processPayout(db, fake, payout.id, NOW)).status).toBe('pending_approval');
    expect(fake.paymentsSent()).toHaveLength(0);
  });
  it('new flags during a slow float read cannot slip past the reviewed risk snapshot', async () => {
    const payout = await held();
    await reviewPayout(db, {
      payoutId: payout.id,
      actor: reviewer(),
      decision: 'approved',
      reason: 'Original checked',
    });
    const balance = fake.getFloatBalance.bind(fake);
    vi.spyOn(fake, 'getFloatBalance').mockImplementation(async () => {
      await db
        .insert(anomalyFlags)
        .values({ flagType: 'weight_outlier', collectionEventId: payout.collectionEventId });
      return balance();
    });
    expect((await processPayout(db, fake, payout.id, NOW)).status).toBe('pending_approval');
    expect(fake.paymentsSent()).toHaveLength(0);
  });
});
