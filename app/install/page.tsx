// SPDX-License-Identifier: AGPL-3.0-only
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { InstallCard } from '@/components/supervisor/InstallCard';

export default async function InstallPage() {
  const t = await getTranslations('FieldSetup');
  return (
    <main className="mx-auto min-h-dvh max-w-md space-y-6 px-5 py-10">
      <h1 className="font-display text-3xl font-bold">{t('handoffTitle')}</h1>
      <p className="text-muted-foreground">{t('supportedPhone')}</p>
      <InstallCard />
      <ol className="list-decimal space-y-3 pl-5 text-sm">
        <li>{t('handoffInstall')}</li>
        <li>{t('handoffLogin')}</li>
        <li>{t('handoffSetup')}</li>
        <li>{t('handoffCard')}</li>
      </ol>
      <Link
        href="/setup"
        className="flex min-h-14 items-center justify-center rounded-lg bg-primary px-4 font-display font-bold text-primary-foreground"
      >
        {t('signInSetup')}
      </Link>
      <p className="text-sm text-muted-foreground">{t('approvalHint')}</p>
    </main>
  );
}
