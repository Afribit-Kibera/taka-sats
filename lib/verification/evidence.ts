// SPDX-License-Identifier: AGPL-3.0-only
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getSettings } from '@/lib/config';
import type { Database } from '@/lib/db/client';
import { collectionEvents, payouts } from '@/lib/db/schema';
import { appendEntryTx, payloadHash } from '@/lib/ledger';
import { getPhoto } from '@/lib/storage';
import { readScalePhoto, type ScaleReading } from './openrouter';

export function compareScaleReading(
  reading: ScaleReading,
  enteredKg: string,
  minimumConfidence: number,
  toleranceKg: number,
): 'matched' | 'mismatch' | 'unreadable' {
  if (
    !reading.scale_visible ||
    reading.unit !== 'kg' ||
    reading.weight_kg === null ||
    reading.confidence < minimumConfidence ||
    !/^\d+(?:\.\d{1,3})?$/.test(String(reading.weight_kg))
  ) {
    return 'unreadable';
  }
  const differenceMilli = Math.abs(
    Math.round(reading.weight_kg * 1000) - Math.round(Number(enteredKg) * 1000),
  );
  return differenceMilli > Math.round(toleranceKg * 1000) ? 'mismatch' : 'matched';
}

/** Idempotent derived evidence, serialized per payout. Never changes the frozen collection facts. */
export async function ensureEvidence(db: Database, eventId: string): Promise<string> {
  const config = getSettings().verification;
  if (config.provider === 'none') {
    return 'manual';
  }
  return db.transaction(async (tx) => {
    // Same payout -> event -> ledger ordering as reviewer operations; bounded upstream timeout.
    const [payout] = await tx
      .select()
      .from(payouts)
      .where(eq(payouts.collectionEventId, eventId))
      .for('update');
    const [event] = await tx
      .select()
      .from(collectionEvents)
      .where(eq(collectionEvents.id, eventId))
      .for('update');
    if (!event || !payout) {
      throw new Error('evidence_event_missing');
    }
    if (
      ['sending', 'paid'].includes(payout.status) ||
      ['matched', 'mismatch', 'unreadable', 'invalid'].includes(event.evidenceStatus)
    ) {
      return event.evidenceStatus;
    }
    const photo = await getPhoto(event.photoSha256).catch(() => null);
    if (!photo) {
      return 'pending';
    }
    const actualHash = createHash('sha256').update(photo.bytes).digest('hex');
    let status: 'matched' | 'mismatch' | 'unreadable' | 'invalid' =
      actualHash !== event.photoSha256 ? 'invalid' : 'unreadable';
    let reading: ScaleReading | null = null;
    let reason = actualHash !== event.photoSha256 ? 'photo_hash_mismatch' : null;
    if (!reason) {
      try {
        reading = await readScalePhoto(photo, config);
        status = compareScaleReading(
          reading,
          event.weightKg,
          config.min_confidence,
          config.weight_tolerance_kg,
        );
      } catch {
        reason = 'evidence_unavailable';
      }
    }
    await appendEntryTx(tx, {
      entryType: 'correction',
      referencesId: event.ledgerEntryId,
      payloadHash: await payloadHash({
        kind: 'scale_evidence',
        eventId,
        photoSha256: event.photoSha256,
        model: config.model,
        status,
        reading,
        reason,
      }),
    });
    await tx
      .update(collectionEvents)
      .set({
        evidenceStatus: status,
        ocrWeightKg:
          status === 'unreadable' ||
          status === 'invalid' ||
          reading?.weight_kg === null ||
          reading?.weight_kg === undefined
            ? null
            : String(reading.weight_kg),
        // A scale comparison alone is not the complete V1 protocol (GPS/material audit remains separate).
        verificationStatus: status === 'matched' ? 'verified' : 'pending_supervisor_review',
      })
      .where(eq(collectionEvents.id, eventId));
    await tx
      .update(payouts)
      .set({ approvedBy: null, approvedAt: null, reviewRiskHash: null })
      .where(eq(payouts.id, payout.id));
    return status;
  });
}
