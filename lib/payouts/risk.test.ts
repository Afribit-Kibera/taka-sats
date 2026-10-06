// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest';
import { payoutRiskReasons, type RiskFacts, type RiskPolicy } from './risk';
import { payoutReviewSchema } from './review';

const facts: RiskFacts = {
  weightKg: '8.400',
  ocrWeightKg: '8.400',
  evidenceStatus: 'matched',
  duplicatePhoto: false,
  outsideBounds: false,
  sessionValid: true,
  verificationStatus: 'verified',
  flags: [],
  fiatMinor: 16800,
};
const policy: RiskPolicy = {
  ocrRequired: true,
  toleranceKg: 0.1,
  maxWeightKg: 100,
  thresholdFiatMinor: 100000,
};

describe('payout risk policy', () => {
  it('ordinary verified work needs no second person', () => {
    expect(payoutRiskReasons(facts, policy)).toEqual([]);
  });
  it('holds an inflated entry; never replaces the recorded kilograms', () => {
    expect(payoutRiskReasons({ ...facts, weightKg: '18.400' }, policy)).toContain(
      'weight_mismatch',
    );
    expect(facts.weightKg).toBe('8.400');
  });
  it('compares milli-kg exactly at the configured tolerance', () => {
    expect(payoutRiskReasons({ ...facts, ocrWeightKg: '8.300' }, policy)).toEqual([]);
    expect(payoutRiskReasons({ ...facts, ocrWeightKg: '8.299' }, policy)).toContain(
      'weight_mismatch',
    );
  });
  it('holds an explicit mismatch even when no readable number is available', () => {
    expect(
      payoutRiskReasons({ ...facts, ocrWeightKg: null, evidenceStatus: 'mismatch' }, policy),
    ).toContain('weight_mismatch');
  });
  it('required OCR cannot be bypassed by claiming matched without a reading', () => {
    expect(payoutRiskReasons({ ...facts, ocrWeightKg: null }, policy)).toContain(
      'evidence_pending',
    );
  });
  it('unreadable evidence holds without losing the collection', () => {
    expect(
      payoutRiskReasons({ ...facts, ocrWeightKg: null, evidenceStatus: 'unreadable' }, policy),
    ).toContain('evidence_unreadable');
  });
  it('explicit V0 policy permits manual evidence but never an OCR disagreement', () => {
    expect(
      payoutRiskReasons(
        { ...facts, evidenceStatus: 'manual', ocrWeightKg: null },
        { ...policy, ocrRequired: false },
      ),
    ).toEqual([]);
    expect(
      payoutRiskReasons(
        { ...facts, evidenceStatus: 'mismatch', ocrWeightKg: null },
        { ...policy, ocrRequired: false },
      ),
    ).toContain('weight_mismatch');
  });
  it('fiat threshold is inclusive and independent of Bitcoin exchange fluctuations', () => {
    expect(payoutRiskReasons({ ...facts, fiatMinor: 100000 }, policy)).toEqual([]);
    expect(payoutRiskReasons({ ...facts, fiatMinor: 100001 }, policy)).toContain(
      'payout_threshold',
    );
  });
  it.each([
    [{ duplicatePhoto: true }, 'duplicate_photo'],
    [{ outsideBounds: true }, 'gps_out_of_bounds'],
    [{ locationUnavailable: true }, 'gps_unavailable'],
    [{ weightKg: '100.001', ocrWeightKg: '100.001' }, 'weight_outlier'],
    [{ sessionValid: false }, 'session_not_valid'],
    [{ verificationStatus: 'pending_supervisor_review' }, 'collection_not_verified'],
    [{ flags: ['mass_balance_variance'] }, 'mass_balance_variance'],
  ] as const)('holds risky facts %j', (change, code) => {
    expect(payoutRiskReasons({ ...facts, ...change }, policy)).toContain(code);
  });
  it('review bodies cannot supply amount or destination', () => {
    expect(
      payoutReviewSchema.safeParse({
        decision: 'approved',
        reason: 'Evidence checked',
        amountSats: 999999,
        address: 'untrusted@wallet.example',
      }).success,
    ).toBe(false);
    expect(payoutReviewSchema.safeParse({ decision: 'approved', reason: ' ' }).success).toBe(false);
  });
});
