// POST /api/nexus/messages/match
// Backfill: run the CRM auto-matcher over recent unlinked threads so historical
// email conversations attach to their opportunities/customers. Safe to re-run.
// Body (optional): { limit?, channel_id? }

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { matchUnlinkedThreads } from '@/lib/email-match'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  await getCurrentUser() // auth gate — any signed-in portal user may trigger a backfill
  let body: any = {}
  try {
    body = await req.json()
  } catch {
    /* empty body is fine */
  }
  const result = await matchUnlinkedThreads(supabase, {
    limit: Math.min(Number(body?.limit) || 200, 500),
    channelId: body?.channel_id,
  })
  return NextResponse.json({ ok: true, ...result })
}
