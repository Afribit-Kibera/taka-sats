// SPDX-License-Identifier: AGPL-3.0-only
'use client';
import { Settings2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { OfflineBadge } from './OfflineBadge';

export function FieldHeader() {
  const t = useTranslations('FieldSetup');
  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-background px-4 py-2">
      <Link href="/weigh" className="flex min-h-11 min-w-0 max-w-full flex-auto items-center gap-2">
        <Image
          src="/icon-192.png"
          alt=""
          width={32}
          height={32}
          className="size-[32px] shrink-0"
          priority
        />
        <span className="min-w-0 break-words font-display text-base font-bold">Taka Sats</span>
      </Link>
      <div className="ml-auto flex max-w-full min-w-0 items-center gap-1">
        <OfflineBadge className="min-w-0 px-2 text-xs" />
        <Link
          href="/setup"
          aria-label={t('setupLink')}
          className="flex size-[44px] shrink-0 items-center justify-center rounded-lg hover:bg-accent"
        >
          <Settings2 aria-hidden="true" className="size-5" />
        </Link>
      </div>
    </header>
  );
}
