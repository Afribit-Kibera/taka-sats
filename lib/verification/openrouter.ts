// SPDX-License-Identifier: AGPL-3.0-only
import { z } from 'zod';
import type { StoredPhoto } from '@/lib/storage';

export const scaleReadingSchema = z
  .object({
    scale_visible: z.boolean(),
    weight_kg: z.number().positive().max(999.999).nullable(),
    unit: z.enum(['kg', 'g', 'unknown']),
    confidence: z.number().min(0).max(1),
  })
  .strict();
export type ScaleReading = z.infer<typeof scaleReadingSchema>;

/** Only the scale photograph leaves the server, never identifiers, entered kilograms, wallet or GPS. */
export async function readScalePhoto(
  photo: StoredPhoto,
  config: { model: string; timeout_ms: number; max_tokens: number },
  fetcher: typeof fetch = fetch,
  key: string | undefined = process.env.OPENROUTER_API_KEY,
): Promise<ScaleReading> {
  if (!key || !['image/jpeg', 'image/png', 'image/webp'].includes(photo.contentType)) {
    throw new Error('evidence_provider_unconfigured');
  }
  const response = await fetcher('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(config.timeout_ms),
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.max_tokens,
      temperature: 0,
      provider: { require_parameters: true, data_collection: 'deny', zdr: true },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Audit the physical scale display in this photograph. Read only clearly visible digits, not expected weight or appearance of waste. Never guess an obscured digit. weight_kg is the displayed numeric reading only when the unit is clearly kg; otherwise null. If no legible scale is present set scale_visible=false, weight_kg=null, unit=unknown, confidence=0. Confidence refers to the entire exact reading, not material identification.',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${photo.contentType};base64,${Buffer.from(photo.bytes).toString('base64')}`,
              },
            },
          ],
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'scale_reading',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              scale_visible: { type: 'boolean' },
              weight_kg: { type: ['number', 'null'] },
              unit: { type: 'string', enum: ['kg', 'g', 'unknown'] },
              confidence: { type: 'number' },
            },
            required: ['scale_visible', 'weight_kg', 'unit', 'confidence'],
          },
        },
      },
    }),
  });
  if (!response.ok) {
    throw new Error('evidence_provider_unavailable');
  }
  const envelope = z
    .object({
      choices: z
        .array(
          z.object({
            message: z.object({ content: z.string() }),
            finish_reason: z.string().optional(),
          }),
        )
        .min(1),
    })
    .parse(await response.json());
  const choice = envelope.choices[0];
  if (!choice || (choice.finish_reason && choice.finish_reason !== 'stop')) {
    throw new Error('evidence_incomplete');
  }
  return scaleReadingSchema.parse(JSON.parse(choice.message.content));
}
