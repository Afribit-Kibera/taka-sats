// SPDX-License-Identifier: AGPL-3.0-only

import type { MetadataRoute } from 'next';
import { getSettings } from '@/lib/config';

export default function robots(): MetadataRoute.Robots {
  const publicBase = getSettings().programme.public_base_url;
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/admin',
        '/anomalies',
        '/c/',
        '/collectors',
        '/events',
        '/ledger',
        '/payouts',
        '/rates',
        '/reconciliation',
        '/staff',
        '/treasury',
        '/login',
        '/enrol',
        '/lookup',
        '/rotations',
        '/session',
        '/sessions',
        '/weigh',
      ],
    },
    sitemap: `${publicBase}/sitemap.xml`,
    host: publicBase,
  };
}
