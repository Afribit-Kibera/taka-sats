// SPDX-License-Identifier: AGPL-3.0-only
'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

/** The field pane scrolls above the footer, so navigation never covers inputs or save actions. */
export function FieldContent({ children }: { readonly children: ReactNode }) {
  const pane = useRef<HTMLElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    pane.current?.scrollTo({ top: 0 });
  }, [pathname]);
  return (
    <main
      ref={pane}
      data-field-scroll
      className="min-h-0 min-w-0 flex-1 overflow-y-auto"
      onFocusCapture={(event) => {
        const target = event.target;
        if (target instanceof HTMLElement && target.matches('input,textarea,select,button,a'))
          target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }}
    >
      {children}
    </main>
  );
}
