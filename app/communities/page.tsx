// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getSettings } from '@/lib/config';
import { Button } from '@/components/ui/button';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Communities');
  return { title: t('title'), description: t('intro'), alternates: { canonical: '/communities' } };
}
export default async function CommunitiesPage() {
  const t = await getTranslations('Communities');
  const community = getSettings().community;
  return (
    <main className="mx-auto min-h-screen max-w-4xl space-y-8 px-4 py-8 sm:px-8">
      <nav
        className="flex min-h-11 flex-wrap items-center justify-between gap-4"
        aria-label={t('navigation')}
      >
        <Link href="/" className="font-display font-bold text-primary underline">
          Taka Sats
        </Link>
        <Link href="/docs" className="text-primary underline">
          {t('docs')}
        </Link>
      </nav>
      <h1 className="font-display text-4xl font-bold tracking-tight">{t('title')}</h1>
      <p className="text-lg leading-8 text-muted-foreground">{t('intro')}</p>
      <section className="space-y-4 rounded-xl border border-border bg-card p-5 sm:p-8">
        <p className="text-sm font-medium text-primary">{t('first')}</p>
        <h2 className="font-display text-2xl font-bold">{community.name}</h2>
        <p className="leading-7 text-muted-foreground">
          {t('operator', { operator: community.operator })}
        </p>
        <p className="leading-7 text-muted-foreground">{t('scope')}</p>
        <Button asChild>
          <Link href="/install">{t('open', { name: community.name })}</Link>
        </Button>
      </section>
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-bold">{t('networkTitle')}</h2>
        <p className="leading-8 text-muted-foreground">{t('networkBody')}</p>
        <div className="flex flex-wrap gap-4">
          <Link
            href="/docs/run-your-community"
            className="inline-flex min-h-11 items-center text-primary underline"
          >
            {t('start')}
          </Link>
          <Link
            href="/docs/community-network"
            className="inline-flex min-h-11 items-center text-primary underline"
          >
            {t('plan')}
          </Link>
        </div>
      </section>
    </main>
  );
}
