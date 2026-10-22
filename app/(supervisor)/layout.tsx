// SPDX-License-Identifier: AGPL-3.0-only

import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { auth } from '@/auth';
import { ModeBanner } from '@/components/console/ModeBanner';
import { BottomNav } from '@/components/supervisor/BottomNav';
import { SyncManager } from '@/components/supervisor/SyncManager';
import { FieldHeader } from '@/components/supervisor/FieldHeader';
import { FieldContent } from '@/components/supervisor/FieldContent';
import { FieldPermissions } from '@/components/supervisor/FieldPermissions';
import { isRole, roleHasScope } from '@/lib/auth/permissions';
import { DeviceSetup } from '@/components/supervisor/DeviceSetup';
import { getTranslations } from 'next-intl/server';
import { getSettings } from '@/lib/config';

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
    <FieldPermissions enabled={!needsSecurity} staffId={session!.user.id}>
      <div className="field-shell mx-auto flex h-dvh w-full max-w-lg flex-col overflow-hidden bg-background shadow-[0_0_50px_rgb(20_20_20/0.08)]">
        <ModeBanner />
        <FieldHeader communityName={getSettings().community.name} />
        {!needsSecurity ? <SyncManager /> : null}
        <FieldContent>
          {needsSecurity ? (
            <div className="space-y-5 p-5">
              <h1 className="font-display text-2xl font-bold">{t('title')}</h1>
              <DeviceSetup securityRequired />
            </div>
          ) : (
            children
          )}
        </FieldContent>
        {!needsSecurity ? <BottomNav /> : null}
      </div>
    </FieldPermissions>
  );
}
