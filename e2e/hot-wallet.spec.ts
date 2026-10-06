// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from '@playwright/test';
import { ADMINS } from './fixtures/accounts';
import { personContext } from './helpers';

test('hot wallet is operational only; legacy funding mutations are removed', async ({
  browser,
}) => {
  const operator = await personContext(browser, ADMINS[0], '/admin');
  await operator.page.goto('/hot-wallet');
  await expect(
    operator.page.getByRole('heading', { name: 'Hot wallet', exact: true }),
  ).toBeVisible();
  await expect(operator.page.getByTestId('propose-submit')).toHaveCount(0);
  const refused = await operator.page.evaluate(async () => {
    const res = await fetch('/api/v1/treasury/topups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountSats: 50000 }),
    });
    return {
      status: res.status,
      code: ((await res.json()) as { error: { code: string } }).error.code,
    };
  });
  expect(refused).toEqual({ status: 410, code: 'feature_removed' });
  await operator.page.goto('/treasury');
  await expect(operator.page).toHaveURL(/\/hot-wallet$/);
  await operator.context.close();
});
