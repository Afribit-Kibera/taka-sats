// SPDX-License-Identifier: AGPL-3.0-only

import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://taka.afribit.africa',
      lastModified: new Date('2026-10-13'),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: 'https://taka.afribit.africa/about',
      lastModified: new Date('2026-10-13'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://taka.afribit.africa/start-community',
      lastModified: new Date('2026-10-13'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ];
}
