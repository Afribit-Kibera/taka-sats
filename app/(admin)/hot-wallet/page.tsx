// SPDX-License-Identifier: AGPL-3.0-only
import { HotWallet } from '@/components/console/HotWallet';
import { requirePageScope } from '@/lib/auth/page-guard';

export default async function HotWalletPage() {
  await requirePageScope('treasury:read');
  return <HotWallet />;
}
