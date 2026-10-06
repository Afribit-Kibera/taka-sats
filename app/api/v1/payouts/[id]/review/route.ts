// SPDX-License-Identifier: AGPL-3.0-only

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse } from '@/lib/api/errors';
import { requireScope } from '@/lib/auth/session';
import { getDb } from '@/lib/db/client';
import { enqueueProcessPayoutSafely } from '@/lib/jobs';
import { getPayoutView, payoutReviewSchema, reviewPayout } from '@/lib/payouts';

const paramsSchema = z.object({ id: z.uuid() });

export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    readonly params: Promise<{ id: string }>;
  },
): Promise<NextResponse> {
  try {
    const actor = await requireScope('payout:approve');
    const { id } = paramsSchema.parse(await params);
    const body = payoutReviewSchema.parse(await request.json());
    const db = getDb();
    const { payout, changed } = await reviewPayout(db, {
      ...body,
      payoutId: id,
      actor: { id: actor.id, role: actor.role },
    });
    if (changed && body.decision === 'approved') {
      await enqueueProcessPayoutSafely({ payoutId: payout.id });
    }
    return NextResponse.json({ payout: await getPayoutView(db, payout.id), changed });
  } catch (error) {
    return errorResponse(error);
  }
}
