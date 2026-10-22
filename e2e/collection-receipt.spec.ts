// SPDX-License-Identifier: AGPL-3.0-only
import fs from 'node:fs/promises';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import type { StoredEvent } from '@/lib/sync/store';
import type { SyncStatus } from '@/types/domain';
import { FIELD_SUPERVISOR } from './fixtures/accounts';
import { login, recordCollection } from './helpers';

const shots = path.resolve('output/playwright/receipts');
const REF = '10000000-0000-4000-8000-000000000001';
const OTHER = '10000000-0000-4000-8000-000000000002';

/** Disposable local records exercise the private read model; none is posted to collection ingest. */
async function seedLocal(page: Page, syncStatus: SyncStatus = { state: 'queued' }) {
  await page.evaluate(
    async ({ reference, other, syncStatus }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('takasats-sync');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        const event = {
          id: reference,
          collectorId: 'receipt-test-collector',
          supervisorId: 'private-supervisor',
          sessionId: 'receipt-test-session',
          material: 'PET',
          weightKg: 2.5,
          rateId: 'receipt-test-rate',
          rateFiatMinor: 2000,
          exchangeRate: 5000000,
          indicativeSats: 1000,
          photoSha256: 'a'.repeat(64),
          photoUrl: 'https://example.com/private-photo',
          contentHash: 'b'.repeat(64),
          registrationType: 'walk_in',
          weightSource: 'manual',
          recordedAt: '2026-10-15T09:00:00.000Z',
          syncStatus,
          geo: { kind: 'fix', lat: -1.31, lng: 36.79, accuracyM: 1 },
        };
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(['events', 'collectors'], 'readwrite');
          tx.objectStore('events').put(event);
          tx.objectStore('events').put({
            ...event,
            id: other,
            collectorId: 'other-person',
            material: 'OTHER-PERSON-MATERIAL',
          });
          tx.objectStore('collectors').put({
            id: 'receipt-test-collector',
            alias: 'Private Receipt Name',
            publicCode: 'TS-EX-0001',
            status: 'active',
            nfcTagId: null,
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } finally {
        db.close();
      }
      window.dispatchEvent(new Event('takasats:queue-changed'));
    },
    { reference: REF, other: OTHER, syncStatus },
  );
  await expect(page.getByTestId('queue-item')).toHaveCount(2);
}

test('receipt follows a real offline capture and downloads one private record without network', async ({
  page,
  context,
}) => {
  await fs.mkdir(shots, { recursive: true });
  await login(page, FIELD_SUPERVISOR, '/session');
  // Complete the first installation before testing a navigation with the network disabled.
  // A page visited before the worker takes control is not guaranteed to be cached.
  if (process.env.E2E_WITH_SERVICE_WORKER === '1') {
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await page.goto('/session');
  }
  await expect(page.getByText('Nothing recorded yet.', { exact: true })).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.goto('/weigh');
  await expect(page.getByRole('textbox', { name: 'Name, group or public code' })).toBeVisible();
  await context.setOffline(true);
  await recordCollection(page, 'Amina', /Amina E2E/);
  await page.getByRole('link', { name: 'Activity', exact: true }).click();
  await expect(page.getByTestId('queue-item')).toHaveCount(1);
  const posts: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET') posts.push(request.url());
  });
  await page.getByRole('button', { name: /^Open receipt for collection/ }).click();
  const sheet = page.getByTestId('collection-receipt');
  await expect(sheet.getByRole('heading', { name: 'Collection receipt' })).toBeVisible();
  await expect(
    sheet.getByText('Saved on this phone; waiting to send', { exact: true }),
  ).toBeVisible();
  await expect(sheet.getByText('2.500 kg', { exact: true })).toBeVisible();
  const downloadWait = page.waitForEvent('download');
  await sheet.getByRole('button', { name: 'Save text', exact: true }).click();
  const download = await downloadWait;
  const text = await fs.readFile((await download.path())!, 'utf8');
  expect(download.suggestedFilename()).toMatch(/^taka-sats-receipt-[0-9a-f-]{36}\.txt$/);
  expect(text).toContain('TS-E2E-0001');
  expect(text).toContain('Payment status and any later corrections are not checked');
  expect(text).toContain('Estimated reward at capture: ≈');
  expect(text).not.toContain('Amina E2E');
  expect(text).not.toContain('headless');
  expect(posts).toEqual([]);
  await expect(page.getByTestId('queue-item')).toHaveAttribute('data-state', 'queued');
});

