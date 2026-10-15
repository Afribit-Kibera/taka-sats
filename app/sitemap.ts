// SPDX-License-Identifier: AGPL-3.0-only

import type { MetadataRoute } from 'next';
import { PUBLIC_DOCS } from '@/lib/docs';
import { getSettings } from '@/lib/config';

export default function sitemap(): MetadataRoute.Sitemap {
  const publicBase = getSettings().programme.public_base_url;
  return [
    {
      url: publicBase,
      lastModified: new Date('2026-10-15'),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${publicBase}/about`,
      lastModified: new Date('2026-10-15'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${publicBase}/start-community`,
      lastModified: new Date('2026-10-15'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    ...['/docs', '/communities', ...PUBLIC_DOCS.map((doc) => `/docs/${doc.slug}`)].map((path) => ({
      url: `${publicBase}${path}`,
      lastModified: new Date('2026-10-15'),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}
