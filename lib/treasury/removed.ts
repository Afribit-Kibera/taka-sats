// SPDX-License-Identifier: AGPL-3.0-only
import { NextResponse } from 'next/server';
import { errorResponse } from '@/lib/api/errors';
import { requireScope } from '@/lib/auth/session';

/** Retired routes remain authenticated, but cannot change historical funding records. */
export async function treasuryWorkflowRemoved(request?: Request): Promise<NextResponse> {
  try {
    await requireScope('treasury:read', request);
    return NextResponse.json(
      {
        error: {
          code: 'feature_removed',
          message:
            'Fund the operating wallet externally. Treasury governance is not part of Taka Sats.',
        },
      },
      { status: 410 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
