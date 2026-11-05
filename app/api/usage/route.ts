/**
 * POST /api/usage { area } — records that the signed-in person opened a Nexus area
 * (bottom-bar tab, Admin, Help…). Feeds Executive Lexi's "what's used / not used"
 * (lib/lexi/workstreams.ts). The app sends at most one per area per 10 minutes.
 * Stores only who, which company, and which area — nothing on the page.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { isSignedIn } from '@/lib/assistant-executor'

export const dynamic = 'force-dynamic'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!isSignedIn(user)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const area = typeof body?.area === 'string' ? body.area.trim().toLowerCase().slice(0, 40) : ''
  if (!/^[a-z0-9:_-]+$/.test(area)) return NextResponse.json({ error: 'area is required' }, { status: 400 })
  const { error } = await sb.from('nexus_usage').insert({ user_id: user.id, org_id: user.org_id, org_tier: user.org_tier, role: user.role, area })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
