// SPDX-License-Identifier: AGPL-3.0-only
import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { ADMINS, FIELD_SUPERVISOR, HUB_LEAD } from './fixtures/accounts';
import { audit, login } from './helpers';

const shots = path.resolve('output/playwright/community-launch');
test('public launch content and funding guide reflow on phone and desktop', async ({ page }) => {
  test.setTimeout(120000);
  await fs.mkdir(shots, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    for (const route of ['/', '/about', '/start-community']) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      if (route !== '/start-community')
        await expect(
          page.getByRole('heading', { name: 'Members hold the reserve. Blink pays for the work.' }),
        ).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: path.join(shots, `${width}-${route.slice(1) || 'home'}.png`),
        fullPage: true,
      });
    }
  }
  await expect(
    page.getByRole('heading', { name: /Fund Blink before inviting collectors/ }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Open operator checklist' }).click();
  await page.waitForURL(/\/login/);
  expect(errors).toEqual([]);
});

test('operators see honest setup status; public and field staff cannot read it', async ({
  page,
  browser,
}) => {
  await login(page, ADMINS[0], '/community-setup');
  await expect(page.getByRole('heading', { name: 'Community launch checklist' })).toBeVisible();
  await expect(
    page.getByText(/^External reserve setup has not been confirmed for this deployment\./),
  ).toBeVisible();
  const response = await page.request.get('/api/v1/community/readiness');
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toContain('no-store');
  const body = await response.json();
  expect(body.checklistComplete).toBe(false);
  expect(body.paymentProvider).toBe('fake');
  expect(body.checks.reserve).toBe('needs_setup');
  expect(body.reserve).toMatchObject({
    walletLabel: 'BlueWallet Vault',
    requiredSignatures: 2,
    totalSigners: 3,
    operatorConfirmed: false,
  });
  expect(body.checks.field).toBe('needs_setup');
  expect(body.checks.funding).toBe('needs_setup');
  expect(body.field.legacyStaff).toBeGreaterThan(0);
  expect(JSON.stringify(body)).not.toMatch(/BLINK_API_KEY|passwordHash|walletId|nonceHash/);
  await page.setViewportSize({ width: 360, height: 740 });
  await audit(page, '/community-setup');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: path.join(shots, '360-operator-checklist.png'), fullPage: true });
  const anon = await browser.newContext();
  expect(
    (await anon.request.get(new URL('/api/v1/community/readiness', page.url()).href)).status(),
  ).toBe(401);
  await anon.close();
  await page.context().clearCookies();
  await login(page, FIELD_SUPERVISOR, '/weigh');
  expect((await page.request.get('/api/v1/community/readiness')).status()).toBe(403);
  await page.context().clearCookies();
  await login(page, HUB_LEAD, '/community-setup');
  expect((await page.request.get('/api/v1/community/readiness')).status()).toBe(200);
});
