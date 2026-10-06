// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest';
import { bearerToken, createApiKeySchema, hashApiKey } from './api-keys';
import { actorHasScope } from './permissions';

describe('API key credential boundaries', () => {
  const token = `tks_${'A'.repeat(43)}`;
  it('hashes tokens rather than retaining plaintext', () => {
    expect(hashApiKey(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashApiKey(token)).not.toContain(token);
    expect(hashApiKey(token)).not.toBe(hashApiKey(`${token.slice(0, -1)}B`));
  });
  it('distinguishes missing, valid and malformed Authorization headers', () => {
    expect(bearerToken(new Request('https://example.test'))).toBeNull();
    expect(
      bearerToken(
        new Request('https://example.test', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ),
    ).toBe(token);
    for (const value of ['', 'Basic secret', 'Bearer short', `Bearer ${token}, other`]) {
      expect(
        bearerToken(
          new Request('https://example.test', {
            headers: { Authorization: value },
          }),
        ),
      ).toBe(false);
    }
  });
  it.each(['payout:execute', 'apikey:manage'])('never delegates %s', (scope) => {
    expect(
      createApiKeySchema.safeParse({
        name: 'Dashboard',
        scopes: [scope],
        expiresAt: '2099-01-01T00:00:00Z',
      }).success,
    ).toBe(false);
  });
  it('rejects duplicate scopes, missing expiry and arbitrary owner impersonation', () => {
    const base = { name: 'Dashboard', scopes: ['payout:read'], expiresAt: '2099-01-01T00:00:00Z' };
    expect(
      createApiKeySchema.safeParse({ ...base, scopes: ['payout:read', 'payout:read'] }).success,
    ).toBe(false);
    expect(createApiKeySchema.safeParse({ name: base.name, scopes: base.scopes }).success).toBe(
      false,
    );
    expect(createApiKeySchema.safeParse({ ...base, ownerId: 'another-person' }).success).toBe(
      false,
    );
  });
  it('intersects role and key grants, including nested domain authorization', () => {
    expect(
      actorHasScope(
        { role: 'admin', apiKeyId: 'key', scopes: ['collector:enrol'] },
        'collector:authorize',
      ),
    ).toBe(false);
    expect(
      actorHasScope(
        { role: 'supervisor', apiKeyId: 'key', scopes: ['payout:approve'] },
        'payout:approve',
      ),
    ).toBe(false);
    expect(
      actorHasScope({ role: 'admin', apiKeyId: 'key', scopes: ['payout:read'] }, 'payout:read'),
    ).toBe(true);
    expect(actorHasScope({ role: 'admin', apiKeyId: 'key' }, 'payout:read')).toBe(false);
    expect(actorHasScope({ role: 'admin' }, 'payout:read')).toBe(true);
  });
});
