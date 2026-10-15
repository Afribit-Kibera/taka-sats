// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { PUBLIC_DOCS } from '@/lib/docs';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Docs');
  return { title: t('title'), description: t('intro'), alternates: { canonical: '/docs' } };
}
export default async function DocsIndex() {
  const t = await getTranslations('Docs');
  return (
    <div className="space-y-7">
      <h1 className="font-display text-4xl font-bold tracking-tight">{t('title')}</h1>
      <p className="text-lg leading-8 text-muted-foreground">{t('intro')}</p>
      <p className="rounded-xl border border-border bg-card p-5 leading-7">{t('status')}</p>
      <ol className="divide-y divide-border">
        {PUBLIC_DOCS.map((doc, index) => (
          <li key={doc.slug} className="py-5">
            <Link
              href={`/docs/${doc.slug}`}
              className="inline-flex min-h-11 items-center font-display text-xl font-bold text-primary underline underline-offset-4"
            >
              {index + 1}. {t(`${doc.key}Title`)}
            </Link>
            <p className="mt-1 leading-7 text-muted-foreground">{t(`${doc.key}Body`)}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
