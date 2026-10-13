// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest';
import { loadSettings } from '@/lib/config';
import { communityReadiness, type FieldReadiness, type OperatingWallet } from './readiness';

const field: FieldReadiness = {
  activeSessions: 1,
  publishedRates: 3,
  freshExchangeRate: true,
  productionStaff: 6,
  enrolledStaff: 6,
  enrolledOperators: 1,
  legacyStaff: 0,
  nextSessionEnd: null,
};
const wallet: OperatingWallet = {
  hotWallet: { available: 10000, asOf: new Date(), lowBalance: false, error: null },
  pendingPayouts: { count: 1, totalSats: 500, unpricedCount: 0 },
  estimatedRequiredFloatSats: 500,
  availableAfterQueueSats: 9500,
  lowBalanceThresholdSats: 5000,
  insufficientFunds: false,
  fundingManagedExternally: true,
  approvalMode: 'risk_based',
};
function settings(confirmed = false) {
  return loadSettings({
    env: {
      TAKASATS__LIGHTNING__BLINK__FLOAT_WALLET_ID: 'test-btc-wallet',
      ...(confirmed
        ? {
            TAKASATS__COMMUNITY__RESERVE__WALLET_LABEL: 'Test member reserve',
            TAKASATS__COMMUNITY__RESERVE__REQUIRED_SIGNATURES: '2',
            TAKASATS__COMMUNITY__RESERVE__TOTAL_SIGNERS: '3',
            TAKASATS__COMMUNITY__RESERVE__SETUP_CONFIRMED: 'true',
            TAKASATS__COMMUNITY__FIELD_CHECKS_CONFIRMED: 'true',
          }
        : {}),
    },
  });
}
describe('managed community readiness', () => {
  it('never invents completed reserve or physical field checks from a funded wallet', () => {
    const result = communityReadiness(settings(), true, wallet, field);
    expect(result.checks.reserve).toBe('needs_setup');
    expect(result.checks.field).toBe('needs_setup');
    expect(result.checklistComplete).toBe(false);
  });
  it('requires both operator confirmation and the complete operational snapshot', () => {
    const result = communityReadiness(settings(true), true, wallet, field);
    expect(result.checklistComplete).toBe(true);
    expect(result.reserve.operatorConfirmed).toBe(true);
    expect(communityReadiness(settings(true), false, wallet, field).checklistComplete).toBe(false);
  });
  it('preserves unknown provider balance instead of claiming empty or funded', () => {
    const result = communityReadiness(
      settings(true),
      true,
      {
        ...wallet,
        hotWallet: { available: null, asOf: null, lowBalance: null, error: 'float_unavailable' },
        availableAfterQueueSats: null,
      },
      field,
    );
    expect(result.checks.blink).toBe('unknown');
    expect(result.checks.funding).toBe('unknown');
    expect(result.wallet.hotWallet.available).toBeNull();
    expect(result.checklistComplete).toBe(false);
  });
  it.each([0, -1])('does not pass funding when queue coverage leaves %s sats', (left) => {
    expect(
      communityReadiness(settings(true), true, { ...wallet, availableAfterQueueSats: left }, field)
        .checks.funding,
    ).toBe('needs_setup');
  });
  it('unpriced work cannot be treated as fully funded', () => {
    const result = communityReadiness(
      settings(true),
      true,
      { ...wallet, pendingPayouts: { count: 2, totalSats: 500, unpricedCount: 1 } },
      field,
    );
    expect(result.checks.funding).toBe('unknown');
    expect(result.checklistComplete).toBe(false);
  });
  it('a positive simulated wallet is not production Blink funding', () => {
    const demo = loadSettings({ env: { TAKASATS__LIGHTNING__FLOAT_PROVIDER: 'fake' } });
    const result = communityReadiness(demo, false, wallet, field);
    expect(result.checks.blink).toBe('needs_setup');
    expect(result.checks.funding).toBe('needs_setup');
    expect(result.checklistComplete).toBe(false);
  });
  it.each([
    { ...field, activeSessions: 0 },
    { ...field, publishedRates: 0 },
    { ...field, freshExchangeRate: false },
    { ...field, enrolledStaff: 5 },
    { ...field, enrolledOperators: 0 },
    { ...field, legacyStaff: 1 },
  ])('incomplete shift/rates/phone access/legacy accounts cannot yield complete', (incomplete) => {
    expect(communityReadiness(settings(true), true, wallet, incomplete).checklistComplete).toBe(
      false,
    );
  });
});
