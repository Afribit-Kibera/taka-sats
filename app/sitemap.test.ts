// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/config', () => ({
  getSettings: () => ({ programme: { public_base_url: 'https://independent.example' } }),
}));
import sitemap from './sitemap';
import robots from './robots';

describe('independent deployment discovery', () => {
  it('uses the configured community origin for crawler and Docs URLs', () => {
    expect(robots().host).toBe('https://independent.example');
    expect(robots().sitemap).toBe('https://independent.example/sitemap.xml');
    const entries = sitemap();
    expect(
      entries.some((entry) => entry.url === 'https://independent.example/docs/run-your-community'),
    ).toBe(true);
    expect(
      entries.every((entry) => new URL(entry.url).origin === 'https://independent.example'),
    ).toBe(true);
  });
});
