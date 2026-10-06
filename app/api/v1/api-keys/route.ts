// SPDX-License-Identifier: AGPL-3.0-only

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse } from '@/lib/api/errors';
import { createApiKey, listApiKeys } from '@/lib/auth/api-keys';
import { requireAdminSession } from '@/lib/auth/session';
import { getDb } from '@/lib/db/client';
import { PAGE_DEFAULT, PAGE_MAX } from '@/lib/pagination';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(PAGE_MAX).default(PAGE_DEFAULT),
  cursor: z.string().min(1).optional(),
});
const noStore = { 'Cache-Control': 'private, no-store' };

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const actor = await requireAdminSession(request);
    const created = await createApiKey(getDb(), actor.id, await request.json().catch(() => ({})));
    return NextResponse.json(created, { status: 201, headers: noStore });
  } catch (error) {
    const response = errorResponse(error);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdminSession(request);
    const query = querySchema.parse({
      limit: request.nextUrl.searchParams.get('limit') ?? undefined,
      cursor: request.nextUrl.searchParams.get('cursor') ?? undefined,
    });
    return NextResponse.json(await listApiKeys(getDb(), query), { headers: noStore });
  } catch (error) {
    const response = errorResponse(error);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }
}
