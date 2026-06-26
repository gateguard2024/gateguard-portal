/**
 * Deleted Items (recycle bin) — safe two-stage delete.
 * GET  /api/trash                          → soft-deleted leads + opportunities + dealers (scoped)
 * POST /api/trash { table, ids, action }   → action: 'delete' | 'restore' | 'purge'
 *   delete  = move to Deleted Items (set deleted_at)  — anyone in scope
 *   restore = bring it back (clear deleted_at)
 *   purge   = permanent hard delete (corporate only)  — removes linked notes/files first
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAP: Record<string, { table: string; orgCol: string; corporateOnly?: boolean }> = {
  leads:         { table: 'leads',         orgCol: 'org_id' },
  opportunities: { table: 'opportunities', orgCol: 'dealer_org_id' },
  dealers:       { table: 'organizations', orgCol: 'id', corporateOnly: true },
}

export async function GET(req: NextRequest) {
  try {
    const caller = await getCurrentUser()
    const scope = await resolveOrgScope(caller)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const grab = async (cfg: { table: string; orgCol: string; corporateOnly?: boolean }, cols: string) => {
      if (cfg.corporateOnly && !caller.isCorporate) return []
      let q = supabase.from(cfg.table).select(cols).not('deleted_at', 'is', null).order('deleted_at', { ascending: false }).limit(200)
      if (!(cfg.table === 'organizations')) q = applyOrgScope(q as any, scope, cfg.orgCol) as typeof q // eslint-disable-line @typescript-eslint/no-explicit-any
      const { data } = await q
      return data ?? []
    }
    const [leads, opportunities, dealers] = await Promise.all([
      grab(MAP.leads, 'id, company_name, contact_name, location, deleted_at, deleted_by'),
      grab(MAP.opportunities, 'id, name, account_name, stage, deleted_at, deleted_by'),
      grab(MAP.dealers, 'id, name, org_tier, deleted_at, deleted_by'),
    ])
    return NextResponse.json({ leads, opportunities, dealers })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not load', leads: [], opportunities: [], dealers: [] }, { status: 200 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getCurrentUser()
    const scope = await resolveOrgScope(caller)
    const body = await req.json().catch(() => ({}))
    const cfg = MAP[String(body.table)]
    const ids = Array.isArray(body.ids) ? body.ids.map(String) : []
    const action = String(body.action)
    if (!cfg) return NextResponse.json({ error: 'Unknown type.' }, { status: 400 })
    if (!ids.length) return NextResponse.json({ error: 'Nothing selected.' }, { status: 400 })
    if (cfg.corporateOnly && !caller.isCorporate) return NextResponse.json({ error: 'Only corporate can manage dealers here.' }, { status: 403 })

    const scoped = <T>(q: T): T => (cfg.table === 'organizations' ? q : (applyOrgScope(q as any, scope, cfg.orgCol) as T)) // eslint-disable-line @typescript-eslint/no-explicit-any

    if (action === 'delete') {
      const { error } = await scoped(supabase.from(cfg.table).update({ deleted_at: new Date().toISOString(), deleted_by: caller.id }).in('id', ids))
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, moved: ids.length })
    }

    if (action === 'restore') {
      const { error } = await scoped(supabase.from(cfg.table).update({ deleted_at: null, deleted_by: null }).in('id', ids))
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, restored: ids.length })
    }

    if (action === 'purge') {
      if (!caller.isCorporate) return NextResponse.json({ error: 'Only corporate can permanently delete.' }, { status: 403 })
      // Remove linked notes/files first so FK constraints don't block the purge.
      if (cfg.table === 'leads' || cfg.table === 'opportunities') {
        const col = cfg.table === 'leads' ? 'lead_id' : 'opportunity_id'
        for (const t of ['crm_activities', 'attachments']) {
          try { await supabase.from(t).delete().in(col, ids) } catch { /* best effort */ }
        }
      }
      const { error } = await supabase.from(cfg.table).delete().in('id', ids).not('deleted_at', 'is', null)
      if (error) return NextResponse.json({ error: `Could not permanently delete: ${error.message}` }, { status: 500 })
      return NextResponse.json({ ok: true, purged: ids.length })
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}
