// SPDX-License-Identifier: AGPL-3.0-only
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { InstallCard } from '@/components/supervisor/InstallCard';
import { getSettings } from '@/lib/config';

export default async function InstallPage() {
  const t = await getTranslations('FieldSetup');
  return (
    <main className="mx-auto min-h-dvh max-w-lg space-y-4 p-4 pt-8">
      <h1 className="font-display text-2xl font-bold">{t('handoffTitle')}</h1>
      <p className="text-sm font-medium">
        {t('managedCommunity', {
          name: getSettings().community.name,
          operator: getSettings().community.operator,
        })}
      </p>
      <p className="text-sm text-muted-foreground">{t('supportedPhone')}</p>
      <InstallCard />
      <ol className="list-decimal space-y-3 pl-5 text-sm">
        <li>{t('handoffInstall')}</li>
        <li>{t('handoffLogin')}</li>
        <li>{t('handoffSetup')}</li>
      </ol>
      <Link
        href="/weigh"
        className="flex min-h-14 items-center justify-center rounded-lg bg-primary px-4 font-display font-bold text-primary-foreground"
      >
        {t('signInSetup')}
      </Link>
      <p className="text-sm text-muted-foreground">{t('approvalHint')}</p>
    </main>
  );
}
