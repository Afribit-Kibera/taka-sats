// SPDX-License-Identifier: AGPL-3.0-only

/** Risk policy does not alter the signed collection or its kilograms. */
import { and, eq, ne, or, sql } from 'drizzle-orm';
import type { Queryable } from '@/lib/db/client';
import {
  anomalyFlags,
  collectionEvents,
  ledgerEntries,
  payouts,
  sessions,
  sessionSupervisors,
} from '@/lib/db/schema';
import { getSettings } from '@/lib/config';
import { pointInRing } from '@/lib/fraud/geo';
import { runEventDetectors } from '@/lib/fraud/detectors';
import { payloadHash } from '@/lib/ledger';
import { geoBoundsSchema } from '@/lib/sessions';
import { PayoutNotFoundError } from './errors';

export type RiskFacts = {
  readonly weightKg: string;
  readonly ocrWeightKg: string | null;
  readonly evidenceStatus: string;
  readonly duplicatePhoto: boolean;
  readonly outsideBounds: boolean;
  readonly locationUnavailable?: boolean;
  readonly sessionValid: boolean;
  readonly verificationStatus: string;
  readonly flags: readonly string[];
  readonly fiatMinor: number;
};

export type RiskPolicy = {
  readonly ocrRequired: boolean;
  readonly toleranceKg: number;
  readonly maxWeightKg: number;
  readonly thresholdFiatMinor: number;
};

/** Exact milli-kg comparison: a binary float must not decide whether the tolerance was exceeded. */
function milliKg(value: string): bigint {
  if (!/^\d+(?:\.\d{1,3})?$/.test(value)) throw new Error('Invalid scale weight');
  const [whole = '0', fraction = ''] = value.split('.');
  return BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, '0'));
}

export function payoutRiskReasons(facts: RiskFacts, policy: RiskPolicy): string[] {
  const reasons = new Set<string>();
  if (!facts.sessionValid) reasons.add('session_not_valid');
  if (facts.evidenceStatus === 'invalid') reasons.add('photo_hash_mismatch');
  if (facts.verificationStatus !== 'verified') reasons.add('collection_not_verified');
  if (facts.duplicatePhoto) reasons.add('duplicate_photo');
  if (facts.outsideBounds) reasons.add('gps_out_of_bounds');
  if (facts.locationUnavailable) reasons.add('gps_unavailable');
  if (milliKg(facts.weightKg) > milliKg(policy.maxWeightKg.toFixed(3)))
    reasons.add('weight_outlier');
  if (facts.evidenceStatus === 'mismatch') reasons.add('weight_mismatch');
  if (facts.ocrWeightKg !== null) {
    const difference = milliKg(facts.weightKg) - milliKg(facts.ocrWeightKg);
    if ((difference < 0n ? -difference : difference) > milliKg(policy.toleranceKg.toFixed(3))) {
      reasons.add('weight_mismatch');
    }
  }
  if (policy.ocrRequired && (facts.evidenceStatus !== 'matched' || facts.ocrWeightKg === null)) {
    reasons.add(facts.evidenceStatus === 'unreadable' ? 'evidence_unreadable' : 'evidence_pending');
  }
  if (facts.fiatMinor > policy.thresholdFiatMinor) reasons.add('payout_threshold');
  for (const flag of facts.flags) {
    reasons.add(flag === 'gps_outlier' ? 'gps_out_of_bounds' : flag);
  }
  return [...reasons].sort();
}

/** Snapshot reviewed by a human. New evidence, destination or flags invalidates the old review. */
export async function assessPayoutRisk(
  db: Queryable,
  payout: Pick<
    typeof payouts.$inferSelect,
    'collectionEventId' | 'destinationId' | 'amountFiatMinor'
  >,
): Promise<{ readonly reasons: string[]; readonly hash: string; readonly photoSha256: string }> {
  // Never race the best-effort post-ingest detectors. Their idempotent checks must complete
  // before payment or a reviewed snapshot can be accepted; failures retry without sending.
  await runEventDetectors(db, payout.collectionEventId, { strict: true });
  const [event] = await db
    .select({
      event: collectionEvents,
      geoBounds: sessions.geoBounds,
      start: sessions.scheduledStart,
      end: sessions.scheduledEnd,
    })
    .from(collectionEvents)
    .leftJoin(sessions, eq(sessions.id, collectionEvents.sessionId))
    .where(eq(collectionEvents.id, payout.collectionEventId));
  if (!event) throw new PayoutNotFoundError(`collection event ${payout.collectionEventId}`);
  const detail = event.event;
  const [assigned] = detail.sessionId
    ? await db
        .select({ id: sessionSupervisors.supervisorId })
        .from(sessionSupervisors)
        .where(
          and(
            eq(sessionSupervisors.sessionId, detail.sessionId),
            eq(sessionSupervisors.supervisorId, detail.supervisorId),
          ),
        )
        .limit(1)
    : [];
  const [duplicate] = await db
    .select({ id: collectionEvents.id })
    .from(collectionEvents)
    .innerJoin(ledgerEntries, eq(ledgerEntries.id, collectionEvents.ledgerEntryId))
    .where(
      and(eq(collectionEvents.photoSha256, detail.photoSha256), ne(collectionEvents.id, detail.id)),
    )
    .limit(1);
  const flags = await db
    .select({ id: anomalyFlags.id, type: anomalyFlags.flagType })
    .from(anomalyFlags)
    .where(
      and(
        sql`coalesce(${anomalyFlags.reviewOutcome}, '') <> 'dismissed'`,
        or(
          eq(anomalyFlags.collectionEventId, detail.id),
          and(
            eq(anomalyFlags.flagType, 'mass_balance_variance'),
            or(
              eq(anomalyFlags.supervisorId, detail.supervisorId),
              ...(detail.sessionId ? [eq(anomalyFlags.sessionId, detail.sessionId)] : []),
            ),
          ),
        ),
      ),
    );
  const bounds = geoBoundsSchema.safeParse(event.geoBounds);
  const ring = bounds.success ? bounds.data.coordinates[0] : undefined;
  const outsideBounds = Boolean(
    ring &&
    detail.gpsLat !== null &&
    detail.gpsLng !== null &&
    !pointInRing(Number(detail.gpsLat), Number(detail.gpsLng), ring),
  );
  const { verification, payouts: policy } = getSettings();
  const facts: RiskFacts = {
    weightKg: detail.weightKg,
    ocrWeightKg: detail.ocrWeightKg,
    evidenceStatus: detail.evidenceStatus,
    duplicatePhoto: Boolean(duplicate),
    outsideBounds,
    locationUnavailable: Boolean(ring && (detail.gpsLat === null || detail.gpsLng === null)),
    sessionValid: Boolean(
      assigned &&
      event.start &&
      event.end &&
      detail.recordedAt >= event.start &&
      detail.recordedAt <= event.end,
    ),
    verificationStatus: detail.verificationStatus,
    flags: flags.map((flag) => flag.type).sort(),
    fiatMinor: payout.amountFiatMinor ?? 0,
  };
  const reasons = payoutRiskReasons(facts, {
    ocrRequired: verification.ocr_required_for_autopay,
    toleranceKg: verification.weight_tolerance_kg,
    maxWeightKg: verification.max_autopay_weight_kg,
    thresholdFiatMinor: policy.review_threshold_fiat_minor,
  });
  return {
    reasons,
    photoSha256: detail.photoSha256,
    hash: await payloadHash({
      facts,
      reasons,
      photoSha256: detail.photoSha256,
      destinationId: payout.destinationId,
      flagIds: flags.map((flag) => flag.id).sort(),
    }),
  };
}
