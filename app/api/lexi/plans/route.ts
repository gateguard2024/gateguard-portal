/**
 * /api/lexi/plans — Executive Lexi's plans for Russel (lib/lexi/exec.ts).
 *   GET                                   → { exec, plans, record, market } (exec:false for everyone else)
 *   POST { id, action: 'approve' | 'change' | 'reject', note? }   decide a plan (approve creates its actions)
 *   POST { id, action: 'outcome', outcome: 'worked'|'partly'|'did_not', note? }   rate how it turned out
 *   POST { action: 'brief', slot? }       a brief right now (saved as a Lexi chat, not emailed) → { conversationId }
 *   POST { action: 'think' }              Lexi looks at everything now and brings plans (and a market scan if stale)
 * Only the Executive Lexi user(s) — isExec() — can read or change anything here.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { isSignedIn } from '@/lib/assistant-executor'
import { listWork } from '@/lib/lexi/workstreams'
import { decidePlan, isExec, listPlans, runExecBrief, runMarketScan, runStrategist, setOutcome, slotForHour, type BriefSlot } from '@/lib/lexi/exec'

export const dynamic = 'force-dynamic'
export const maxDuration = 180

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET() {
  const user = await getCurrentUser()
  if (!isSignedIn(user)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isExec(user)) return NextResponse.json({ exec: false })
  const [r, market, work] = await Promise.all([
    listPlans(user, 'all', 40),
    sb.from('lexi_market_notes').select('headline, why_it_matters, topic, source, url, created_at').order('created_at', { ascending: false }).limit(6),
    listWork(user).catch(() => ({ items: [] })),
  ])
  return NextResponse.json({ exec: true, plans: r.plans, record: r.record, market: market.data ?? [], work: work.items, ...(r.error ? { error: r.error } : {}) })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!isSignedIn(user)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isExec(user)) return NextResponse.json({ error: 'Only for Executive Lexi.' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const action = String(body?.action ?? '')

  if (action === 'brief') {
    const hour = Number(new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }))
    const slot: BriefSlot = ['morning', 'lunch', 'evening'].includes(body?.slot) ? body.slot : slotForHour(hour)
    try {
      const r = await runExecBrief(user, slot, { force: true, email: false })
      return NextResponse.json(r, { status: r.ok ? 200 : 500 })
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Lexi couldn’t write the brief.' }, { status: 500 })
    }
  }

  if (action === 'think') {
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'Lexi isn’t set up yet (missing ANTHROPIC_API_KEY).' }, { status: 503 })
    // Fresh market notes first if the last scan is more than 20 hours old.
    const { data: last } = await sb.from('lexi_market_notes').select('created_at').order('created_at', { ascending: false }).limit(1)
    const stale = !last?.length || Date.now() - Date.parse(last[0].created_at) > 20 * 3600e3
    const scan = stale ? await runMarketScan().catch(e => ({ found: 0, saved: 0, error: String(e) })) : null
    try {
      const r = await runStrategist(user, { source: 'daily', maxPlans: 3 })
      return NextResponse.json({ ok: true, saved: r.saved, notes: r.notes, market: scan })
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Lexi couldn’t finish thinking that through.' }, { status: 500 })
    }
  }

  const id = typeof body?.id === 'string' && UUID.test(body.id) ? body.id : null
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  const note = typeof body?.note === 'string' ? body.note : undefined
  if (action === 'approve' || action === 'change' || action === 'reject') {
    const r = await decidePlan(user, id, action, note)
    return NextResponse.json(r, { status: r.ok ? 200 : 400 })
  }
  if (action === 'outcome') {
    const o = body?.outcome
    if (o !== 'worked' && o !== 'partly' && o !== 'did_not') return NextResponse.json({ error: 'outcome must be worked, partly or did_not' }, { status: 400 })
    const r = await setOutcome(user, id, o, note)
    return NextResponse.json(r, { status: r.ok ? 200 : 400 })
  }
  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
}
