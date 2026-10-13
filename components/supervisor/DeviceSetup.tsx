// SPDX-License-Identifier: AGPL-3.0-only
'use client';
import { Camera, MapPin, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { PhoneSecurityCard } from '@/components/auth/PhoneSecurityCard';
import { InstallCard } from './InstallCard';
import { useFieldPermissions } from './FieldPermissions';

/** Setup is optional after phone enrollment; field data downloads when Collections opens. */
export function DeviceSetup({ securityRequired = false }: { readonly securityRequired?: boolean }) {
  const t = useTranslations('FieldSetup');
  const f = useTranslations('Field');
  const { states, busy, request } = useFieldPermissions();
  if (securityRequired) return <PhoneSecurityCard required />;
  return (
    <div className="space-y-4">
      <InstallCard compact />
      <section
        className="space-y-3 rounded-xl border border-border bg-card p-4"
        aria-labelledby="permissions-heading"
      >
        <h2 id="permissions-heading" className="font-display font-bold">
          {t('permissionsTitle')}
        </h2>
        <p className="text-xs text-muted-foreground">{f('permissionsHint')}</p>
        {(['camera', 'geolocation'] as const).map((name) => {
          const Icon = name === 'camera' ? Camera : MapPin;
          return (
            <div key={name} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2">
                <Icon aria-hidden="true" className="size-4 text-primary" />
                {t(name)}
              </span>
              <span role="status">{t(states[name])}</span>
            </div>
          );
        })}
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={busy}
          onClick={() => void request()}
        >
          {f(busy ? 'requestingPermissions' : 'allowPermissions')}
        </Button>
        <p className="text-xs text-muted-foreground">{f('nfcOptional')}</p>
      </section>
      <details className="rounded-xl border border-border bg-card p-4">
        <summary className="cursor-pointer font-display text-sm font-medium">
          {f('phoneSecurity')}
        </summary>
        <div className="mt-3">
          <PhoneSecurityCard />
        </div>
      </details>
      <Button asChild size="pwa">
        <Link href="/weigh">
          {f('backToCollections')}
          <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
    </div>
  );
}
