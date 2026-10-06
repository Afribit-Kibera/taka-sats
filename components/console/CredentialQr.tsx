// SPDX-License-Identifier: AGPL-3.0-only

'use client';

import QRCode from 'qrcode';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * The collector's credential as a QR code: it carries `takasats:<publicCode>` (identity only,
 * never a payment target), which the supervisor's scan-to-find screen reads. Printable.
 */
export function CredentialQr({
  payload,
  publicCode,
  alias,
}: {
  readonly payload: string;
  readonly publicCode: string;
  readonly alias: string;
}) {
  const t = useTranslations('Console.collectors');
  const cards = useTranslations('Cards');
  const [svg, setSvg] = useState<{ payload: string; markup: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toString(payload, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' }).then(
      (markup) => {
        if (!cancelled) {
          setSvg({ payload, markup });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [payload]);

  return (
    <div className="space-y-3">
      <div
        data-print-area
        className="recipient-print-card relative flex h-[53.98mm] w-[85.6mm] max-w-full flex-col overflow-hidden rounded-xl border border-border bg-white p-[4mm] text-foreground"
        data-testid="identity-card"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
          <Image src="/taka-sats-logo.png" alt="Taka Sats" width={104} height={32} unoptimized />
          <span className="font-display text-[10px] font-bold uppercase tracking-wider">
            {cards('identityOnly')}
          </span>
        </div>
        <div className="flex min-h-0 flex-1 items-center gap-[3mm]">
          <div
            role="img"
            aria-label={t('qrAlt', { code: publicCode })}
            className="size-[23mm] shrink-0 bg-white [&_svg]:size-full"
            data-testid="credential-qr"
            // The markup is generated locally from our own payload by the qrcode library.
            dangerouslySetInnerHTML={{ __html: svg?.payload === payload ? svg.markup : '' }}
          />
          <div className="min-w-0 space-y-1">
            <p className="break-all font-mono text-[13px] font-bold">{publicCode}</p>
            <p className="truncate font-display text-sm font-bold">{alias}</p>
            <p className="text-[10px] leading-tight text-muted-foreground">{cards('cardSafety')}</p>
          </div>
        </div>
        <p className="border-t border-border pt-1 text-[9px] text-muted-foreground">
          {cards('cardFooter')}
        </p>
      </div>
      <p className="max-w-sm text-xs text-muted-foreground">{cards('printHint')}</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="print:hidden"
        onClick={() => {
          // Print only this card: the global print rule hides the rest of the page.
          document.body.classList.add('printing-area');
          window.addEventListener(
            'afterprint',
            () => document.body.classList.remove('printing-area'),
            {
              once: true,
            },
          );
          window.print();
        }}
      >
        {t('print')}
      </Button>
    </div>
  );
}
