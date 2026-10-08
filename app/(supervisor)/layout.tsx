// SPDX-License-Identifier: AGPL-3.0-only

import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { auth } from '@/auth';
import { ModeBanner } from '@/components/console/ModeBanner';
import { BottomNav } from '@/components/supervisor/BottomNav';
import { SyncManager } from '@/components/supervisor/SyncManager';
import { SetupLink } from '@/components/supervisor/InstallCard';
import { isRole, roleHasScope } from '@/lib/auth/permissions';
import { DeviceSetup } from '@/components/supervisor/DeviceSetup';
import { getTranslations } from 'next-intl/server';

/**
 * Supervisor PWA shell (DESIGN §5.1 — thumb-first single column). Every route
 * under this group requires a signed-in staff session; no session → /login.
 */
export default async function SupervisorLayout({ children }: { readonly children: ReactNode }) {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !isRole(role) || !roleHasScope(role, 'collection:record')) {
    redirect('/login');
  }

  const t = await getTranslations('FieldSetup');
  const needsSecurity = session?.user.phoneSetupRequired;
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background shadow-[0_0_50px_rgb(20_20_20/0.08)]">
      <ModeBanner />
      <SetupLink />
      {!needsSecurity ? <SyncManager /> : null}
      <main className="flex-1">
        {needsSecurity ? (
          <div className="space-y-5 p-5">
            <h1 className="font-display text-2xl font-bold">{t('title')}</h1>
            <DeviceSetup securityRequired />
          </div>
        ) : (
          children
        )}
      </main>
      {!needsSecurity ? <BottomNav /> : null}
    </div>
  );
}
