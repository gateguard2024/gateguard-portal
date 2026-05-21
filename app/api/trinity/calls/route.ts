import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── GET /api/trinity/calls ───────────────────────────────────────────────────
// Returns last 50 trinity_calls ordered by created_at DESC.
// Accepts optional query params: direction, sentiment, outcome, lead_id

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const direction  = searchParams.get('direction')
  const sentiment  = searchParams.get('sentiment')
  const outcome    = searchParams.get('outcome')
  const lead_id    = searchParams.get('lead_id')
  const limit      = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)

  let query = supabase
    .from('trinity_calls')
    .select(`
      id, direction, phone_number, contact_name,
      duration_seconds, sentiment, outcome, ai_summary,
      recording_url, twilio_call_sid,
      lead_id, opportunity_id, dealer_org_id,
      created_at, updated_at
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  // Org isolation — corporate sees all, dealers see only their own
  if (!user.isCorporate && user.org_id) {
    query = query.eq('dealer_org_id', user.org_id)
  }

  if (direction) query = query.eq('direction', direction)
  if (sentiment) query = query.eq('sentiment', sentiment)
  if (outcome)   query = query.eq('outcome', outcome)
  if (lead_id)   query = query.eq('lead_id', lead_id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Aggregate stats
  const calls = data ?? []
  const today = new Date().toISOString().slice(0, 10)
  const thisWeekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const stats = {
    calls_today:     calls.filter(c => c.created_at.startsWith(today)).length,
    calls_this_week: calls.filter(c => c.created_at >= thisWeekStart).length,
    qualified:       calls.filter(c => c.outcome === 'qualified').length,
    avg_duration:    calls.length > 0
      ? Math.round(calls.reduce((s, c) => s + (c.duration_seconds ?? 0), 0) / calls.length)
      : 0,
  }

  return NextResponse.json({ calls, stats })
}
