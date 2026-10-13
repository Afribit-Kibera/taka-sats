// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The offline write path (FR-4.1, US-4.3). One call:
 *
 *   1. assemble the event (id, time, indicative sats, content hash),
 *   2. write it to IndexedDB as `queued`,
 *   3. persist the photo bytes + an outbox entry for the photo upload queue,
 *   4. enqueue an outbox entry for the event sync loop (M4).
 *
 * Steps 2-4 share one atomic transaction. It resolves only after that commits — the caller shows the "queued"
 * state *after* this promise, never before, so a supervisor is never told
 * their work is saved when it is not. Nothing here touches the network.
 */

import type { CollectionEventDraft, OutboxEntry } from '@/types/domain';
import { type AssembleOptions, assembleCollectionEvent } from './events';
import { openSyncDb, type StoredEvent } from './store';

export type CapturePhoto = {
  readonly blob: Blob;
  /** Must equal `draft.photoSha256` — hex, the on-device hash. */
  readonly sha256: string;
  readonly contentType: string;
};

export async function captureCollectionEvent(
  draft: CollectionEventDraft,
  photo?: CapturePhoto,
  options: AssembleOptions = {},
): Promise<StoredEvent> {
  if (photo && photo.sha256 !== draft.photoSha256)
    throw new Error('Captured photo hash must match event');
  const event = await assembleCollectionEvent(draft, options);
  const stored: StoredEvent = { ...event, syncStatus: { state: 'queued' } };
  const db = await openSyncDb();
  // All capture facts and delivery entries commit together, or none do. A quota/clone/abort
  // failure must not leave an orphan queued event that looks saved but cannot sync.
  const tx = db.transaction(['events', 'photos', 'outbox'], 'readwrite');
  const committed = tx.done;
  const writes: Promise<unknown>[] = [];
  try {
    const outbox = tx.objectStore('outbox');
    const entry = async (id: string, kind: OutboxEntry['kind']) => {
      const existing = await outbox.get(id);
      await outbox.put(
        existing ?? {
          id,
          kind,
          refId: event.id,
          attempts: 0,
          createdAt: new Date().toISOString() as OutboxEntry['createdAt'],
          lastAttemptAt: null,
        },
      );
    };
    writes.push(tx.objectStore('events').put(stored), entry(event.id, 'collection_event'));
    if (photo) {
      writes.push(
        tx.objectStore('photos').put({
          eventId: event.id,
          blob: photo.blob,
          sha256: photo.sha256,
          contentType: photo.contentType,
        }),
        entry(`photo:${event.id}`, 'photo'),
      );
    }
    await Promise.all([...writes, committed]);
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /* An already-aborted transaction needs no further action. */
    }
    await Promise.allSettled([...writes, committed]);
    throw error;
  }
  return stored;
}