test('receipt keeps every sync state provisional for payment and exports only selected fields', async ({
  page,
  context,
}) => {
  await login(page, FIELD_SUPERVISOR, '/session');
  await context.setOffline(true);
  const states: { status: SyncStatus; label: string }[] = [
    { status: { state: 'queued' }, label: 'Saved on this phone; waiting to send' },
    { status: { state: 'syncing' }, label: 'Sending; server acknowledgement not yet received' },
    {
      status: {
        state: 'confirmed',
        seq: 12,
        syncedAt: '2026-10-15T10:00:00Z' as StoredEvent['recordedAt'],
      },
      label: 'Server acknowledgement saved on this phone',
    },
    {
      status: { state: 'needs_attention', reason: 'private rejection reason' },
      label: 'Needs attention; not confirmed by the server',
    },
    {
      status: { state: 'failed', reason: 'private server reason', attempts: 1 },
      label: 'Not confirmed; sending needs to be retried',
    },
  ];
  for (const state of states) {
    await seedLocal(page, state.status);
    await page
      .getByRole('button', { name: `Open receipt for collection ${REF}`, exact: true })
      .click();
    const sheet = page.getByTestId('collection-receipt');
    await expect(sheet.getByText(state.label, { exact: true })).toBeVisible();
    const wait = page.waitForEvent('download');
    await sheet.getByRole('button', { name: 'Save text', exact: true }).click();
    const text = await fs.readFile((await (await wait).path())!, 'utf8');
    expect(text).toContain(`Collection reference: ${REF}`);
    expect(text).toContain('Estimated reward at capture: ≈ 1000 sats');
    for (const excluded of [
      OTHER,
      'OTHER-PERSON-MATERIAL',
      'Private Receipt Name',
      'private-supervisor',
      'private-photo',
      '36.79',
      'private server reason',
      'private rejection reason',
      'photoSha256',
    ]) {
      expect(text).not.toContain(excluded);
    }
    await sheet.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(sheet).toHaveCount(0);
  }
});

test('receipt mobile sheet reflows, supports keyboard focus, and recovers from download failure', async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  await fs.mkdir(shots, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page, FIELD_SUPERVISOR, '/session');
  await context.setOffline(true);
  await seedLocal(page);
  const trigger = page.getByRole('button', {
    name: `Open receipt for collection ${REF}`,
    exact: true,
  });
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 740 });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const sheet = page.getByTestId('collection-receipt');
    await expect(sheet).toBeVisible();
    await expect(
      sheet.getByRole('region', { name: 'Collection details', exact: true }),
    ).toBeFocused();
    expect(await sheet.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.length }))).toEqual([]);
    await page.screenshot({ path: path.join(shots, `${width}-receipt.png`) });
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
  await page.setViewportSize({ width: 320, height: 420 });
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  await trigger.click({ timeout: 10000 });
  const sheet = page.getByTestId('collection-receipt');
  expect(await sheet.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await expect(sheet.getByRole('button', { name: 'Save text', exact: true })).toBeInViewport({
    ratio: 1,
  });
  await expect(sheet.getByRole('button', { name: 'Close', exact: true })).toBeInViewport({
    ratio: 1,
  });
  await page.screenshot({ path: path.join(shots, '320-short-large-text.png') });
  await page.evaluate(() => {
    const original = URL.createObjectURL;
    URL.createObjectURL = () => {
      URL.createObjectURL = original;
      throw new Error('Simulated download restriction');
    };
  });
  await sheet.getByRole('button', { name: 'Save text', exact: true }).click();
  await expect(sheet.getByRole('alert')).toHaveText('Save failed. Try again.');
  await expect(sheet.getByRole('alert')).toBeInViewport({ ratio: 1 });
  await expect(sheet.getByRole('button', { name: 'Save text', exact: true })).toBeInViewport({
    ratio: 1,
  });
  await expect(sheet.getByRole('button', { name: 'Close', exact: true })).toBeInViewport({
    ratio: 1,
  });
  await page.screenshot({ path: path.join(shots, '320-download-error.png') });
  await expect(sheet.getByRole('heading', { name: 'Collection receipt' })).toBeAttached();
  const retryDownload = page.waitForEvent('download');
  await sheet.getByRole('button', { name: 'Save text', exact: true }).click();
  const retryText = await fs.readFile((await (await retryDownload).path())!, 'utf8');
  expect(retryText).toContain(`Collection reference: ${REF}`);
  await expect(sheet.getByRole('alert')).toHaveCount(0);
  expect(errors).toEqual([]);
});
