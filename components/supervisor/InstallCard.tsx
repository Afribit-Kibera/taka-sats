// SPDX-License-Identifier: AGPL-3.0-only
'use client';

import { Download, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { usePwa } from './PwaProvider';

export function InstallCard({ compact = false }: { readonly compact?: boolean }) {
  const t = useTranslations('FieldSetup');
  const { standalone, canInstall, installAccepted, install } = usePwa();
  const [failed, setFailed] = useState(false);
  if (compact && standalone) return null;
  return (
    <section className="space-y-2 rounded-xl bg-secondary p-3" aria-labelledby="install-heading">
      <h2 id="install-heading" className="flex items-center gap-2 font-display text-sm font-bold">
        <Smartphone aria-hidden="true" className="size-4 text-primary" />
        {t('installTitle')}
      </h2>
      <p role="status" className="text-xs">
        {t(standalone ? 'installed' : installAccepted ? 'openInstalled' : 'installHint')}
      </p>
      {!standalone && !installAccepted ? (
        canInstall ? (
          <Button
            className="min-h-12 w-full"
            onClick={() => {
              setFailed(false);
              void install().catch(() => setFailed(true));
            }}
          >
            <Download aria-hidden="true" className="size-5" />
            {t('installButton')}
          </Button>
        ) : (
          <p className="text-xs">{t('manualInstall')}</p>
        )
      ) : null}
      {failed ? (
        <p role="alert" className="text-sm">
          {t('installFailed')}
        </p>
      ) : null}
    </section>
  );
}

export function SetupLink() {
  const t = useTranslations('FieldSetup');
  const { standalone } = usePwa();
  return (
    <Link
      href="/setup"
      className="flex min-h-11 items-center justify-center gap-2 border-b border-border px-4 py-2 text-sm text-primary"
    >
      <Smartphone aria-hidden="true" className="size-4" />
      {t(standalone ? 'setupLink' : 'installSetupLink')}
    </Link>
  );
}
