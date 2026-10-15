// SPDX-License-Identifier: AGPL-3.0-only

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { getTranslations } from 'next-intl/server';

export const alt = 'Taka Sats: community waste-work records, evidence and earnings';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpenGraphImage() {
  const t = await getTranslations('Home');
  const icon = await readFile(join(process.cwd(), 'app', 'icon.png'));
  const iconDataUrl = `data:image/png;base64,${icon.toString('base64')}`;

  return new ImageResponse(
    <div
      style={{
        alignItems: 'center',
        background: '#FAF8F4',
        color: '#141414',
        display: 'flex',
        height: '100%',
        justifyContent: 'space-between',
        padding: '72px 76px',
        position: 'relative',
        width: '100%',
      }}
    >
      <div
        style={{
          background: 'rgb(247 147 26)',
          bottom: 0,
          display: 'flex',
          height: 18,
          left: 0,
          position: 'absolute',
          right: 0,
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', width: 720 }}>
        <div
          style={{
            alignItems: 'center',
            color: '#3E6336',
            display: 'flex',
            fontSize: 27,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          {t('eyebrow')}
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontSize: 70,
            fontWeight: 700,
            letterSpacing: -3,
            lineHeight: 1.02,
            marginTop: 34,
          }}
        >
          <span>{t('heroLine1')}</span>
          <span style={{ color: '#3E6336' }}>{t('heroLine2')}</span>
          <span>{t('heroLine3')}</span>
        </div>
        <div style={{ color: '#68645E', display: 'flex', fontSize: 27, marginTop: 34 }}>
          {t('pointEvidence')}
        </div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" height="330" src={iconDataUrl} style={{ height: 330, width: 330 }} width="330" />
    </div>,
    size,
  );
}
