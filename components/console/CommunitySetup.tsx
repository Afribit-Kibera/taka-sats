// SPDX-License-Identifier: AGPL-3.0-only
'use client';
import { CircleCheck, CircleHelp, ExternalLink, RefreshCw, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useApi } from '@/components/console/hooks';
import { DataState, KeyValue, PageHeader, Panel } from '@/components/console/kit';
import { Button } from '@/components/ui/button';
import { formatSats } from '@/lib/console/format';
import type { CommunityReadiness, LaunchCheck } from '@/lib/community/readiness';

const ORDER: LaunchCheck[] = ['reserve', 'blink', 'funding', 'session', 'rates', 'staff', 'field'];
export function CommunitySetup() {
  const t = useTranslations('CommunitySetup');
  const result = useApi<CommunityReadiness>('/community/readiness');
  const data = result.data;
  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('intro')}
        actions={
          <Button variant="outline" disabled={result.loading} onClick={() => void result.reload()}>
            <RefreshCw aria-hidden="true" />
            {t('refresh')}
          </Button>
        }
      />
      <DataState loading={result.loading} error={result.error} onRetry={result.reload}>
        {data ? (
          <>
            <Panel title={t('community', { name: data.community.name })}>
              <p className="text-sm text-muted-foreground">
                {t('managedBy', { operator: data.community.operator })}
              </p>
              <p className="mt-3 font-display font-bold" role="status">
                {t(data.checklistComplete ? 'complete' : 'incomplete')}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{t('snapshot')}</p>
            </Panel>
            <ol className="space-y-3">
              {ORDER.map((key, index) => {
                const state = data.checks[key];
                const Icon =
                  state === 'ready'
                    ? CircleCheck
                    : state === 'unknown'
                      ? CircleHelp
                      : TriangleAlert;
                return (
                  <li key={key} className="rounded-xl border border-border bg-card p-4 sm:p-5">
                    <div className="flex min-w-0 items-start gap-3">
                      <Icon aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h2 className="break-words font-display font-bold">
                            {index + 1}. {t(`${key}Title`)}
                          </h2>
                          <span className="text-sm font-medium">{t(state)}</span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {t(`${key}Body`)}
                        </p>
                        {key === 'reserve' ? (
                          <p className="mt-2 text-sm">
                            {data.reserve.operatorConfirmed
                              ? t('reservePolicy', {
                                  wallet: data.reserve.walletLabel ?? '',
                                  required: data.reserve.requiredSignatures,
                                  total: data.reserve.totalSigners,
                                })
                              : t('reserveUnconfirmed')}
                            {!data.reserve.operatorConfirmed && data.reserve.walletLabel ? (
                              <span className="mt-2 block">
                                {t('reservePlannedPolicy', {
                                  wallet: data.reserve.walletLabel,
                                  required: data.reserve.requiredSignatures,
                                  total: data.reserve.totalSigners,
                                })}
                              </span>
                            ) : null}
                          </p>
                        ) : null}
                        {key === 'funding' ? (
                          <div className="mt-3">
                            <KeyValue
                              items={[
                                { k: t('balance'), v: formatSats(data.wallet.hotWallet.available) },
                                {
                                  k: t('liability'),
                                  v: formatSats(data.wallet.pendingPayouts.totalSats),
                                },
                                { k: t('unpriced'), v: data.wallet.pendingPayouts.unpricedCount },
                              ]}
                            />
                            <Link
                              href="/hot-wallet"
                              className="mt-3 inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4"
                            >
                              {t('openWallet')}
                            </Link>
                          </div>
                        ) : null}
                        {key === 'session' && data.field.nextSessionEnd ? (
                          <p className="mt-2 break-words text-sm">
                            {t('sessionEnd', {
                              end: new Date(data.field.nextSessionEnd).toLocaleString(),
                            })}
                          </p>
                        ) : null}
                        {key === 'staff' ? (
                          <p className="mt-2 text-sm">
                            {t('staffCounts', {
                              enrolled: data.field.enrolledStaff,
                              total: data.field.productionStaff,
                              legacy: data.field.legacyStaff,
                            })}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        ) : null}
      </DataState>
      <Panel title={t('guideTitle')}>
        <p className="text-sm text-muted-foreground">{t('guideBody')}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/start-community">
            {t('guideLink')}
            <ExternalLink aria-hidden="true" />
          </Link>
        </Button>
      </Panel>
    </div>
  );
}
