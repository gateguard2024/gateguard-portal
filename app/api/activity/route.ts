/**
 * GET /api/activity?entity=opportunity|site|lead&id=...&limit=40
 * Unified activity timeline (#59): merges notes / calls / emails / meetings /
 * tasks (crm_activities), site events, work orders, and quotes for one record
 * into a single chronological feed. Each source is independently guarded so a
 * missing table/column never breaks the feed.
 *
 * Returns: { items: [{ id, kind, title, detail, actor, at, status }] }
 * Auth: Clerk session + per-entity scope check.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth }            from '@clerk/nextjs/server'
import { createClient }    from '@supabase/supabase-js'
import { getCurrentUser }  from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'
import { opportunityInScope, leadInScope } from '@/lib/crm-scope'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export const dynamic = 'force-dynamic'

interface Item { id: string; kind: string; title: string; detail: string | null; actor: string | null; at: string | null; status?: string | null }

async function siteInScope(id: string): Promise<boolean> {
  const user = await getCurrentUser()
  const scope = await resolveOrgScope(user)
  if (scope.all) return true
  const { data } = await supabase.from('sites').select('master_dealer_id, install_dealer_id, service_dealer_id, org_id').eq('id', id).maybeSingle()
  if (!data) return false
  return [data.master_dealer_id, data.install_dealer_id, data.service_dealer_id, data.org_id].some(o => o && scope.ids.includes(o))
}

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const entity = searchParams.get('entity')
  const id     = searchParams.get('id')
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '40', 10), 100)
  if (!entity || !id) return NextResponse.json({ error: 'entity and id are required' }, { status: 400 })

  // Scope gate per entity type.
  const ok = entity === 'opportunity' ? await opportunityInScope(id)
    : entity === 'lead' ? await leadInScope(id)
    : entity === 'site' ? await siteInScope(id)
    : false
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const items: Item[] = []
  const fkCol = entity === 'opportunity' ? 'opportunity_id' : entity === 'lead' ? 'lead_id' : 'site_id'

  // ── crm_activities (opportunity + lead) ────────────────────────────────────
  if (entity === 'opportunity' || entity === 'lead') {
    try {
      const { data } = await supabase.from('crm_activities').select('*').eq(fkCol, id).order('created_at', { ascending: false }).limit(limit)
      ;(data ?? []).forEach((a: Record<string, unknown>) => items.push({
        id: `act-${a.id}`,
        kind: String(a.type ?? 'note'),
        title: String(a.subject ?? (a.type ?? 'Note')),
        detail: (a.body as string) ?? (a.outcome as string) ?? null,
        actor: (a.created_by_name as string) ?? null,
        at: (a.completed_at as string) ?? (a.created_at as string) ?? null,
        status: a.completed_at ? 'done' : (a.due_at ? 'scheduled' : null),
      }))
    } catch { /* table optional */ }
  }

  // ── site_events (site) ──────────────────────────────────────────────────────
  if (entity === 'site') {
    try {
      const { data } = await supabase.from('site_events').select('*').eq('site_id', id).order('created_at', { ascending: false }).limit(limit)
      ;(data ?? []).forEach((e: Record<string, unknown>) => items.push({
        id: `evt-${e.id}`,
        kind: 'event',
        title: String(e.title ?? e.event_type ?? 'Event'),
        detail: (e.summary as string) ?? (e.description as string) ?? null,
        actor: (e.event_source as string) ?? null,
        at: (e.created_at as string) ?? null,
        status: (e.severity as string) ?? null,
      }))
    } catch { /* table optional */ }
  }

  // ── work_orders (opportunity + site) ────────────────────────────────────────
  if (entity === 'opportunity' || entity === 'site') {
    try {
      const { data } = await supabase.from('work_orders').select('id, wo_number, title, status, created_at').eq(fkCol, id).order('created_at', { ascending: false }).limit(limit)
      ;(data ?? []).forEach((w: Record<string, unknown>) => items.push({
        id: `wo-${w.id}`,
        kind: 'work_order',
        title: `Work order ${w.wo_number ?? ''}`.trim() + (w.title ? ` — ${w.title}` : ''),
        detail: null,
        actor: null,
        at: (w.created_at as string) ?? null,
        status: (w.status as string) ?? null,
      }))
    } catch { /* table optional */ }
  }

  // ── quotes (opportunity + site) ─────────────────────────────────────────────
  if (entity === 'opportunity' || entity === 'site') {
    try {
      const { data } = await supabase.from('quotes').select('id, quote_number, status, total_one_time, total_mrr, created_at').eq(fkCol, id).order('created_at', { ascending: false }).limit(limit)
      ;(data ?? []).forEach((qrow: Record<string, unknown>) => items.push({
        id: `qt-${qrow.id}`,
        kind: 'quote',
        title: `Quote ${qrow.quote_number ?? ''}`.trim(),
        detail: `One-time $${Number(qrow.total_one_time ?? 0).toLocaleString()} · $${Number(qrow.total_mrr ?? 0).toLocaleString()}/mo`,
        actor: null,
        at: (qrow.created_at as string) ?? null,
        status: (qrow.status as string) ?? null,
      }))
    } catch { /* table optional */ }
  }

  // Sort newest-first, cap.
  items.sort((a, b) => new Date(b.at ?? 0).getTime() - new Date(a.at ?? 0).getTime())
  return NextResponse.json({ items: items.slice(0, limit) })
}
