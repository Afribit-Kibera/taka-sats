// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { PUBLIC_DOCS } from '@/lib/docs';
import { SOURCE_CODE_URL } from '@/lib/site';

export default async function DocsLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('Docs');
  const topics = (
    <ol className="mt-2 space-y-1">
      {PUBLIC_DOCS.map((doc) => (
        <li key={doc.slug}>
          <Link
            href={`/docs/${doc.slug}`}
            className="flex min-h-11 items-center rounded-md px-2 text-sm text-primary hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring"
          >
            {t(`${doc.key}Title`)}
          </Link>
        </li>
      ))}
    </ol>
  );
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#docs-content"
        className="sr-only focus:not-sr-only focus:block focus:p-4 focus:text-primary focus:underline"
      >
        {t('skip')}
      </a>
      <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-8">
        <Link href="/" aria-label={t('home')}>
          <Image
            src="/taka-sats-logo.png"
            alt="Taka Sats"
            width={174}
            height={52}
            className="h-11 w-auto"
          />
        </Link>
        <nav
          aria-label={t('topNav')}
          className="flex flex-wrap items-center gap-5 text-sm font-medium"
        >
          <Link
            href="/communities"
            className="inline-flex min-h-11 items-center text-primary underline"
          >
            {t('communities')}
          </Link>
          <a
            href={SOURCE_CODE_URL}
            className="inline-flex min-h-11 items-center text-primary underline"
          >
            {t('source')}
          </a>
        </nav>
      </header>
      <div className="mx-auto grid max-w-7xl items-start gap-8 px-4 pb-16 pt-6 sm:px-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
        <aside className="rounded-xl border border-border bg-card p-4 lg:sticky lg:top-5">
          <details className="lg:hidden">
            <summary className="min-h-11 cursor-pointer py-2 font-display font-bold">
              {t('navigation')}
            </summary>
            <nav aria-label={t('navigation')}>
              <Link
                href="/docs"
                className="inline-flex min-h-11 items-center font-display font-bold"
              >
                {t('title')}
              </Link>
              {topics}
            </nav>
          </details>
          <nav aria-label={t('navigation')} className="hidden lg:block">
            <Link
              href="/docs"
              className="inline-flex min-h-11 items-center font-display text-lg font-bold"
            >
              {t('title')}
            </Link>
            {topics}
          </nav>
        </aside>
        <main id="docs-content" className="min-w-0 max-w-4xl">
          <p className="mb-6 text-sm text-muted-foreground">{t('languageNote')}</p>
          {children}
        </main>
      </div>
    </div>
  );
}
