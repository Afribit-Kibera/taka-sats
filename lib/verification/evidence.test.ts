// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it, vi } from 'vitest';
import { compareScaleReading } from './evidence';
import { readScalePhoto } from './openrouter';

describe('scale evidence is an audit, never invented kilograms', () => {
  const reading = { scale_visible: true, weight_kg: 8.4, unit: 'kg' as const, confidence: 0.99 };
  it('holds an inflated 18.4kg input against an 8.4kg display', () => {
    expect(compareScaleReading(reading, '18.400', 0.9, 0.1)).toBe('mismatch');
  });
  it('matches within the configured tolerance', () => {
    expect(compareScaleReading(reading, '8.400', 0.9, 0.1)).toBe('matched');
  });
  it('never guesses an ambiguous display or silently converts grams', () => {
    expect(compareScaleReading({ ...reading, confidence: 0.89 }, '8.400', 0.9, 0.1)).toBe(
      'unreadable',
    );
    expect(compareScaleReading({ ...reading, unit: 'g' }, '8.400', 0.9, 0.1)).toBe('unreadable');
  });
  it('sends only private photo bytes and requires privacy-compatible providers', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(reading) }, finish_reason: 'stop' }],
        }),
      ),
    );
    await expect(
      readScalePhoto(
        { bytes: new Uint8Array([1, 2]), contentType: 'image/jpeg' },
        { model: 'test/model', timeout_ms: 1000, max_tokens: 256 },
        fetcher,
        'test-key',
      ),
    ).resolves.toEqual(reading);
    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(body.provider).toEqual({ require_parameters: true, data_collection: 'deny', zdr: true });
    expect(body.max_tokens).toBe(256);
    expect(body.messages[0].content[1].image_url.url).toBe('data:image/jpeg;base64,AQI=');
    expect(JSON.stringify(body)).not.toContain('18.4');
  });
  it('fails closed on malformed output or missing key', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: '{"weight_kg":8.4}' } }] })),
      );
    const photo = { bytes: new Uint8Array([1]), contentType: 'image/jpeg' };
    await expect(
      readScalePhoto(
        photo,
        { model: 'test/model', timeout_ms: 1000, max_tokens: 256 },
        fetcher,
        'test-key',
      ),
    ).rejects.toThrow();
    await expect(
      readScalePhoto(
        photo,
        { model: 'test/model', timeout_ms: 1000, max_tokens: 256 },
        fetcher,
        '',
      ),
    ).rejects.toThrow();
  });
});
