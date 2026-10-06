// SPDX-License-Identifier: AGPL-3.0-only
'use client';

import { CircleCheck, TriangleAlert, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useApi, useAutoRefresh } from '@/components/console/hooks';
import { DataState, KeyValue, PageHeader, Panel } from '@/components/console/kit';
import { Button } from '@/components/ui/button';
import { formatSats } from '@/lib/console/format';

export type HotWalletSummary = {
  hotWallet: {
    available: number | null;
    asOf: string | null;
    lowBalance: boolean | null;
    error: string | null;
  };
  pendingPayouts: { count: number; totalSats: number; unpricedCount: number };
  estimatedRequiredFloatSats: number;
  availableAfterQueueSats: number | null;
  lowBalanceThresholdSats: number;
  insufficientFunds: boolean | null;
  fundingManagedExternally: boolean;
  approvalMode: string;
};

/** Operational float only. Never a wallet, payment composer or treasury vote. */
export function HotWallet() {
  const t = useTranslations('Console.hotWallet');
  const overview = useApi<HotWalletSummary>('/hot-wallet');
  useAutoRefresh(overview.reload);
  const data = overview.data;
  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('intro')}
        actions={
          <Button variant="outline" size="sm" onClick={overview.reload}>
            {t('refresh')}
          </Button>
        }
      />
      <DataState loading={overview.loading} error={overview.error} onRetry={overview.reload}>
        {data ? (
          <>
            <div
              role="status"
              className="flex items-start gap-3 rounded-xl border border-border bg-secondary p-4"
            >
              {data.hotWallet.error || data.insufficientFunds || data.hotWallet.lowBalance ? (
                <TriangleAlert aria-hidden="true" className="size-6 shrink-0" />
              ) : (
                <CircleCheck aria-hidden="true" className="size-6 shrink-0 text-primary" />
              )}
              <p className="font-display font-medium">
                {data.hotWallet.error
                  ? t('unreadable')
                  : data.insufficientFunds
                    ? t('insufficient')
                    : data.hotWallet.lowBalance
                      ? t('low')
                      : t('ready')}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                [t('balance'), data.hotWallet.available],
                [t('pending'), data.pendingPayouts.totalSats],
                [t('afterQueue'), data.availableAfterQueueSats],
              ].map(([label, amount]) => (
                <Panel key={String(label)} title={String(label)}>
                  <p className="font-mono text-2xl font-bold">
                    {formatSats(typeof amount === 'number' ? amount : null)}
                  </p>
                </Panel>
              ))}
            </div>
            <Panel title={t('coverage')}>
              <KeyValue
                items={[
                  { k: t('pendingCount'), v: data.pendingPayouts.count },
                  { k: t('unpricedCount'), v: data.pendingPayouts.unpricedCount },
                  { k: t('required'), v: formatSats(data.estimatedRequiredFloatSats) },
                  { k: t('threshold'), v: formatSats(data.lowBalanceThresholdSats) },
                  {
                    k: t('policy'),
                    v: data.approvalMode === 'risk_based' ? t('riskBased') : t('legacy'),
                  },
                ]}
              />
              <p className="mt-3 text-sm text-muted-foreground">{t('estimateHint')}</p>
            </Panel>
          </>
        ) : null}
      </DataState>
      <Panel title={t('externalTitle')}>
        <div className="flex items-start gap-3">
          <Wallet aria-hidden="true" className="size-6 shrink-0 text-primary" />
          <p className="text-sm text-muted-foreground">{t('externalBody')}</p>
        </div>
      </Panel>
    </div>
  );
}
