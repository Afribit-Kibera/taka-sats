// SPDX-License-Identifier: AGPL-3.0-only

import { getTranslations } from 'next-intl/server';
import { CardWriter } from '@/components/collectors/CardWriter';

/** Write and check collector NFC cards (Android Chrome, Web NFC). */
export default async function CardsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ collector?: string }>;
}) {
  const t = await getTranslations('Cards');
  const { collector } = await searchParams;

  return (
    <div className="space-y-6 px-5 py-6">
      <h1 className="font-display text-xl font-bold tracking-[-0.02em]">{t('title')}</h1>
      <CardWriter initialCollectorId={collector} />
    </div>
  );
}
