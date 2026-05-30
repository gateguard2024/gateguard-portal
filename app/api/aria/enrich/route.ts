/**
 * POST /api/aria/enrich
 *
 * Fires an Inngest background re-enrichment job for a known property.
 * Called by the ARIA page when a cache hit is stale (> 14 days old).
 *
 * The Inngest job calls /api/aria/research/deep with x-service-key auth,
 * and upserts the fresh result to aria_properties. The ARIA page polls
 * /api/aria/cache every 6s and auto-refreshes the result when done.
 *
 * Body:    { query: string }
 * Returns: { queued: true } | { error: string }
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/current-user';
import { inngest } from '@/inngest/client';

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let query: string;
  try {
    const body = await req.json();
    query = (body.query ?? '').trim();
    if (!query) return NextResponse.json({ error: 'query is required' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  await inngest.send({
    name: 'aria/property.enrich',
    data: { query, userId: user.id },
  });

  return NextResponse.json({ queued: true });
}
