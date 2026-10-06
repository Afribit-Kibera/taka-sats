// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from '@playwright/test';
import { ADMINS } from './fixtures/accounts';
import { login } from './helpers';

test('dashboard bearer key is scoped, revocable and never a browser login', async ({
  page,
  browser,
}) => {
  await login(page, ADMINS[0], '/admin');
  const response = await page.request.post('/api/v1/api-keys', {
    data: {
      name: 'E2E dashboard',
      scopes: ['payout:read'],
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    },
  });
  expect(response.status()).toBe(201);
  expect(response.headers()['cache-control']).toContain('no-store');
  const created = (await response.json()) as { key: { id: string }; token: string };
  const headers = { Authorization: `Bearer ${created.token}` };
  try {
    expect((await page.request.get('/api/v1/payouts', { headers })).status()).toBe(200);
    expect((await page.request.get('/api/v1/sessions', { headers })).status()).toBe(403);
    expect((await page.request.get('/api/v1/api-keys', { headers })).status()).toBe(403);
    // A valid cookie must not rescue an invalid bearer.
    expect(
      (
        await page.request.get('/api/v1/payouts', {
          headers: { Authorization: 'Bearer invalid' },
        })
      ).status(),
    ).toBe(401);
    const context = await browser.newContext({ extraHTTPHeaders: headers });
    try {
      const signedOut = await context.newPage();
      await signedOut.goto('/admin');
      await expect(signedOut).toHaveURL(/\/login$/);
    } finally {
      await context.close();
    }
  } finally {
    expect((await page.request.post(`/api/v1/api-keys/${created.key.id}/revoke`)).status()).toBe(
      200,
    );
  }
  expect((await page.request.get('/api/v1/payouts', { headers })).status()).toBe(401);
});
