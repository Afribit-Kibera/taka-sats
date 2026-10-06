// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest';
import { consoleNavFor } from './navigation';

describe('console navigation follows role permissions', () => {
  it('supervisors and partners do not get the operator console', () => {
    expect(consoleNavFor('supervisor')).toEqual([]);
    expect(consoleNavFor('partner')).toEqual([]);
  });
  it('hub leads can review work but cannot configure rates or staff', () => {
    const paths = consoleNavFor('hub_lead').map((item) => item.href);
    expect(paths).toContain('/review');
    expect(paths).toContain('/reconciliation');
    expect(paths).not.toContain('/rates');
    expect(paths).not.toContain('/staff');
  });
  it('the operating wallet replaces treasury voting in the admin menu', () => {
    const paths = consoleNavFor('admin').map((item) => item.href);
    expect(paths).toContain('/hot-wallet');
    expect(paths).toContain('/cards');
    expect(paths).not.toContain('/treasury');
  });
});
