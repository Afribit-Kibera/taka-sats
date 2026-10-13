// SPDX-License-Identifier: AGPL-3.0-only
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { FIELD_SUPERVISOR } from './fixtures/accounts';
import { login } from './helpers';

test('first field load requests camera/location, releases camera, and leaves NFC optional', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const count = (key: string) =>
      sessionStorage.setItem(key, String(Number(sessionStorage.getItem(key) ?? '0') + 1));
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: async () => {
          count('qa-camera');
          return { getTracks: () => [{ stop: () => count('qa-stopped') }] };
        },
      },
    });
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: (_ok: unknown, fail: (e: { code: number }) => void) => {
          count('qa-location');
          fail({ code: 1 });
        },
      },
    });
    class Reader extends EventTarget {
      async scan(options: { signal?: AbortSignal }) {
        count('qa-nfc');
        options.signal?.addEventListener('abort', () => count('qa-nfc-stopped'), { once: true });
      }
    }
    Object.defineProperty(globalThis, 'NDEFReader', { value: Reader });
  });
  await login(page, FIELD_SUPERVISOR, '/weigh');
  await expect(page.getByRole('heading', { name: 'Collections', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('qa-stopped'))).toBe('1');
  expect(
    await page.evaluate(() => ({
      camera: sessionStorage.getItem('qa-camera'),
      location: sessionStorage.getItem('qa-location'),
      nfc: sessionStorage.getItem('qa-nfc'),
    })),
  ).toEqual({ camera: '1', location: '1', nfc: null });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Collections', exact: true })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('qa-camera'))).toBe('1');
  for (const route of ['/enrol', '/setup', '/cards', '/session']) {
    await page.goto(route);
    await page.getByRole('link', { name: 'Record collection', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Name, group or public code' })).toBeVisible();
  }
  expect(await page.evaluate(() => sessionStorage.getItem('qa-nfc'))).toBeNull();
  await page.getByRole('button', { name: 'Or tap an NFC card', exact: true }).click();
  expect(await page.evaluate(() => sessionStorage.getItem('qa-nfc'))).toBe('1');
  await page.getByRole('link', { name: 'Record collection', exact: true }).click();
  expect(await page.evaluate(() => sessionStorage.getItem('qa-nfc-stopped'))).toBe('1');
  expect(await page.evaluate(() => sessionStorage.getItem('qa-nfc'))).toBe('1');
  await page.getByRole('button', { name: 'Or tap an NFC card', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel NFC scan', exact: true }).click();
  expect(await page.evaluate(() => sessionStorage.getItem('qa-nfc-stopped'))).toBe('2');
  await page.getByRole('button', { name: /Amina E2E/ }).click();
  await expect(page.locator('#weight')).toBeVisible();
  await page.getByRole('link', { name: 'Record collection', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Name, group or public code' })).toBeVisible();
});

test('phone layouts stay within 320–390px, with one collection form and accessible controls', async ({
  page,
}) => {
  await login(page, FIELD_SUPERVISOR, '/weigh');
  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 740 });
    for (const route of ['/weigh', '/enrol', '/setup', '/cards', '/session']) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${route} at ${width}px`,
      ).toBe(true);
    }
    await page.goto('/weigh');
    await page.getByRole('button', { name: /Amina E2E/ }).click();
    await page.getByRole('button', { name: /PET/ }).click();
    await page.locator('#weight').fill('2.5');
    await page.setInputFiles('input[type="file"]', path.join(__dirname, 'fixtures', 'shot.png'));
    await page.locator('#geo-reason').fill('GPS permission denied');
    await expect(page.getByRole('button', { name: 'Confirm collection' })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(
      result.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => v.id),
    ).toEqual([]);
    await page.locator('#weight').fill('1000');
    await expect(page.getByRole('button', { name: 'Confirm collection' })).toBeDisabled();
    await page.locator('#weight').fill('0.000');
    await expect(page.getByRole('button', { name: 'Confirm collection' })).toBeDisabled();
    if (width === 320) {
      await page.locator('#weight').fill('2.5');
      await page.setInputFiles('input[type="file"]', {
        name: 'unsupported.gif',
        mimeType: 'image/gif',
        buffer: Buffer.from('GIF89a'),
      });
      await expect(page.getByRole('main').getByRole('alert')).toContainText(
        'supported scale photo',
      );
      await expect(page.getByRole('button', { name: 'Confirm collection' })).toBeDisabled();
      await page.setInputFiles('input[type="file"]', {
        name: 'too-large.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.alloc(8 * 1024 * 1024 + 1),
      });
      await expect(page.getByRole('main').getByRole('alert')).toContainText('8 MB');
      await expect(page.getByRole('button', { name: 'Confirm collection' })).toBeDisabled();
    }
  }
});

test('wallet failure retries one registration and skipped wallets can be added later', async ({
  page,
}) => {
  await login(page, FIELD_SUPERVISOR, '/enrol');
  await page.fill('#alias', 'Mobile Retry Collector');
  await page.fill('#manualCode', 'retry-collector@example.com');
  let destinationCalls = 0;
  await page.route('**/api/v1/collectors/*/destinations', async (route) => {
    if (++destinationCalls === 1)
      await route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'not_receive_capable' } }),
      });
    else await route.continue();
  });
  await page.getByRole('button', { name: 'Save collector', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Their registration is saved.',
  );
  await page.getByRole('button', { name: 'Save collector', exact: true }).click();
  await expect(page.getByTestId('public-code')).toBeVisible();
  const matching = await page.evaluate(async () => {
    const body = (await (
      await fetch('/api/v1/collectors?status=pending&q=Mobile%20Retry&limit=50')
    ).json()) as { collectors: { alias: string }[] };
    return body.collectors.filter((c) => c.alias === 'Mobile Retry Collector').length;
  });
  expect(matching).toBe(1);
  await page.goto('/enrol');
  await page.fill('#alias', 'Mobile Wallet Later');
  await page.getByRole('button', { name: 'Save collector', exact: true }).click();
  await expect(page.getByTestId('public-code')).toBeVisible();
  await page.goto('/enrol');
  await page.getByRole('link', { name: 'Add wallet for Mobile Wallet Later' }).click();
  await expect(page.locator('#alias')).toHaveValue('Mobile Wallet Later');
  await page.fill('#manualCode', 'mobile-wallet-later@example.com');
  await page.getByRole('button', { name: 'Save wallet', exact: true }).click();
  await expect(page.getByText('Receive-only address. Good to use.')).toBeVisible();
  await expect(page.getByTestId('pending-note')).toBeVisible();
});
