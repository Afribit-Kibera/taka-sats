// SPDX-License-Identifier: AGPL-3.0-only
/** Browser-safe upload contract. Keep capture and server storage on the same allowlist/cap. */
export const ALLOWED_PHOTO_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;
export type AllowedPhotoType = (typeof ALLOWED_PHOTO_TYPES)[number];
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export function baseMediaType(contentType: string): string {
  return (contentType.split(';')[0] ?? '').trim().toLowerCase();
}
export function isAllowedPhotoType(contentType: string): contentType is AllowedPhotoType {
  return (ALLOWED_PHOTO_TYPES as readonly string[]).includes(baseMediaType(contentType));
}
