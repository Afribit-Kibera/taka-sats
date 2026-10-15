// SPDX-License-Identifier: AGPL-3.0-only

import { getTranslations } from 'next-intl/server';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { SessionSummary } from '@/components/weigh/SessionSummary';
import { getSettings } from '@/lib/config';

/**
 * The session rollup + queue (DESIGN §11.3). No `<SessionGate>`
 * — a supervisor can review what they've queued even after the session
 * window closes. All data is read from IndexedDB by the client component.
 */
export default async function SessionPage() {
  const t = await getTranslations('SessionSummary');
  const { community } = getSettings();

  return (
    <div className="space-y-6 px-5 py-6">
      <h1 className="font-display text-xl font-bold tracking-[-0.02em]">{t('title')}</h1>
      <SessionSummary community={community.name} operator={community.operator} />
      <div className="border-t border-border pt-4">
        <p className="mb-2 text-xs text-muted-foreground">{t('signOutNote')}</p>
        <SignOutButton className="min-h-11" />
      </div>
    </div>
  );
}
