// SPDX-License-Identifier: AGPL-3.0-only
import { ArrowRight, ShieldCheck, Users, Wallet } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export async function CommunityFunding() {
  const t = await getTranslations('CommunityModel');
  const cards = [
    { Icon: ShieldCheck, title: t('reserveTitle'), body: t('reserveBody') },
    { Icon: Wallet, title: t('blinkTitle'), body: t('blinkBody') },
    { Icon: Users, title: t('recipientTitle'), body: t('recipientBody') },
  ];
  return (
    <section id="community-funding" className="space-y-5" aria-labelledby="funding-title">
      <p className="font-display text-sm font-bold uppercase tracking-wide text-primary">
        {t('eyebrow')}
      </p>
      <h2 id="funding-title" className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
        {t('title')}
      </h2>
      <p className="max-w-3xl leading-7 text-muted-foreground">{t('intro')}</p>
      <ol className="grid gap-4 md:grid-cols-3">
        {cards.map(({ Icon, title, body }, index) => (
          <li key={title} className="rounded-xl border border-border bg-card p-5">
            <Icon aria-hidden="true" className="size-7 text-primary" />
            <h3 className="mt-4 font-display text-xl font-bold">
              {index + 1}. {title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted-foreground">{t('note')}</p>
      <Link
        href="/start-community"
        className="inline-flex min-h-11 items-center gap-2 font-display font-bold text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
      >
        {t('guide')}
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </section>
  );
}
