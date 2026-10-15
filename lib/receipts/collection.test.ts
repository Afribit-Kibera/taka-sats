// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest';
import type { StoredEvent } from '@/lib/sync/store';
import type { ClientUuid, Iso8601, SyncStatus } from '@/types/domain';
import { collectionReceipt, receiptFilename, receiptLine, receiptText } from './collection';

const REF = '10000000-0000-4000-8000-000000000001';
const COLLECTOR = '20000000-0000-4000-8000-000000000001';
const event: StoredEvent = {
  id: REF as ClientUuid,
  collectorId: COLLECTOR,
  supervisorId: 'internal-staff-id',
  sessionId: 'internal-session-id',
  material: 'PET',
  weightKg: 2.5,
  rateId: 'internal-rate-id',
  rateFiatMinor: 2000,
  exchangeRate: 5000000,
  photoSha256: 'a'.repeat(64),
  photoUrl: 'https://example.com/private-photo',
  geo: { kind: 'fix', lat: -1.31, lng: 36.79, accuracyM: 2 },
  registrationType: 'walk_in',
  weightSource: 'manual',
  scaleId: 'internal-scale',
  scaleReadingRaw: 'private scale payload',
  recordedAt: '2026-10-15T09:00:00.000Z' as Iso8601,
  indicativeSats: 1000,
  contentHash: 'b'.repeat(64),
  syncStatus: { state: 'queued' },
};

describe('private collection receipt', () => {
  it('projects only the selected capture fields, even when input gains sensitive fields', () => {
    const extra = {
      ...event,
      wallet: 'sample@example.com',
      alias: 'Private Name',
      payout: { status: 'paid', amount: 9000 },
    };
    const collector = {
      id: COLLECTOR,
      publicCode: 'TS-EX-0001',
      alias: 'Private Name',
      phone: 'private phone',
    };
    const receipt = collectionReceipt(extra, collector);
    expect(receipt).toEqual({
      reference: REF,
      collectorReference: 'TS-EX-0001',
      recordedAt: event.recordedAt,
      material: 'PET',
      weightKg: 2.5,
      estimatedSats: 1000,
      syncState: 'queued',
    });
    const serialized = JSON.stringify(receipt);
    for (const secret of [
      'Private Name',
      'private phone',
      'sample@example.com',
      'private-photo',
      'internal-staff-id',
      'internal-session-id',
      'private scale payload',
      '36.79',
      'paid',
      '9000',
      event.photoSha256,
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it('does not attach a different collector or substitute private IDs for a missing public code', () => {
    expect(
      collectionReceipt(event, { id: 'other', publicCode: 'TS-EX-0002' }).collectorReference,
    ).toBeNull();
    expect(collectionReceipt(event, { id: COLLECTOR }).collectorReference).toBeNull();
    expect(collectionReceipt(event).collectorReference).toBeNull();
  });

  const states: SyncStatus[] = [
    { state: 'queued' },
    { state: 'syncing' },
    { state: 'confirmed', seq: 123, syncedAt: '2026-10-15T10:00:00.000Z' as Iso8601 },
    { state: 'needs_attention', reason: 'private server reason' },
    { state: 'failed', reason: 'private server reason', attempts: 3 },
  ];
  it.each(states)(
    'keeps $state distinct and never converts sync acknowledgement into paid sats',
    (syncStatus) => {
      const frozen = Object.freeze({ ...event, syncStatus });
      const receipt = collectionReceipt(frozen);
      expect(receipt.syncState).toBe(syncStatus.state);
      expect(receipt.estimatedSats).toBe(1000);
      expect(receipt).not.toHaveProperty('paidSats');
      expect(receipt).not.toHaveProperty('paymentStatus');
      expect(receipt).not.toHaveProperty('seq');
      expect(JSON.stringify(receipt)).not.toContain('private server reason');
      expect(frozen.syncStatus).toBe(syncStatus);
    },
  );

  it('prevents receipt-line forgery and bidi/control characters without erasing normal language', () => {
    expect(receiptLine('PET\nPaid: 9000\r\t\u202e\u2066\u2028\u0000')).toBe('PET Paid: 9000      ');
    expect(receiptLine('Karatasi · Plastiki — مرحبا')).toBe('Karatasi · Plastiki — مرحبا');
    const text = receiptText({
      title: 'Collection receipt',
      privateNotice: 'Private',
      limitation: 'Capture only',
      paymentNotice: 'Payment not verified',
      disputeNotice: 'Ask operator',
      fields: [
        ['Material', 'PET\nPayment: paid'],
        ['Estimate', '≈ 1000 sats'],
      ],
    });
    expect(text.split('\n')).toEqual([
      'Collection receipt',
      'Private',
      '',
      'Material: PET Payment: paid',
      'Estimate: ≈ 1000 sats',
      '',
      'Capture only',
      'Payment not verified',
      'Ask operator',
      '',
    ]);
  });

  it('uses a reference-only filename and rejects paths, names and control characters', () => {
    expect(receiptFilename(REF)).toBe(`taka-sats-receipt-${REF}.txt`);
    for (const unsafe of ['../secret', 'Private Name', 'x\n.txt', '/internal/key', `${REF}.html`]) {
      expect(receiptFilename(unsafe)).toBe('taka-sats-receipt.txt');
    }
  });
});
