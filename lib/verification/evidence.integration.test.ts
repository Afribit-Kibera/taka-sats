// SPDX-License-Identifier: AGPL-3.0-only
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSettingsCache } from '@/lib/config';
import { getDb } from '@/lib/db/client';
import { collectionEvents, ledgerEntries, payouts } from '@/lib/db/schema';
import { verifyChain } from '@/lib/ledger';
import { FakeLightningProvider } from '@/lib/lightning';
import { createPayoutForEvent, processPayout } from '@/lib/payouts';
import { getPhoto } from '@/lib/storage';
import {
  NOW,
  PAYOUT_TRUNCATE,
  seedCollectionEvent,
  seedPayoutWorld,
} from '@/lib/testing/payout-fixtures';
import { ensureEvidence } from './evidence';
import { readScalePhoto } from './openrouter';

vi.mock('@/lib/storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/storage')>()),
  getPhoto: vi.fn(),
  photoUrlFor: vi.fn(async () => 'https://storage.example/photo'),
}));
vi.mock('./openrouter', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./openrouter')>()),
  readScalePhoto: vi.fn(),
}));
const hasDb = Boolean(process.env.DATABASE_URL);
describe.skipIf(!hasDb)('derived scale evidence (isolated Postgres)', () => {
  const db = hasDb ? getDb() : undefined!;
  let eventId: string;
  let payoutId: string;
  const keys = [
    'TAKASATS__VERIFICATION__PROVIDER',
    'TAKASATS__VERIFICATION__OCR_REQUIRED_FOR_AUTOPAY',
    'TAKASATS__PAYOUTS__APPROVAL_MODE',
  ] as const;
  beforeEach(async () => {
    process.env.TAKASATS__VERIFICATION__PROVIDER = 'openrouter';
    process.env.TAKASATS__VERIFICATION__OCR_REQUIRED_FOR_AUTOPAY = 'true';
    process.env.TAKASATS__PAYOUTS__APPROVAL_MODE = 'risk_based';
    resetSettingsCache();
    const world = await seedPayoutWorld(db);
    eventId = await seedCollectionEvent(db, world, { weightKg: '8.4' });
    const bytes = new Uint8Array([1, 2, 3]);
    await db
      .update(collectionEvents)
      .set({
        photoSha256: createHash('sha256').update(bytes).digest('hex'),
        evidenceStatus: 'pending',
      })
      .where(eq(collectionEvents.id, eventId));
    payoutId = (await createPayoutForEvent(db, eventId)).id;
    vi.mocked(getPhoto).mockResolvedValue({ bytes, contentType: 'image/png' });
    vi.mocked(readScalePhoto).mockResolvedValue({
      scale_visible: true,
      weight_kg: 8.4,
      unit: 'kg',
      confidence: 0.99,
    });
  });
  afterEach(() => {
    for (const key of keys) delete process.env[key];
    resetSettingsCache();
    vi.clearAllMocks();
  });
  afterAll(async () => {
    if (hasDb) await db.execute(PAYOUT_TRUNCATE);
  });
  it('stores derived comparison once, preserves kg/level, and links its ledger correction', async () => {
    expect(await ensureEvidence(db, eventId)).toBe('matched');
    expect(await ensureEvidence(db, eventId)).toBe('matched');
    expect(readScalePhoto).toHaveBeenCalledTimes(1);
    const [event] = await db
      .select()
      .from(collectionEvents)
      .where(eq(collectionEvents.id, eventId));
    expect(event).toMatchObject({
      weightKg: '8.400',
      ocrWeightKg: '8.400',
      verificationLevel: 'V0',
    });
    const corrections = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.entryType, 'correction'));
    expect(corrections).toHaveLength(1);
    expect(corrections[0]?.referencesId).toBe(event?.ledgerEntryId);
    expect((await verifyChain(db)).ok).toBe(true);
  });
  it('upstream failure retains collection and holds payout, never sends', async () => {
    vi.mocked(readScalePhoto).mockRejectedValue(new Error('provider unavailable'));
    const rail = new FakeLightningProvider();
    expect((await processPayout(db, rail, payoutId, NOW)).status).toBe('pending_approval');
    const [event] = await db
      .select()
      .from(collectionEvents)
      .where(eq(collectionEvents.id, eventId));
    expect(event).toMatchObject({
      evidenceStatus: 'unreadable',
      weightKg: '8.400',
      ocrWeightKg: null,
    });
    expect(rail.paymentsSent()).toHaveLength(0);
  });
  it('hash mismatch never reaches a model or provider payment', async () => {
    vi.mocked(getPhoto).mockResolvedValue({ bytes: new Uint8Array([9]), contentType: 'image/png' });
    const rail = new FakeLightningProvider();
    expect((await processPayout(db, rail, payoutId, NOW)).lastError).toBe('photo_hash_mismatch');
    expect(readScalePhoto).not.toHaveBeenCalled();
    expect(rail.paymentsSent()).toHaveLength(0);
    const [payout] = await db.select().from(payouts).where(eq(payouts.id, payoutId));
    expect(payout?.status).toBe('failed');
  });
});
