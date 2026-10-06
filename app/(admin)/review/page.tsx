// SPDX-License-Identifier: AGPL-3.0-only
import { Suspense } from 'react';
import { Payouts } from '@/components/console/Payouts';
import { requirePageScope } from '@/lib/auth/page-guard';

export default async function ReviewPage() {
  await requirePageScope('payout:approve');
  return (
    <Suspense fallback={null}>
      <Payouts reviewOnly />
    </Suspense>
  );
}
