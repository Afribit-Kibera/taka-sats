// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, expect, it, vi } from 'vitest';
import { UnauthorizedError, ForbiddenError } from '@/lib/auth/session';
vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/auth/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/session')>()),
  requireScope: vi.fn(),
}));
vi.mock('@/lib/db/client', () => ({ getDb: vi.fn(() => ({})) }));
vi.mock('@/lib/community/queries', () => ({ getCommunityReadiness: vi.fn() }));
vi.mock('@/lib/treasury/provider', () => ({ hotWallet: {} }));
import { requireScope } from '@/lib/auth/session';
import { getDb } from '@/lib/db/client';
import { getCommunityReadiness } from '@/lib/community/queries';
import { GET } from './route';
beforeEach(() => {
  vi.clearAllMocks();
});
it.each([401, 403])('denies %s before reading wallet/config/database facts', async (status) => {
  vi.mocked(requireScope).mockRejectedValue(
    status === 401 ? new UnauthorizedError() : new ForbiddenError('treasury:read'),
  );
  expect((await GET(new Request('http://localhost/api/v1/community/readiness'))).status).toBe(
    status,
  );
  expect(getDb).not.toHaveBeenCalled();
  expect(getCommunityReadiness).not.toHaveBeenCalled();
});
it('uses existing operator read scope and marks the snapshot no-store', async () => {
  vi.mocked(requireScope).mockResolvedValue({ id: 'test-operator', role: 'admin' } as never);
  vi.mocked(getCommunityReadiness).mockResolvedValue({
    community: { name: 'Test community' },
  } as never);
  const request = new Request('http://localhost/api/v1/community/readiness');
  const response = await GET(request);
  expect(requireScope).toHaveBeenCalledWith('treasury:read', request);
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(JSON.stringify(await response.json())).not.toMatch(/secret|password|key|token/i);
});
