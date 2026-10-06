// SPDX-License-Identifier: AGPL-3.0-only

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse } from '@/lib/api/errors';
import { revokeApiKey } from '@/lib/auth/api-keys';
import { requireAdminSession } from '@/lib/auth/session';
import { getDb } from '@/lib/db/client';

const paramsSchema = z.object({ id: z.uuid() });
type RouteParams = { readonly params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const actor = await requireAdminSession(request);
    const { id } = paramsSchema.parse(await params);
    return NextResponse.json(
      { key: await revokeApiKey(getDb(), id, actor.id) },
      {
        headers: { 'Cache-Control': 'private, no-store' },
      },
    );
  } catch (error) {
    const response = errorResponse(error);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }
}
