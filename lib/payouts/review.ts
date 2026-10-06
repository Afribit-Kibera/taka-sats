// SPDX-License-Identifier: AGPL-3.0-only

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { roleHasScope, type Role } from '@/lib/auth/permissions';
import type { Database } from '@/lib/db/client';
import { collectionEvents, payouts } from '@/lib/db/schema';
import { appendEntryTx, payloadHash } from '@/lib/ledger';
import { photoUrlFor } from '@/lib/storage';
import { PayoutApprovalError, PayoutNotFoundError, PayoutStateError } from './errors';
import type { PayoutRecord } from './process';
import { assessPayoutRisk } from './risk';

export const payoutReviewSchema = z.strictObject({
  decision: z.enum(['approved', 'rejected', 'reweigh']),
  reason: z.string().trim().min(1).max(1000),
});
export type PayoutReviewInput = z.infer<typeof payoutReviewSchema>;

/** Exception handling is not a payment API: no amount or address is accepted. */
export async function reviewPayout(
  db: Database,
  input: PayoutReviewInput & {
    readonly payoutId: string;
    readonly actor: { readonly id: string; readonly role: Role };
  },
  now = new Date(),
): Promise<{ readonly payout: PayoutRecord; readonly changed: boolean }> {
  if (!roleHasScope(input.actor.role, 'payout:approve'))
    throw new PayoutApprovalError('not_permitted');
  const { decision, reason } = payoutReviewSchema.parse({
    decision: input.decision,
    reason: input.reason,
  });
  return db.transaction(async (tx) => {
    const [payout] = await tx
      .select()
      .from(payouts)
      .where(eq(payouts.id, input.payoutId))
      .for('update');
    if (!payout) throw new PayoutNotFoundError(`payout ${input.payoutId}`);
    const [event] = await tx
      .select({
        recorder: collectionEvents.supervisorId,
        ledgerEntryId: collectionEvents.ledgerEntryId,
      })
      .from(collectionEvents)
      .where(eq(collectionEvents.id, payout.collectionEventId));
    if (event?.recorder === input.actor.id) throw new PayoutApprovalError('self_approval');
    // Repeating the final decision is harmless; a conflicting decision is never a silent edit.
    if (payout.reviewDecision === decision && payout.status !== 'pending_approval') {
      return { payout, changed: false };
    }
    if (payout.status !== 'pending_approval') throw new PayoutStateError(payout.status, 'review');
    const risk = await assessPayoutRisk(tx, payout);
    if (decision === 'approved' && risk.reasons.includes('photo_hash_mismatch')) {
      throw new PayoutStateError('photo_hash_mismatch', 'approve');
    }
    if (decision === 'approved' && !(await photoUrlFor(risk.photoSha256))) {
      throw new PayoutStateError('photo_missing', 'approve');
    }
    await appendEntryTx(tx, {
      entryType: 'correction',
      referencesId: event?.ledgerEntryId ?? payout.collectionEventId,
      payloadHash: await payloadHash({
        type: 'payout_review',
        payoutId: payout.id,
        collectionEventId: payout.collectionEventId,
        decision,
        reason,
        reviewedBy: input.actor.id,
        reviewedAt: now.toISOString(),
        riskHash: risk.hash,
      }),
    });
    const [reviewed] = await tx
      .update(payouts)
      .set({
        reviewDecision: decision,
        reviewedBy: input.actor.id,
        reviewedAt: now,
        reviewReason: reason,
        reviewRiskHash: risk.hash,
        approvedBy: decision === 'approved' ? input.actor.id : null,
        approvedAt: decision === 'approved' ? now : null,
        status: decision === 'approved' ? 'queued' : 'failed',
        lastError:
          decision === 'approved'
            ? null
            : decision === 'rejected'
              ? 'review_rejected'
              : 'reweigh_required',
      })
      .where(eq(payouts.id, payout.id))
      .returning();
    if (!reviewed) throw new PayoutStateError('unknown', 'review');
    return { payout: reviewed, changed: true };
  });
}
