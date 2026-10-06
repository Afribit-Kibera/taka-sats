// SPDX-License-Identifier: AGPL-3.0-only
import { roleHasScope, type Role, type Scope } from '@/lib/auth/permissions';

export const NAV_GROUPS = ['groupWork', 'groupReview', 'groupProgramme'] as const;
export type NavGroup = (typeof NAV_GROUPS)[number];
export type NavItem = {
  readonly key: string;
  readonly href: string;
  readonly scope: Scope | null;
  readonly group: NavGroup;
};

const ITEMS: readonly NavItem[] = [
  { key: 'overview', href: '/admin', scope: null, group: 'groupWork' },
  { key: 'collectors', href: '/collectors', scope: 'collector:authorize', group: 'groupWork' },
  { key: 'events', href: '/events', scope: 'collector:read', group: 'groupWork' },
  { key: 'cards', href: '/cards', scope: 'collector:enrol', group: 'groupWork' },
  { key: 'fieldApp', href: '/weigh', scope: 'collection:record', group: 'groupWork' },
  { key: 'review', href: '/review', scope: 'payout:approve', group: 'groupReview' },
  { key: 'payouts', href: '/payouts', scope: 'payout:read', group: 'groupReview' },
  { key: 'hotWallet', href: '/hot-wallet', scope: 'treasury:read', group: 'groupReview' },
  { key: 'anomalies', href: '/anomalies', scope: 'anomaly:review', group: 'groupReview' },
  {
    key: 'reconciliation',
    href: '/reconciliation',
    scope: 'reconciliation:read',
    group: 'groupReview',
  },
  { key: 'ledger', href: '/ledger', scope: 'ledger:read', group: 'groupReview' },
  { key: 'sessions', href: '/sessions', scope: 'session:configure', group: 'groupProgramme' },
  { key: 'rates', href: '/rates', scope: 'session:configure', group: 'groupProgramme' },
  { key: 'rotations', href: '/rotations', scope: 'session:configure', group: 'groupProgramme' },
  { key: 'staff', href: '/staff', scope: 'session:configure', group: 'groupProgramme' },
];

/** Presentation follows the real permissions; APIs remain the security boundary. */
export function consoleNavFor(role: Role): readonly NavItem[] {
  if (role !== 'admin' && role !== 'hub_lead') return [];
  return ITEMS.filter((item) => item.scope === null || roleHasScope(role, item.scope));
}
