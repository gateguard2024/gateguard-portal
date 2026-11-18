import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { normalizeRole } from '@/lib/permissions'
import { guardSite } from '@/lib/ops-scope'
import { listOpenings, suggestOpenings, createOpening, OPENING_KINDS, NEEDS_233, type Suggestion } from '@/lib/openings'

export const dynamic = 'force-dynamic'
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// View = anyone who can see the property (incl. a tech on a job there).
// Set up = corporate or a dealer admin — no vendor credentials are involved.
async function access(req: NextRequest, siteId: string) {
  const view = await guardSite(req, siteId)
  const user = await getCurrentUser().catch(() => null)
  const signedIn = !!user && user.id !== 'anonymous'
  return { view, setup: view && signedIn && (user!.isCorporate || normalizeRole(user!.role) === 'admin'), user: signedIn ? user! : null }
}

/**
 * GET /api/sites/[id]/openings[?doors=<json [{id,name}]>&all=1]
 * → { openings, assets, suggestions, can_setup, needs_migration }
 * `doors` = the Brivo doors the page already loaded (for suggestions).
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const a = await access(req, params.id)
  if (!a.view) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const url = new URL(req.url)
  try {
    const { openings, needsMigration } = await listOpenings(params.id, url.searchParams.get('all') === '1')
    if (needsMigration) return NextResponse.json({ openings: [], assets: [], suggestions: [], can_setup: a.setup, needs_migration: true })
    // ?lite=1 → just the list (job pickers).
    if (url.searchParams.get('lite') === '1') return NextResponse.json({ openings: openings.map(({ id, name, kind, active }) => ({ id, name, kind, active })), can_setup: a.setup, needs_migration: false })
    let doors: { id: string; name: string }[] = []
    try { const d = JSON.parse(url.searchParams.get('doors') ?? '[]'); if (Array.isArray(d)) doors = d.filter((x) => x && x.id && x.name).map((x) => ({ id: String(x.id), name: String(x.name) })).slice(0, 200) } catch { /* ignore */ }
    const [suggestions, assets] = await Promise.all([
      a.setup ? suggestOpenings(params.id, doors, openings.filter((o) => o.active)) : Promise.resolve([]),
      db().from('site_assets').select('id, product_name, product_category, location_note, status, opening_id').eq('site_id', params.id).neq('status', 'removed').order('product_category'),
    ])
    if (assets.error) return NextResponse.json({ error: assets.error.message }, { status: 500 })
    return NextResponse.json({ openings, assets: assets.data ?? [], suggestions, can_setup: a.setup, needs_migration: false })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}

/**
 * POST { action, ... }
 *  create   { name, kind?, brivo_door_ids?, camera_ids?, relay_ids?, gate_watch_ids?, asset_ids?, notes? }
 *  accept   { items: Suggestion[] }            — add several suggestions at once
 *  update   { opening_id, name?, kind?, *_ids?, asset_ids?, notes? }   (asset_ids replaces the device list)
 *  remove   { opening_id }   — jobs point at it → hidden (history kept); none → deleted
 *  reorder  { ids: string[] }
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const a = await access(req, params.id)
  if (!a.view) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!a.setup) return NextResponse.json({ error: 'Only Gate Guard corporate or a dealer admin can set up openings.' }, { status: 403 })
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const { data: site } = await db().from('sites').select('org_id, service_dealer_id').eq('id', params.id).maybeSingle()
  const orgId = (site as { org_id?: string | null; service_dealer_id?: string | null } | null)?.service_dealer_id ?? (site as { org_id?: string | null } | null)?.org_id ?? null
  const who = a.user?.name ?? a.user?.email ?? null
  const ids = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(Boolean).slice(0, 50) : undefined)

  if (body.action === 'create' || body.action === 'accept') {
    const items = body.action === 'accept' ? (Array.isArray(body.items) ? body.items as Suggestion[] : []) : [body as unknown as Suggestion]
    if (!items.length) return NextResponse.json({ error: 'Nothing to add.' }, { status: 400 })
    const made = []
    for (const it of items.slice(0, 40)) {
      const r = await createOpening(params.id, orgId, who, { name: String(it.name ?? ''), kind: it.kind, brivo_door_ids: ids(it.brivo_door_ids), camera_ids: ids(it.camera_ids), relay_ids: ids(it.relay_ids), gate_watch_ids: ids(it.gate_watch_ids), asset_ids: ids(it.asset_ids), notes: (it as { notes?: string }).notes ?? null })
      if (r.error) return NextResponse.json({ error: r.error, made }, { status: r.error === NEEDS_233 ? 409 : 400 })
      made.push(r.opening)
    }
    return NextResponse.json({ ok: true, made })
  }

  const openingId = String(body.opening_id ?? '')
  if (body.action === 'update' || body.action === 'remove') {
    const { data: cur, error } = await db().from('site_openings').select('id').eq('id', openingId).eq('site_id', params.id).maybeSingle()
    if (error) return NextResponse.json({ error: /site_openings/.test(error.message) ? NEEDS_233 : error.message }, { status: 500 })
    if (!cur) return NextResponse.json({ error: 'Opening not found.' }, { status: 404 })
  }

  if (body.action === 'update') {
    const upd: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof body.name === 'string') { if (!body.name.trim()) return NextResponse.json({ error: 'Give the opening a name.' }, { status: 400 }); upd.name = body.name.trim() }
    if (typeof body.kind === 'string' && (OPENING_KINDS as readonly string[]).includes(body.kind)) upd.kind = body.kind
    for (const f of ['brivo_door_ids', 'camera_ids', 'relay_ids', 'gate_watch_ids'] as const) if (ids(body[f])) upd[f] = ids(body[f])
    if (body.notes !== undefined) upd.notes = body.notes ? String(body.notes) : null
    const { error } = await db().from('site_openings').update(upd).eq('id', openingId).eq('site_id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const assetIds = ids(body.asset_ids)
    if (assetIds) {
      const { error: e1 } = await db().from('site_assets').update({ opening_id: null }).eq('opening_id', openingId).eq('site_id', params.id)
      if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
      if (assetIds.length) {
        const { error: e2 } = await db().from('site_assets').update({ opening_id: openingId }).in('id', assetIds).eq('site_id', params.id)
        if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
      }
    }
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'remove') {
    const { count, error: cErr } = await db().from('work_orders').select('id', { count: 'exact', head: true }).eq('opening_id', openingId)
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })
    const { error: aErr } = await db().from('site_assets').update({ opening_id: null }).eq('opening_id', openingId).eq('site_id', params.id)
    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 })
    const { error } = count
      ? await db().from('site_openings').update({ active: false, updated_at: new Date().toISOString() }).eq('id', openingId)
      : await db().from('site_openings').delete().eq('id', openingId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, kept_for_history: !!count })
  }

  if (body.action === 'reorder') {
    const list = ids(body.ids) ?? []
    for (let i = 0; i < list.length; i++) {
      const { error } = await db().from('site_openings').update({ sort: i }).eq('id', list[i]).eq('site_id', params.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
