// SPDX-License-Identifier: AGPL-3.0-only

/**
 * `GET /api/v1/treasury`: one payload for the treasury panel (FR-7.5): the hot-wallet float, the
 * cap and the room under it, the proposals still in flight, the payouts waiting for funds, and
 * the pool (a read-only balance is not configured, and the field says so). Scope `treasury:read`
 * (admin). A hot wallet that cannot be read does not fail the call: `hotWallet.error` says so.
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
