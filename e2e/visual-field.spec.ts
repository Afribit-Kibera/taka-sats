// SPDX-License-Identifier: AGPL-3.0-only
import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { closeDb, getDb } from '@/lib/db/client';
import { collectors, sessions } from '@/lib/db/schema';
import { FIELD_SUPERVISOR } from './fixtures/accounts';
import { login } from './helpers';

const shots = path.resolve('output/playwright/non-nfc');
test.afterAll(async () => closeDb());
test('phone visual QA: core screens, compact capture and short-height layout', async ({ page }) => {
  test.setTimeout(120000);
  await fs.mkdir(shots, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.name));
  await login(page, FIELD_SUPERVISOR, '/weigh');
  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 740 });
    for (const route of ['/weigh', '/enrol', '/setup', '/cards', '/session']) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${route} ${width}px`,
      ).toBe(true);
      await page.screenshot({
        path: path.join(shots, `${width}-${route.slice(1)}.png`),
        fullPage: true,
      });
    }
    await page.goto('/weigh');
    await page.getByRole('button', { name: /Amina E2E/ }).click();
    await page.locator('#weight').fill('2.5');
    await page.setInputFiles('input[type="file"]', path.join(__dirname, 'fixtures', 'shot.png'));
    await page.locator('#geo-reason').fill('Permission denied');
    const reasonBox = await page.locator('#geo-reason').boundingBox();
    const footerBox = await page
      .getByRole('navigation', { name: 'Field navigation' })
      .boundingBox();
    expect(reasonBox!.y + reasonBox!.height).toBeLessThanOrEqual(footerBox!.y + 1);
    await expect(page.getByRole('button', { name: 'Confirm collection' })).toBeEnabled();
    await page.screenshot({ path: path.join(shots, `${width}-collection.png`), fullPage: true });
    await page.setViewportSize({ width, height: 420 });
    await page.locator('#weight').focus();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Confirm collection' }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Confirm collection' })).toBeInViewport();
    await page.screenshot({ path: path.join(shots, `${width}-short-height.png`) });
    const saveBox = await page.getByRole('button', { name: 'Confirm collection' }).boundingBox();
    const navBox = await page.getByRole('navigation', { name: 'Field navigation' }).boundingBox();
    expect(saveBox!.y + saveBox!.height).toBeLessThanOrEqual(navBox!.y + 1);
  }
  expect(errors).toEqual([]);
});

test('global manual action and recipient selection work with the keyboard', async ({ page }) => {
  await login(page, FIELD_SUPERVISOR, '/weigh');
  await page.getByRole('link', { name: 'Record collection', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#collector-picker')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('textbox', { name: 'Name, group or public code' })).toBeFocused();
  await page.keyboard.type('Amina');
  await page.getByRole('button', { name: /Amina E2E/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#weight')).toBeVisible();
});

test('long names and 200 percent text retain reflow on a narrow phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  // Real disposable fixtures, so a controlling service worker cannot bypass a route mock.
  const db = getDb();
  const [recipient] = await db
    .select()
    .from(collectors)
    .where(eq(collectors.publicCode, 'TS-E2E-0001'));
  const [session] = await db.select().from(sessions).where(eq(sessions.location, 'E2E Hub'));
  const longName = 'Amina E2E ' + 'LongName'.repeat(8);
  await db.update(collectors).set({ alias: longName }).where(eq(collectors.id, recipient!.id));
  await db
    .update(sessions)
    .set({ location: 'Community collection area with a long location name' })
    .where(eq(sessions.id, session!.id));
  try {
    await login(page, FIELD_SUPERVISOR, '/weigh');
    await page.addStyleTag({ content: 'html { font-size: 200%; }' });
    await expect(page.getByRole('button', { name: /Amina E2E/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Amina E2E/ })).toContainText(longName);
    const overflow = () =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll('header,nav,a,button,p,h1,h2,input,li'))
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1);
          })
          .map((el) => `${el.tagName}: ${el.textContent?.slice(0, 50)}`),
      );
    expect(await overflow()).toEqual([]);
    expect(
      await page.locator('[data-field-scroll]').evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await page.screenshot({ path: path.join(shots, '320-large-text.png'), fullPage: true });
    await page.getByRole('button', { name: /Amina E2E/ }).click();
    expect(await overflow()).toEqual([]);
    expect(
      await page.locator('[data-field-scroll]').evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
  } finally {
    await db
      .update(collectors)
      .set({ alias: recipient!.alias })
      .where(eq(collectors.id, recipient!.id));
    await db
      .update(sessions)
      .set({ location: session!.location })
      .where(eq(sessions.id, session!.id));
  }
});
