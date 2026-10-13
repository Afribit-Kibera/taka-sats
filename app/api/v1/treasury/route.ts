// SPDX-License-Identifier: AGPL-3.0-only

/**
 * `GET /api/v1/treasury` (also /hot-wallet): read-only operating balance and priced queue liability.
 * Funding and reserve governance remain external. Scope treasury:read (admin/hub lead).
 * Unknown balance stays null and carries hotWallet.error, never a fabricated zero.
 */

import { NextResponse } from 'next/server';
import { errorResponse } from '@/lib/api/errors';
import { requireScope } from '@/lib/auth/session';
import { getDb } from '@/lib/db/client';
import { getOperatingWallet } from '@/lib/treasury/operating';
import { hotWallet } from '@/lib/treasury/provider';

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireScope('treasury:read', request);
    return NextResponse.json(await getOperatingWallet(getDb(), hotWallet));
  } catch (error) {
    return errorResponse(error);
  }
}
