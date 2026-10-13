// SPDX-License-Identifier: AGPL-3.0-only
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readCard, startTagScan, writeCollectorCard } from './nfc';

const card = { payload: 'takasats:TS-KBR-0042', url: 'https://taka.afribit.africa/c/TS-KBR-0042' };
type Reading = {
  serialNumber: string;
  message: { records: { recordType: string; data: DataView }[] };
};
function reading(payload: string, url = card.url, serial = '04:AB:CD'): Reading {
  return {
    serialNumber: serial,
    message: {
      records: [payload, url].map((text, index) => {
        const bytes = new TextEncoder().encode(text);
        return { recordType: index === 0 ? 'text' : 'url', data: new DataView(bytes.buffer) };
      }),
    },
  };
}
function install(result?: Reading) {
  const writes = vi.fn().mockResolvedValue(undefined);
  const signals: AbortSignal[] = [];
  const instances: Reader[] = [];
  class Reader {
    constructor() {
      instances.push(this);
    }
    listeners = new Map<string, (event: Reading) => void>();
    write = writes;
    addEventListener(type: string, listener: (event: Reading) => void) {
      this.listeners.set(type, listener);
    }
    async scan(options: { signal: AbortSignal }) {
      signals.push(options.signal);
      if (result) queueMicrotask(() => this.listeners.get('reading')?.(result));
    }
  }
  vi.stubGlobal('NDEFReader', Reader);
  return { writes, signals, instances };
}
afterEach(() => vi.unstubAllGlobals());

describe('identity-only NFC cards', () => {
  it('manual cancellation suppresses already queued NFC readings', async () => {
    const { instances } = install();
    const controller = new AbortController();
    const resolve = vi.fn();
    await startTagScan(resolve, controller.signal);
    controller.abort();
    instances[0]!.listeners.get('reading')?.(reading(card.payload));
    expect(resolve).not.toHaveBeenCalled();
  });
  it('never opens the NFC reader for an already-cancelled action', async () => {
    const { instances } = install();
    const controller = new AbortController();
    controller.abort();
    await expect(startTagScan(vi.fn(), controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(instances).toHaveLength(0);
  });
  it('writes identity and URL, refuses overwrite and verifies the exact read-back', async () => {
    const { writes, signals } = install(reading(card.payload));
    await expect(writeCollectorCard(card)).resolves.toBe('04:AB:CD');
    expect(writes).toHaveBeenCalledWith(
      {
        records: [
          { recordType: 'text', data: card.payload },
          { recordType: 'url', data: card.url },
        ],
      },
      { overwrite: false },
    );
    expect(signals[0]?.aborted).toBe(true);
  });
  it('never writes a wallet address or mismatched identity', async () => {
    const { writes } = install();
    await expect(
      writeCollectorCard({ payload: 'alice@wallet.example', url: card.url }),
    ).rejects.toThrow('identity');
    await expect(
      writeCollectorCard({
        payload: card.payload,
        url: 'https://taka.afribit.africa/c/TS-KBR-0043',
      }),
    ).rejects.toThrow('identity');
    expect(writes).not.toHaveBeenCalled();
  });
  it('does not report success when another card is read after the write', async () => {
    install(reading('takasats:TS-KBR-0099'));
    await expect(writeCollectorCard(card)).rejects.toThrow('read-back');
  });
  it('requires a hardware serial for linking', async () => {
    install(reading(card.payload, card.url, ''));
    await expect(writeCollectorCard(card)).rejects.toThrow('read-back');
  });
  it('cancelling a scan rejects the promise and stops NFC', async () => {
    const { signals } = install();
    const controller = new AbortController();
    const pending = readCard(controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(signals[0]?.aborted).toBe(true);
  });
  it('does not start a scan after cancellation', async () => {
    const { signals } = install();
    const controller = new AbortController();
    controller.abort();
    await expect(readCard(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(signals).toHaveLength(0);
  });
});
