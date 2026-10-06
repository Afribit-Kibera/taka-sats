// SPDX-License-Identifier: AGPL-3.0-only
import { inArray, sql } from 'drizzle-orm';
import { getSettings } from '@/lib/config';
import type { Database } from '@/lib/db/client';
import { payouts } from '@/lib/db/schema';
import type { FloatReader } from './topups';

/** Operational read-only float; funding and treasury governance take place outside this app. */
export async function getOperatingWallet(db: Database, provider: FloatReader) {
  const threshold = getSettings().payouts.float_low_balance_alert_sats;
  const [pending] = await db
    .select({
      count: sql<number>`count(*)::int`,
      total: sql<string>`coalesce(sum(${payouts.amountSats}), 0)::text`,
      unpriced: sql<number>`count(*) filter (where ${payouts.amountSats} is null)::int`,
    })
    .from(payouts)
    .where(
      inArray(payouts.status, [
        'awaiting_rate',
        'awaiting_destination',
        'pending_approval',
        'pending_float',
        'queued',
        'sending',
      ]),
    );
  let available: number | null = null;
  let asOf: Date | null = null;
  try {
    const balance = await provider.getFloatBalance();
    available = balance.available;
    asOf = balance.asOf;
  } catch {
    /* Unknown is not a zero balance. */
  }
  const totalSats = Number(pending?.total ?? 0);
  return {
    hotWallet: {
      available,
      asOf,
      lowBalance: available === null ? null : available < threshold,
      error: available === null ? 'float_unavailable' : null,
    },
    pendingPayouts: {
      count: pending?.count ?? 0,
      totalSats,
      unpricedCount: pending?.unpriced ?? 0,
    },
    estimatedRequiredFloatSats: totalSats,
    availableAfterQueueSats: available === null ? null : available - totalSats,
    lowBalanceThresholdSats: threshold,
    insufficientFunds: available === null ? null : available < totalSats,
    fundingManagedExternally: true,
    approvalMode: getSettings().payouts.approval_mode,
  };
}
