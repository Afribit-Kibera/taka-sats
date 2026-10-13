// SPDX-License-Identifier: AGPL-3.0-only
import 'fake-indexeddb/auto';
import { IDBFactory, IDBObjectStore as TestObjectStore } from 'fake-indexeddb';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { CollectionEventDraft } from '@/types/domain';
import { captureCollectionEvent } from './capture';
import { closeSyncDb, listEvents, listOutbox, openSyncDb, markOutboxAttempt } from './store';

const hash = 'e'.repeat(64);
const draft: CollectionEventDraft = {
  collectorId: 'collector-no-card',
  supervisorId: 'staff',
  sessionId: 'session',
  material: 'PET',
  weightKg: 2.5,
  rateId: 'rate',
  rateFiatMinor: 2000,
  exchangeRate: 5000000,
  photoSha256: hash,
  geo: { kind: 'unavailable', reason: 'GPS permission denied' },
  registrationType: 'walk_in',
};
const photo = {
  blob: new Blob(['scale evidence'], { type: 'image/png' }),
  sha256: hash,
  contentType: 'image/png',
};
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await closeSyncDb();
});

it.each(['photos', 'outbox'])(
  'rolls back every capture store when %s rejects a write',
  async (name) => {
    const original = TestObjectStore.prototype.put;
    vi.spyOn(TestObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey,
    ) {
      if (this.name === name)
        throw new DOMException('Storage quota exhausted', 'QuotaExceededError');
      return original.call(this, value, key);
    });
    await expect(captureCollectionEvent(draft, photo)).rejects.toThrow('Storage quota exhausted');
    expect(await listEvents()).toEqual([]);
    expect(await listOutbox()).toEqual([]);
    expect(await (await openSyncDb()).getAll('photos')).toEqual([]);
  },
);
it('refuses a photo/event hash mismatch before persisting any evidence', async () => {
  await expect(captureCollectionEvent(draft, { ...photo, sha256: 'f'.repeat(64) })).rejects.toThrow(
    'hash must match',
  );
  expect(await listEvents()).toEqual([]);
  expect(await listOutbox()).toEqual([]);
});
it('cardless capture commits complete evidence and resending its UUID preserves queue attempts', async () => {
  const first = await captureCollectionEvent(draft, photo, { id: 'one-capture' });
  await markOutboxAttempt(first.id);
  await captureCollectionEvent(draft, photo, { id: first.id });
  expect(await listEvents()).toHaveLength(1);
  expect((await listOutbox()).map((e) => [e.kind, e.attempts]).sort()).toEqual([
    ['collection_event', 1],
    ['photo', 0],
  ]);
  expect((await (await openSyncDb()).getAll('photos'))[0]?.sha256).toBe(hash);
  expect(first.registrationType).toBe('walk_in');
});
