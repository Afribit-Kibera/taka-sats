// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test, type Page } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { hashPassword } from '@/lib/auth/password';
import { resetStaffPhoneAccess } from '@/lib/auth/bootstrap';
import { closeDb, getDb } from '@/lib/db/client';
import { staffAuthChallenges, supervisors } from '@/lib/db/schema';
import { audit, login } from './helpers';

test.afterAll(async () => {
  await closeDb();
});
async function phone(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return { cdp, authenticatorId };
}
async function account(code: string) {
  const user = { name: 'Phone security test', phone: code, password: 'e2e-bootstrap-phrase-nine' };
  const [row] = await getDb()
    .insert(supervisors)
    .values({
      name: user.name,
      phone: code,
      passwordHash: await hashPassword(user.password),
      bootstrapPasswordExpiresAt: new Date(Date.now() + 86400_000),
    })
    .returning();
  return { ...user, id: row!.id };
}
async function enroll(page: Page) {
  await page.getByRole('button', { name: 'Set up phone security', exact: true }).click();
  await expect(page.getByText('Phone security is ready.', { exact: false })).toBeVisible();
  await expect
    .poll(async () => (await (await page.request.get('/api/auth/session')).json()).user?.authMethod)
    .toBe('passkey');
}

test('bootstrap once, phone enrollment, username-free sign-in, password retirement and lost-phone recovery', async ({
  page,
  browser,
}) => {
  const user = await account('PASSKEYE2E01');
  const virtual = await phone(page);
  await login(page, user, '/setup');
  const oldCookies = await page.context().cookies();
  await expect(page.getByRole('link', { name: 'Open field work' })).toHaveCount(0);
  expect((await page.request.get('/api/v1/sessions/current')).status()).toBe(401);
  await enroll(page);
  await audit(page, '/setup');
  const old = await browser.newContext();
  await old.addCookies(oldCookies);
  expect(
    (await old.request.get(`${new URL(page.url()).origin}/api/v1/sessions/current`)).status(),
  ).toBe(401);
  await old.close();

  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByRole('button', { name: 'Sign in with phone security' }).click();
  await page.waitForURL(/\/setup$/);
  expect((await (await page.request.get('/api/auth/session')).json()).user.id).toBe(user.id);
  await page.context().clearCookies();
  await page.goto('/login');
  await page.fill('#identifier', user.phone);
  await page.fill('#password', user.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();

  await page.getByRole('button', { name: 'Sign in with phone security' }).click();
  await page.waitForURL(/\/setup$/);
  const credentials = await resetStaffPhoneAccess(getDb(), [user.phone]);
  expect((await page.request.get('/api/v1/sessions/current')).status()).toBe(401);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Sign in with phone security' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await login(page, { ...user, password: credentials[0]!.password }, '/setup');
  await virtual.cdp.send('WebAuthn.removeVirtualAuthenticator', {
    authenticatorId: virtual.authenticatorId,
  });
  await phone(page);
  await page.reload();
  await enroll(page);
});

test('a cancelled phone prompt preserves the bootstrap phrase; unverified authenticators are refused', async ({
  page,
}) => {
  const user = await account('PASSKEYE2E02');
  const virtual = await phone(page);
  await login(page, user, '/setup');
  await page.evaluate(() => {
    navigator.credentials.create = async () => {
      throw new DOMException('Cancelled', 'NotAllowedError');
    };
  });
  await page.getByRole('button', { name: 'Set up phone security', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.reload();
  // Return real signed attestation with UV false, rather than faking server verification.
  await virtual.cdp.send('WebAuthn.setUserVerified', {
    authenticatorId: virtual.authenticatorId,
    isUserVerified: false,
  });
  await page.evaluate(() => {
    const create = navigator.credentials.create.bind(navigator.credentials);
    navigator.credentials.create = (options) => {
      if (options?.publicKey?.authenticatorSelection)
        options.publicKey.authenticatorSelection.userVerification = 'discouraged';
      return create(options);
    };
  });
  await page.getByRole('button', { name: 'Set up phone security', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  const [row] = await getDb().select().from(supervisors).where(eq(supervisors.id, user.id));
  expect(row!.passwordLoginDisabled).toBe(false);
  await page.context().clearCookies();
  await login(page, user, '/setup');
});

test('wrong origin, browser nonce theft, expired challenges, replay and altered signatures are refused', async ({
  page,
  browser,
}) => {
  const user = await account('PASSKEYE2E03');
  await phone(page);
  await login(page, user, '/setup');
  await enroll(page);
  await page.context().clearCookies();
  await page.goto('/login');
  const origin = new URL(page.url()).origin;
  const wrong = await page.request.post('/api/auth/passkeys', {
    headers: { origin: 'https://attacker.test' },
    data: { action: 'login-options' },
  });
  expect(wrong.status()).toBe(403);
  // Native WebAuthn serialization, actual browser-generated signatures.
  const assertion = async () =>
    page.evaluate(async () => {
      const r = await fetch('/api/auth/passkeys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login-options' }),
      });
      const json = await r.json();
      const credential = (await navigator.credentials.get({
        publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(json),
      })) as PublicKeyCredential;
      return credential.toJSON();
    });
  const first = await assertion();
  const other = await browser.newContext();
  const stolen = await other.request.post(`${origin}/api/auth/passkeys`, {
    headers: { origin },
    data: { action: 'login-verify', response: first },
  });
  expect(stolen.status()).toBe(400);
  await other.close();
  const verify = (response: unknown) =>
    page.request.post('/api/auth/passkeys', {
      headers: { origin },
      data: { action: 'login-verify', response },
    });
  expect((await verify(first)).status()).toBe(200);
  expect((await verify(first)).status()).toBe(400);
  const second = await assertion();
  await getDb()
    .update(staffAuthChallenges)
    .set({ expiresAt: new Date(Date.now() - 1000) })
    .where(eq(staffAuthChallenges.kind, 'login'));
  expect((await verify(second)).status()).toBe(400);
  const third = await assertion();
  third.response.signature = `${third.response.signature[0] === 'A' ? 'B' : 'A'}${third.response.signature.slice(1)}`;
  expect((await verify(third)).status()).toBe(400);
  expect((await page.request.get('/api/auth/session')).status()).toBe(200);
  expect(await (await page.request.get('/api/auth/session')).json()).toBeNull();
});
