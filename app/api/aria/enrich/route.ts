/**
 * POST /api/aria/enrich
 *
 * Fires an Inngest background re-enrichment job for a known property.
 * Called by the ARIA page when a cache hit is stale (> 14 days old).
 *
 * v9: Pass propertyId when available — Inngest will use targeted rehydration
 * (~$0.005) instead of the full pipeline (~$0.35) when propertyId is set.
 *
 * The Inngest job upserts fresh data to aria_properties. The ARIA page receives
 * a Supabase Realtime UPDATE notification when the job completes.
 *
 * Body:    { query: string; propertyId?: string }
 * Returns: { queued: true } | { error: string }
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/current-user';
import { inngest } from '@/inngest/client';

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let query: string;
  let propertyId: string | undefined;
  try {
    const body = await req.json();
    query = (body.query ?? '').trim();
    propertyId = body.propertyId ? String(body.propertyId) : undefined
    if (!query) return NextResponse.json({ error: 'query is required' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  await inngest.send({
    name: 'aria/property.enrich',
    data: { query, userId: user.id, propertyId },
  });

  return NextResponse.json({
    queued: true,
    path: propertyId ? 'targeted' : 'full_pipeline',
  });
}
