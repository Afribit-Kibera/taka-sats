// SPDX-License-Identifier: AGPL-3.0-only
import type { Session } from 'next-auth';
import { describe, expect, it, vi } from 'vitest';
vi.mock('@/auth', () => ({ auth: vi.fn() }));
import { auth } from '@/auth';
import { POST as PROPOSE } from './topups/route';
import { POST as SIGNOFF } from './topups/[id]/signoff/route';
import { POST as TRANSFER } from './topups/[id]/transfer/route';
import { POST as CANCEL } from './topups/[id]/cancel/route';
import { POST as REJECT } from './topups/[id]/reject/route';
import { POST as CONFIRM } from './topups/[id]/confirm/route';
const authMock = auth as unknown as { mockResolvedValue: (value: Session | null) => void };
const mutations = [PROPOSE, SIGNOFF, TRANSFER, CANCEL, REJECT, CONFIRM];
describe('external treasury: historical governance cannot mutate through any route', () => {
  it.each(mutations)('denies anonymous requests', async (call) => {
    authMock.mockResolvedValue(null);
    expect((await call(new Request('https://example.test/api/v1/treasury'))).status).toBe(401);
  });
  it.each(mutations)('denies field supervisors and partners', async (call) => {
    for (const role of ['supervisor', 'partner'] as const) {
      authMock.mockResolvedValue({
        user: { id: 'example', role, locale: 'en' },
        expires: '2099-01-01',
      });
      expect((await call(new Request('https://example.test/api/v1/treasury'))).status).toBe(403);
    }
  });
  it.each(mutations)('returns 410 to staff without database access', async (call) => {
    for (const role of ['admin', 'hub_lead'] as const) {
      authMock.mockResolvedValue({
        user: { id: 'example', role, locale: 'en' },
        expires: '2099-01-01',
      });
      const response = await call(new Request('https://example.test/api/v1/treasury'));
      expect(response.status).toBe(410);
      expect((await response.json()).error.code).toBe('feature_removed');
    }
  });
});
