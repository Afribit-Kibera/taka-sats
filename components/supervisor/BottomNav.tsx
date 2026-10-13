// SPDX-License-Identifier: AGPL-3.0-only

'use client';

import { ClipboardPlus, ListChecks, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ComponentType, SVGProps } from 'react';
import { cn } from '@/lib/utils';
import { OPEN_COLLECTION_EVENT } from './field-actions';

/**
 * The supervisor PWA bottom tab bar (DESIGN §5.1 — "at most a 3–4 item bottom
 * tab bar": global manual Record action · Add collector · Activity).
 */
const TABS: { href: string; key: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { href: '/weigh', key: 'record', Icon: ClipboardPlus },
  { href: '/enrol', key: 'enrol', Icon: UserPlus },
  { href: '/session', key: 'session', Icon: ListChecks },
];

export function BottomNav() {
  const t = useTranslations('SupervisorNav');
  const field = useTranslations('Field');
  const pathname = usePathname();

  return (
    <nav
      aria-label={t('title')}
      className="z-10 grid shrink-0 grid-cols-3 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]"
    >
      {TABS.map(({ href, key, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? 'page' : undefined}
            aria-label={key === 'record' ? field('recordCollection') : undefined}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              if (key === 'record' && pathname === '/weigh') {
                event.preventDefault();
                window.dispatchEvent(new Event(OPEN_COLLECTION_EVENT));
              }
            }}
            className={cn(
              // ≥56px tall (M3-12 one-handed pass — comfortably in the thumb zone).
              'flex min-h-[60px] min-w-0 flex-col items-center justify-center gap-1 py-2 text-center font-display text-xs font-medium active:bg-accent/40',
              key === 'record'
                ? 'm-[4px] rounded-lg bg-primary text-primary-foreground active:bg-primary/90'
                : active
                  ? 'text-primary'
                  : 'text-muted-foreground',
            )}
          >
            <Icon aria-hidden="true" className="size-6" />
            <span className="w-full min-w-0 break-words text-center leading-snug">{t(key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
