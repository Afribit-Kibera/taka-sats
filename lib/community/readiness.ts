// SPDX-License-Identifier: AGPL-3.0-only
import type { Settings } from '@/lib/config';
import type { getOperatingWallet } from '@/lib/treasury/operating';

export type OperatingWallet = Awaited<ReturnType<typeof getOperatingWallet>>;
export type LaunchCheck = 'reserve' | 'blink' | 'funding' | 'session' | 'rates' | 'staff' | 'field';
export type CheckState = 'ready' | 'needs_setup' | 'unknown';
export type FieldReadiness = {
  activeSessions: number;
  publishedRates: number;
  freshExchangeRate: boolean;
  productionStaff: number;
  enrolledStaff: number;
  enrolledOperators: number;
  legacyStaff: number;
  nextSessionEnd: string | null;
};

/** A read-only snapshot, never authority to pay or proof of external custody. */
export function communityReadiness(
  settings: Settings,
  keyConfigured: boolean,
  wallet: OperatingWallet,
  field: FieldReadiness,
  now = new Date(),
) {
  const blinkConfigured =
    settings.lightning.float_provider === 'blink' &&
    !!settings.lightning.blink.float_wallet_id &&
    keyConfigured;
  const checks: Record<LaunchCheck, CheckState> = {
    reserve: settings.community.reserve.setup_confirmed ? 'ready' : 'needs_setup',
    blink: !blinkConfigured
      ? 'needs_setup'
      : wallet.hotWallet.available === null
        ? 'unknown'
        : 'ready',
    funding: !blinkConfigured
      ? 'needs_setup'
      : wallet.hotWallet.available === null
        ? 'unknown'
        : wallet.pendingPayouts.unpricedCount
          ? 'unknown'
          : wallet.hotWallet.available > 0 && (wallet.availableAfterQueueSats ?? 0) > 0
            ? 'ready'
            : 'needs_setup',
    session: field.activeSessions > 0 ? 'ready' : 'needs_setup',
    rates: field.publishedRates > 0 && field.freshExchangeRate ? 'ready' : 'needs_setup',
    staff:
      field.productionStaff >= 2 &&
      field.enrolledOperators > 0 &&
      field.productionStaff === field.enrolledStaff &&
      field.legacyStaff === 0
        ? 'ready'
        : 'needs_setup',
    field: settings.community.field_checks_confirmed ? 'ready' : 'needs_setup',
  };
  return {
    checkedAt: now.toISOString(),
    community: { name: settings.community.name, operator: settings.community.operator },
    reserve: {
      walletLabel: settings.community.reserve.wallet_label || null,
      requiredSignatures: settings.community.reserve.required_signatures,
      totalSigners: settings.community.reserve.total_signers,
      operatorConfirmed: settings.community.reserve.setup_confirmed,
    },
    paymentProvider: settings.lightning.float_provider,
    checks,
    checklistComplete: Object.values(checks).every((state) => state === 'ready'),
    field,
    wallet,
  };
}
export type CommunityReadiness = ReturnType<typeof communityReadiness>;
