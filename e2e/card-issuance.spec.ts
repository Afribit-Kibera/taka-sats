// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from '@playwright/test';
import { FIELD_SUPERVISOR } from './fixtures/accounts';
import { login } from './helpers';

test('supervisor issues a pending identity card without authorizing payable work', async ({
  page,
}) => {
  // Only the hardware interface is simulated. Registration, mapping and gates use real APIs/DB.
  await page.addInitScript(() => {
    let records: { recordType: string; data: string }[] = [];
    class MockReader extends EventTarget {
      async write(
        message: { records: { recordType: string; data: string }[] },
        options: { overwrite?: boolean },
      ): Promise<void> {
        if (options.overwrite !== false) throw new Error('Expected blank-only write');
        records = message.records;
      }

      async scan(options: { signal?: AbortSignal }): Promise<void> {
        setTimeout(() => {
          if (options.signal?.aborted) return;
          const event = new Event('reading');
          Object.defineProperties(event, {
            serialNumber: { value: 'E2E-PENDING-IDENTITY-CARD' },
            message: {
              value: {
                records: records.map((record) => ({
                  recordType: record.recordType,
                  encoding: 'utf-8',
                  data: new DataView(new TextEncoder().encode(record.data).buffer),
                })),
              },
            },
          });
          this.dispatchEvent(event);
        }, 10);
      }
    }
    Object.defineProperty(globalThis, 'NDEFReader', { value: MockReader });
  });

  await login(page, FIELD_SUPERVISOR, '/enrol');
  await page.fill('#alias', 'Pending Card E2E');
  await page.getByRole('button', { name: 'Save collector', exact: true }).click();
  const publicCode = await page.getByTestId('public-code').innerText();
  await expect(page.getByTestId('pending-note')).toBeVisible();
  await page.getByRole('link', { name: 'Write or print a card' }).click();
  await expect(page).toHaveURL(/\/cards\?collector=/);
  await expect(
    page.getByText('You can issue this identity card now.', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Write card', exact: true }).click();
  await expect(
    page.getByText(`Card ready. It carries ${publicCode}.`, { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Check a card', exact: true }).click();
  await expect(page.getByText('Card identity matches its linked recipient.')).toBeVisible();

  const lookup = await page.evaluate(async () => {
    const response = await fetch('/api/v1/tags/E2E-PENDING-IDENTITY-CARD');
    const body = (await response.json()) as {
      error?: { code: string; details: { status: string } };
    };
    return { status: response.status, error: body.error };
  });
  expect(lookup.status).toBe(409);
  expect(lookup.error?.code).toBe('collector_not_authorized');
  expect(lookup.error?.details.status).toBe('pending');
});
