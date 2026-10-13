// SPDX-License-Identifier: AGPL-3.0-only

/** Served by the VM through the canonical proxy, independently of the public-site deployment. */
export function GET() {
  return Response.json(
    {
      name: 'Taka Sats',
      short_name: 'Taka Sats',
      description: 'Verified recycling work with transparent Bitcoin payouts.',
      id: '/',
      start_url: '/weigh',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      theme_color: '#3E6336',
      background_color: '#FAF8F4',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    },
    {
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'public, max-age=300',
      },
    },
  );
}
