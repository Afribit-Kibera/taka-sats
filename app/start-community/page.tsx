// SPDX-License-Identifier: AGPL-3.0-only
import { ArrowRight, ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { getSettings } from '@/lib/config';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('StartCommunity');
  return {
    title: t('title'),
    description: t('intro'),
    alternates: { canonical: '/start-community' },
  };
}
export default async function StartCommunityPage() {
  const t = await getTranslations('StartCommunity');
  const community = getSettings().community;
  return (
    <main className="mx-auto min-h-screen max-w-4xl space-y-8 px-4 py-6 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/" aria-label={t('home')}>
          <Image
            src="/taka-sats-logo.png"
            width={174}
            height={52}
            alt="Taka Sats"
            className="h-11 w-auto"
          />
        </Link>
        <Button asChild>
          <Link href="/install">
            {t('install')}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </header>
      <div className="space-y-4 pt-4">
        <p className="font-display text-sm font-bold uppercase tracking-wide text-primary">
          {t('eyebrow')}
        </p>
        <h1 className="break-words font-display text-4xl font-bold tracking-tight sm:text-5xl">
          {t('title')}
        </h1>
        <p className="max-w-3xl text-lg leading-8 text-muted-foreground">{t('intro')}</p>
      </div>
      <ol className="space-y-5">
        {['members', 'blink', 'fund', 'team', 'field'].map((key, index) => (
          <li key={key} className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <h2 className="font-display text-xl font-bold">
              {index + 1}. {t(`${key}Title`)}
            </h2>
            <p className="mt-3 leading-7 text-muted-foreground">{t(`${key}Body`)}</p>
            {key === 'fund' ? <p className="mt-3 text-sm font-medium">{t('fundConfirm')}</p> : null}
            {key === 'members' ? (
              <a
                className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4"
                href="https://bluewallet.io/how-to-create-a-multisig-vault-in-bluewallet/"
              >
                {t('blueGuide')}
              </a>
            ) : null}
          </li>
        ))}
      </ol>
      <section className="rounded-xl bg-secondary p-5 sm:p-6">
        <h2 className="font-display text-xl font-bold">
          {t('managedTitle', { name: community.name })}
        </h2>
        <p className="mt-3 leading-7 text-muted-foreground">
          {t('managedBody', { name: community.name, operator: community.operator })}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/community-setup">
              {t('checklist')}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <a href="https://dashboard.blink.sv">
              {t('blinkDashboard')}
              <ExternalLink aria-hidden="true" />
            </a>
          </Button>
        </div>
      </section>
      <p className="pb-8 text-sm text-muted-foreground">
        {t('technicalGuide')}{' '}
        <a
          className="text-primary underline underline-offset-4"
          href="https://dev.blink.sv/api/btc-onchain-receive"
        >
          {t('depositDocs')}
        </a>
      </p>
    </main>
  );
}
