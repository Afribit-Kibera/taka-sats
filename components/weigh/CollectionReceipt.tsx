// SPDX-License-Identifier: AGPL-3.0-only
'use client';

import { ReceiptText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Drawer } from 'vaul';
import { Button } from '@/components/ui/button';
import {
  receiptFilename,
  receiptLine,
  receiptText,
  type CollectionReceipt as Receipt,
} from '@/lib/receipts/collection';

export function CollectionReceipt({
  receipt,
  community,
  operator,
}: {
  readonly receipt: Receipt;
  readonly community: string;
  readonly operator: string;
}) {
  const t = useTranslations('CollectionReceipt');
  const [error, setError] = useState(false);
  const rawFields: readonly (readonly [string, string])[] = [
    [t('community'), community],
    [t('operator'), operator],
    [t('reference'), receipt.reference],
    [t('collector'), receipt.collectorReference ?? t('unknownCollector')],
    [t('recordedAt'), receipt.recordedAt],
    [t('material'), receipt.material],
    [t('weight'), t('kg', { value: receipt.weightKg.toFixed(3) })],
    [t('estimate'), t('sats', { value: receipt.estimatedSats })],
    [t('sync'), t(`states.${receipt.syncState}`)],
  ];
  const fields = rawFields.map(([label, value]) => [label, receiptLine(value)] as const);

  function download() {
    setError(false);
    let url: string | undefined;
    let anchor: HTMLAnchorElement | undefined;
    try {
      const text = receiptText({
        title: t('title'),
        privateNotice: t('privateNotice'),
        limitation: t('limitation'),
        paymentNotice: t('paymentNotice'),
        disputeNotice: t('disputeNotice'),
        fields,
      });
      url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
      anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = receiptFilename(receipt.reference);
      document.body.append(anchor);
      anchor.click();
    } catch {
      setError(true);
    } finally {
      anchor?.remove();
      // Give the browser a task to start the local download before releasing its object URL.
      const releaseUrl = url;
      if (releaseUrl) setTimeout(() => URL.revokeObjectURL(releaseUrl), 0);
    }
  }

  return (
    <Drawer.Root autoFocus onOpenChange={() => setError(false)}>
      <Drawer.Trigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="mt-2 min-h-11"
          aria-label={t('openFor', { reference: receipt.reference })}
        >
          <ReceiptText className="size-4" aria-hidden="true" />
          {t('open')}
        </Button>
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-foreground/45" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[90dvh] max-w-lg flex-col rounded-t-2xl bg-background pb-[max(0.5rem,env(safe-area-inset-bottom))]"
          data-testid="collection-receipt"
        >
          <div
            role="region"
            aria-label={t('details')}
            tabIndex={0}
            className="min-h-0 space-y-4 overflow-y-auto p-4 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Drawer.Title className="font-display text-xl font-bold">{t('title')}</Drawer.Title>
            <Drawer.Description className="text-sm text-muted-foreground">
              {t('limitation')}
            </Drawer.Description>
            <dl className="space-y-3 text-sm">
              {fields.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="break-words font-medium [overflow-wrap:anywhere]">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="rounded-lg border border-border bg-secondary p-3 text-sm">
              {t('paymentNotice')}
            </p>
            <p className="text-sm text-muted-foreground">{t('disputeNotice')}</p>
            <p className="text-xs text-muted-foreground">{t('privateNotice')}</p>
          </div>
          <div className="shrink-0 space-y-2 border-t border-border px-4 pt-3">
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {t('downloadError')}
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" onClick={download} className="min-h-11 min-w-0 px-2">
                {t('download')}
              </Button>
              <Drawer.Close asChild>
                <Button type="button" variant="outline" className="min-h-11 min-w-0 px-2">
                  {t('close')}
                </Button>
              </Drawer.Close>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
