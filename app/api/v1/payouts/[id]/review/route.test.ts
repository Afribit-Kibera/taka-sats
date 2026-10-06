// SPDX-License-Identifier: AGPL-3.0-only

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from 'next-auth';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/jobs', () => ({ enqueueProcessPayoutSafely: vi.fn(async () => undefined) }));
vi.mock('@/lib/db/client', () => ({ getDb: vi.fn(() => ({})) }));
vi.mock('@/lib/payouts', async (original) => ({
  ...(await original<typeof import('@/lib/payouts')>()),
  reviewPayout: vi.fn(),
  getPayoutView: vi.fn(async () => ({ id: ID, status: 'queued' })),
}));
import { auth } from '@/auth';
import { enqueueProcessPayoutSafely } from '@/lib/jobs';
import { reviewPayout } from '@/lib/payouts';
import { POST } from './route';

const ID = '00000000-0000-4000-8000-000000000001';
const authMock = auth as unknown as { mockResolvedValue: (value: Session | null) => void };
function signedIn(role: 'admin' | 'hub_lead' | 'supervisor' | 'partner') {
  authMock.mockResolvedValue({ user: { id: ID, role, locale: 'en' }, expires: '2099-01-01' });
}
function request(body: unknown) {
  return new NextRequest(`https://localhost/api/v1/payouts/${ID}/review`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
const params = { params: Promise.resolve({ id: ID }) };

describe('payout review route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(null);
  });
  it('requires authentication before reading the submitted body', async () => {
    expect((await POST(request({}), params)).status).toBe(401);
    expect(reviewPayout).not.toHaveBeenCalled();
  });
  it.each(['supervisor', 'partner'] as const)(
    'denies %s even on an approval request',
    async (role) => {
      signedIn(role);
      expect(
        (await POST(request({ decision: 'approved', reason: 'Checked' }), params)).status,
      ).toBe(403);
      expect(reviewPayout).not.toHaveBeenCalled();
    },
  );
  it.each([
    {},
    { decision: 'paid', reason: 'Checked' },
    { decision: 'approved', reason: '' },
    { decision: 'approved', reason: 'Checked', amountSats: 5000 },
    { decision: 'approved', reason: 'Checked', address: 'override@wallet.example' },
  ])('rejects invalid or money-bearing input %j', async (body) => {
    signedIn('admin');
    expect((await POST(request(body), params)).status).toBe(400);
    expect(reviewPayout).not.toHaveBeenCalled();
  });
  it.each(['admin', 'hub_lead'] as const)(
    'queues worker after a distinct %s approval, never pays in route',
    async (role) => {
      signedIn(role);
      vi.mocked(reviewPayout).mockResolvedValue({
        payout: { id: ID } as Awaited<ReturnType<typeof reviewPayout>>['payout'],
        changed: true,
      });
      expect(
        (await POST(request({ decision: 'approved', reason: 'Scale checked' }), params)).status,
      ).toBe(200);
      expect(enqueueProcessPayoutSafely).toHaveBeenCalledExactlyOnceWith({ payoutId: ID });
      expect(reviewPayout).toHaveBeenCalledWith(
        {},
        { payoutId: ID, actor: { id: ID, role }, decision: 'approved', reason: 'Scale checked' },
      );
    },
  );
  it.each(['rejected', 'reweigh'] as const)('does not enqueue a %s decision', async (decision) => {
    signedIn('admin');
    vi.mocked(reviewPayout).mockResolvedValue({
      payout: { id: ID } as Awaited<ReturnType<typeof reviewPayout>>['payout'],
      changed: true,
    });
    expect((await POST(request({ decision, reason: 'New evidence needed' }), params)).status).toBe(
      200,
    );
    expect(enqueueProcessPayoutSafely).not.toHaveBeenCalled();
  });
});
