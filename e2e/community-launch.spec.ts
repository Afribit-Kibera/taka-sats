// SPDX-License-Identifier: AGPL-3.0-only
import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { ADMINS, FIELD_SUPERVISOR, HUB_LEAD } from './fixtures/accounts';
import { audit, login } from './helpers';

const shots = path.resolve('output/playwright/community-launch');
test('public launch content and funding guide reflow on phone and desktop', async ({ page }) => {
  await page.route('**/api/v1/stats/summary', (route) =>
    route.fulfill({ status: 503, body: '{}' }),
  );
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
          page.getByRole('heading', { name: 'Fund the work. Keep custody and claims clear.' }),
        ).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (width === 390) await audit(page, route);
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

test('public Docs show independent setup and explicit network limits on phone and desktop', async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    for (const route of [
      '/docs',
      '/docs/purpose',
      '/docs/run-your-community',
      '/docs/open-source',
      '/docs/records-and-claims',
      '/docs/field-integrity',
      '/docs/community-network',
      '/docs/benchmark',
      '/communities',
    ]) {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (width === 390) await audit(page, route);
      await page.screenshot({
        path: path.join(shots, `${width}-${route.slice(1).replaceAll('/', '-')}.png`),
        fullPage: true,
      });
    }
  }
  await page.goto('/docs/run-your-community');
  await expect(
    page.getByText('git clone https://github.com/Afribit-Kibera/taka-sats.git', { exact: false }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Open source and independence', exact: true }).click();
  await expect(page).toHaveURL(/\/docs\/open-source$/);
  expect((await page.request.get('/docs/unknown-private-document')).status()).toBe(404);
  expect(errors).toEqual([]);
});

test('public local stats show unavailable rather than zero or invented network totals', async ({
  page,
}) => {
  await page.route('**/api/v1/stats/summary', (route) =>
    route.fulfill({ status: 503, body: '{}' }),
  );
  await page.goto('/');
  await expect(page.getByText('Unavailable', { exact: true })).toHaveCount(4);
  await expect(page.getByText('Kibera · Local records', { exact: true })).toBeVisible();
  await expect(page.getByText(/no global total is claimed/)).toBeVisible();
  await page.getByRole('link', { name: 'Docs', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Taka Sats Docs', exact: true })).toBeVisible();
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
