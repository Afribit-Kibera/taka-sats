// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Web NFC helpers (DESIGN §6.4). `NDEFReader` is
 * Chrome-on-Android only — every caller must have a manual fallback (gate
 * G2). The DOM lib has no types for it, so a minimal surface is declared
 * here. Browser-only; do not import from a Server Component.
 */

type NdefRecordInit = { recordType: string; data?: string };
type NdefWriteMessage = { records: NdefRecordInit[] };
type NdefRecordRead = { recordType: string; data?: DataView; encoding?: string };
type NdefReadingEvent = { serialNumber: string; message?: { records: NdefRecordRead[] } };

type NDEFReader = {
  write(message: NdefWriteMessage, options?: { signal?: AbortSignal }): Promise<void>;
  scan(options?: { signal?: AbortSignal }): Promise<void>;
  addEventListener(type: 'reading', listener: (event: NdefReadingEvent) => void): void;
  addEventListener(type: 'readingerror', listener: () => void): void;
};

type NDEFReaderConstructor = new () => NDEFReader;

function getNdefReader(): NDEFReaderConstructor | undefined {
  return (globalThis as { NDEFReader?: NDEFReaderConstructor }).NDEFReader;
}

export function isWebNfcAvailable(): boolean {
  return getNdefReader() !== undefined;
}

/**
 * Write a single URL record (the collector's LNURL-pay link / Lightning
 * Address) to whatever blank NTAG is presented, then read the tag back once
 * to capture its hardware serial number — that serial is our `tag_history.tag_id`.
 */
export async function writeTagAndReadSerial(url: string, signal?: AbortSignal): Promise<string> {
  const Reader = getNdefReader();
  if (!Reader) {
    throw new Error('Web NFC is not available on this device');
  }

  const writer = new Reader();
  await writer.write(
    { records: [{ recordType: 'url', data: url }] },
    signal ? { signal } : undefined,
  );

  const reader = new Reader();
  const serial = await new Promise<string>((resolve, reject) => {
    reader.addEventListener('reading', (event) => resolve(event.serialNumber));
    reader.addEventListener('readingerror', () => reject(new Error('Could not read the tag back')));
    reader.scan(signal ? { signal } : undefined).catch(reject);
  });

  return serial;
}

/**
 * Start a tag read (M1-8): `onSerial` fires with the NTAG hardware serial
 * every time a tag is presented, until `signal` aborts. Rejects if Web NFC
 * is unavailable or the scan cannot start (caller falls back to alias
 * search, G2).
 */
export async function startTagScan(
  onSerial: (serial: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const Reader = getNdefReader();
  if (!Reader) {
    throw new Error('Web NFC is not available on this device');
  }

  const reader = new Reader();
  reader.addEventListener('reading', (event) => onSerial(event.serialNumber));
  await reader.scan({ signal });
}

/** What a collector card carries, as plain strings. */
export type CardContent = { readonly serial: string; readonly texts: readonly string[] };

function decodeRecords(records: readonly NdefRecordRead[] | undefined): string[] {
  const out: string[] = [];
  for (const record of records ?? []) {
    if (record.data && (record.recordType === 'text' || record.recordType === 'url')) {
      out.push(new TextDecoder(record.encoding ?? 'utf-8').decode(record.data));
    }
  }
  return out;
}

/**
 * Write a collector card: the `takasats:<code>` reference as a text record and the `<base>/c/<code>`
 * link as a URL record (so a plain phone tap opens a page that reveals nothing). The card holds an
 * identity pointer only, never a payment target (D-24). Resolves with the chip's hardware serial,
 * which is what the server stores for revocation and tap lookup.
 */
export async function writeCollectorCard(
  card: { readonly payload: string; readonly url: string },
  signal?: AbortSignal,
): Promise<string> {
  const Reader = getNdefReader();
  if (!Reader) {
    throw new Error('Web NFC is not available on this device');
  }
  const writer = new Reader();
  await writer.write(
    {
      records: [
        { recordType: 'text', data: card.payload },
        { recordType: 'url', data: card.url },
      ],
    },
    signal ? { signal } : undefined,
  );
  return readCard(signal).then((content) => content.serial);
}

/** Read one card presented to the phone: its serial and the text and URL records on it. */
export async function readCard(signal?: AbortSignal): Promise<CardContent> {
  const Reader = getNdefReader();
  if (!Reader) {
    throw new Error('Web NFC is not available on this device');
  }
  const reader = new Reader();
  return new Promise<CardContent>((resolve, reject) => {
    reader.addEventListener('reading', (event) =>
      resolve({ serial: event.serialNumber, texts: decodeRecords(event.message?.records) }),
    );
    reader.addEventListener('readingerror', () => reject(new Error('Could not read the card')));
    reader.scan(signal ? { signal } : undefined).catch(reject);
  });
}
