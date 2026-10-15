// SPDX-License-Identifier: AGPL-3.0-only

import type { StoredEvent } from '@/lib/sync/store';
import type { CachedCollector, SyncStatus } from '@/types/domain';

/** Private capture acknowledgement, deliberately not a server/payment verification artifact. */
export type CollectionReceipt = {
  readonly reference: string;
  readonly collectorReference: string | null;
  readonly recordedAt: string;
  readonly material: string;
  readonly weightKg: number;
  readonly estimatedSats: number;
  readonly syncState: SyncStatus['state'];
};

/** Project explicit fields only: no names, wallet, GPS, evidence URL/bytes or internal actor IDs. */
export function collectionReceipt(
  event: StoredEvent,
  collector?: Pick<CachedCollector, 'id' | 'publicCode'>,
): CollectionReceipt {
  return {
    reference: event.id,
    collectorReference: collector?.id === event.collectorId ? (collector.publicCode ?? null) : null,
    recordedAt: event.recordedAt,
    material: event.material,
    weightKg: event.weightKg,
    estimatedSats: event.indicativeSats,
    syncState: event.syncStatus.state,
  };
}

export type ReceiptText = {
  readonly title: string;
  readonly privateNotice: string;
  readonly limitation: string;
  readonly paymentNotice: string;
  readonly disputeNotice: string;
  readonly fields: readonly (readonly [label: string, value: string])[];
};

// Values are plain text, but strip line/bidi controls so a material/code cannot forge receipt lines.
export function receiptLine(value: string): string {
  return value.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ');
}

export function receiptText(receipt: ReceiptText): string {
  return [
    receiptLine(receipt.title),
    receiptLine(receipt.privateNotice),
    '',
    ...receipt.fields.map(([label, value]) => `${receiptLine(label)}: ${receiptLine(value)}`),
    '',
    receiptLine(receipt.limitation),
    receiptLine(receipt.paymentNotice),
    receiptLine(receipt.disputeNotice),
    '',
  ].join('\n');
}

/** The filename must never contain a participant name, arbitrary path, or caller-controlled suffix. */
export function receiptFilename(reference: string): string {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reference)
    ? `taka-sats-receipt-${reference}.txt`
    : 'taka-sats-receipt.txt';
}
