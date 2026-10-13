// SPDX-License-Identifier: AGPL-3.0-only
import { NextResponse } from 'next/server';
import { requireScope } from '@/lib/auth/session';
import { errorResponse } from '@/lib/api/errors';
import { getDb } from '@/lib/db/client';
import { getCommunityReadiness } from '@/lib/community/queries';
import { hotWallet } from '@/lib/treasury/provider';

export async function GET(request: Request) {
  try {
    await requireScope('treasury:read', request);
    return NextResponse.json(
      await getCommunityReadiness(getDb(), hotWallet, !!process.env.BLINK_API_KEY?.trim()),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
