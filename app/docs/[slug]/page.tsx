// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { DocsArticle } from '@/components/public/DocsArticle';
import { findPublicDoc, PUBLIC_DOCS } from '@/lib/docs';
import { publicDocContent } from '@/lib/docs-content';
import { SOURCE_CODE_URL } from '@/lib/site';

export const dynamicParams = false;
export function generateStaticParams() {
  return PUBLIC_DOCS.map(({ slug }) => ({ slug }));
}
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const doc = findPublicDoc((await params).slug);
  if (!doc) notFound();
  const t = await getTranslations('Docs');
  return {
    title: t(`${doc.key}Title`),
    description: t(`${doc.key}Body`),
    alternates: { canonical: `/docs/${doc.slug}` },
  };
}
export default async function DocPage({ params }: Props) {
  const doc = findPublicDoc((await params).slug);
  if (!doc) notFound();
  const [content, t] = await Promise.all([publicDocContent(doc.slug), getTranslations('Docs')]);
  if (content === null) notFound();
  return (
    <>
      <DocsArticle content={content} tableLabel={t('tableLabel')} codeLabel={t('codeLabel')} />
      <a
        href={`${SOURCE_CODE_URL}/blob/main/docs/${doc.file}`}
        className="mt-10 inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4"
      >
        {t('edit')}
      </a>
    </>
  );
}
