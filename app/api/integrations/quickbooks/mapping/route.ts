/**
 * /api/integrations/quickbooks/mapping — corporate only.
 * Match Nexus properties to QuickBooks customers, and catalog products to items.
 *   GET  ?kind=sites|products → { rows: [{ id, name, sub, qbo_id, qbo_name, suggestion }], options: [{ id, name }] }
 *   POST { kind, links: [{ id, qbo_id|null }] }   → save links
 *   POST { kind, action: 'auto' }                  → accept every exact match
 *   POST { kind, action: 'create', ids: [...] }    → create in QuickBooks and link
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { getQboAuth, qboQuery } from '@/lib/qbo'
import { ensureCustomer, ensureItemForProduct, getSettings, qdb } from '@/lib/qbo-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>
type Kind = 'sites' | 'products'

const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').replace(/\b(the|llc|inc|apartments?|apts?)\b/g, '').replace(/\s+/g, ' ').trim()

async function load(kind: Kind) {
  const auth = await getQboAuth()
  if (!auth.ok) return { error: auth.reason, status: 400 }
  const db = qdb()
  if (kind === 'sites') {
    const [q, { data: sites, error }] = await Promise.all([
      qboQuery<Row>(auth, 'select Id, DisplayName from Customer where Active = true maxresults 1000'),
      db.from('sites').select('id, name, city, state, qbo_customer_id, qbo_customer_name').order('name').limit(2000),
    ])
    if (!q.ok) return { error: q.error, status: 502 }
    if (error) return { error: error.message, status: 500 }
    const options = q.rows.map(c => ({ id: String(c.Id), name: String(c.DisplayName) }))
    const byName = new Map(options.map(o => [norm(o.name), o]))
    const byId = new Map(options.map(o => [o.id, o]))
    const rows = ((sites ?? []) as Row[]).map(s => ({
      id: s.id, name: s.name, sub: [s.city, s.state].filter(Boolean).join(', '),
      qbo_id: s.qbo_customer_id ?? null, qbo_name: s.qbo_customer_id ? (byId.get(String(s.qbo_customer_id))?.name ?? s.qbo_customer_name ?? 'Linked') : null,
      suggestion: !s.qbo_customer_id ? (byName.get(norm(s.name)) ?? null) : null,
    }))
    return { rows, options, auth }
  }
  const [q, { data: products, error }] = await Promise.all([
    qboQuery<Row>(auth, 'select Id, Name, Sku, Type from Item where Active = true maxresults 1000'),
    db.from('products').select('id, name, sku, brand, sell_price, qbo_item_id').is('org_id', null).eq('active', true).order('name').limit(3000),
  ])
  if (!q.ok) return { error: q.error, status: 502 }
  if (error) return { error: error.message, status: 500 }
  const options = q.rows.filter(i => i.Type !== 'Category').map(i => ({ id: String(i.Id), name: String(i.Name), sku: i.Sku ? String(i.Sku) : null }))
  const bySku = new Map(options.filter(o => o.sku).map(o => [String(o.sku).toLowerCase(), o]))
  const byName = new Map(options.map(o => [norm(o.name), o]))
  const byId = new Map(options.map(o => [o.id, o]))
  const rows = ((products ?? []) as Row[]).map(p => ({
    id: p.id, name: p.name, sub: [p.brand, p.sku].filter(Boolean).join(' · '),
    qbo_id: p.qbo_item_id ?? null, qbo_name: p.qbo_item_id ? (byId.get(String(p.qbo_item_id))?.name ?? 'Linked') : null,
    suggestion: !p.qbo_item_id ? ((p.sku && bySku.get(String(p.sku).toLowerCase())) || byName.get(norm(p.name)) || null) : null,
  }))
  return { rows, options, auth }
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user.isCorporate) return NextResponse.json({ error: 'QuickBooks is Gate Guard corporate only.' }, { status: 403 })
  const kind = (req.nextUrl.searchParams.get('kind') === 'products' ? 'products' : 'sites') as Kind
  const r = await load(kind)
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ rows: r.rows, options: r.options.map(o => ({ id: o.id, name: o.name })) })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user.isCorporate) return NextResponse.json({ error: 'QuickBooks is Gate Guard corporate only.' }, { status: 403 })
  const body = await req.json().catch(() => ({} as Row))
  const kind = (body.kind === 'products' ? 'products' : 'sites') as Kind
  const db = qdb()
  const save = async (id: string, qboId: string | null, qboName?: string | null) => {
    const { error } = kind === 'sites'
      ? await db.from('sites').update({ qbo_customer_id: qboId, qbo_customer_name: qboId ? (qboName ?? null) : null }).eq('id', id)
      : await db.from('products').update({ qbo_item_id: qboId, qbo_synced_at: qboId ? new Date().toISOString() : null }).eq('id', id)
    return error?.message ?? null
  }

  if (Array.isArray(body.links)) {
    let saved = 0; const errors: string[] = []
    const names = new Map<string, string>()
    if (kind === 'sites' && body.links.some((l: Row) => l.qbo_id)) {
      const r = await load('sites'); if (!('error' in r)) for (const o of r.options) names.set(o.id, o.name)
    }
    for (const l of (body.links as Row[]).slice(0, 500)) {
      if (!l?.id) continue
      const e = await save(String(l.id), l.qbo_id ? String(l.qbo_id) : null, l.qbo_id ? names.get(String(l.qbo_id)) : null)
      if (e) errors.push(e.includes('products_qbo_item_uniq') ? 'That QuickBooks item is already linked to another product.' : e); else saved++
    }
    return NextResponse.json({ saved, errors }, { status: errors.length && !saved ? 400 : 200 })
  }

  if (body.action === 'auto') {
    const r = await load(kind)
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status })
    let saved = 0
    const used = new Set(r.rows.filter(x => x.qbo_id).map(x => String(x.qbo_id)))
    for (const row of r.rows) {
      if (row.qbo_id || !row.suggestion) continue
      if (kind === 'products' && used.has(row.suggestion.id)) continue
      if (!(await save(row.id, row.suggestion.id, row.suggestion.name))) { saved++; used.add(row.suggestion.id) }
    }
    return NextResponse.json({ saved })
  }

  if (body.action === 'create' && Array.isArray(body.ids)) {
    const auth = await getQboAuth()
    if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 400 })
    const settings = { ...(await getSettings()), auto_create_customers: true }
    const started = Date.now()
    let created = 0; const errors: string[] = []; let more = false
    for (const id of (body.ids as string[]).slice(0, 100)) {
      if (Date.now() - started > 50000) { more = true; break }
      const r = kind === 'sites' ? await ensureCustomer(auth, { siteId: String(id) }, settings) : await ensureItemForProduct(auth, String(id), settings)
      if ('id' in r) created++; else errors.push(r.error)
    }
    return NextResponse.json({ created, errors: [...new Set(errors)].slice(0, 5), more }, { status: errors.length && !created ? 400 : 200 })
  }
  return NextResponse.json({ error: 'Send links, action: "auto", or action: "create" with ids.' }, { status: 400 })
}
