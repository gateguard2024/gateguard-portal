/**
 * /api/portal/[slug]/managers — the property's own managers manage each other.
 * Gate Guard adds the FIRST manager (Nexus → property portal setup); after that any
 * signed-in manager (personal PIN) can add people, turn them off, give a new PIN, or
 * remove them. Nobody can turn off or remove themselves (so the property can't lock
 * itself out). PINs are hashed (lib/portal-manager.ts), unique per portal, never returned.
 *   GET                                         → { me, managers: [{ id, name, email, active, created_at, created_by }] }
 *   POST  { name, email?, pin }                 → add
 *   PATCH { manager_id, active?, pin?, name?, email? } → change (your own PIN: manager_id = me)
 *   DELETE { manager_id }                       → remove
 * Every change is logged in site_events with who did it.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyPortal } from '@/lib/portal-auth'
import { getPortalManager, hashManagerPin, portalRowForSlug, type PortalManager } from '@/lib/portal-manager'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })
const PIN_RE = /^\d{4,8}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Ctx = { portalId: string; orgId: string | null; siteId: string | null; me: PortalManager }

async function gate(req: NextRequest, slug: string): Promise<Ctx | NextResponse> {
  const v = await verifyPortal(req, slug)
  if (!v.ok) return bad(v.error, v.status)
  const me = await getPortalManager(req, slug)
  if (!me) return bad('Sign in with your personal PIN to manage managers.', 401)
  const row = await portalRowForSlug(slug) as { id: string } | null
  if (!row) return bad('Portal not found.', 404)
  return { portalId: row.id, orgId: v.portal.org_id ?? null, siteId: v.portal.site_id ?? null, me }
}

async function pinTaken(portalId: string, pin: string, exceptId?: string): Promise<boolean | null> {
  const { data, error } = await db().from('portal_managers').select('id, pin_hash').eq('client_portal_id', portalId)
  if (error) return null
  const h = hashManagerPin(pin)
  return (data ?? []).some(r => r.pin_hash === h && r.id !== exceptId)
}

async function log(c: Ctx, title: string) {
  if (!c.siteId) return
  const { error } = await db().from('site_events').insert({ site_id: c.siteId, event_type: 'portal_manager', title, description: `${title} — by ${c.me.name} (property portal)`, metadata: { by: c.me.name, by_id: c.me.id } })
  if (error) console.error('[portal managers] site_events', error.message)
}

async function mine(c: Ctx, id: string) {
  const { data, error } = await db().from('portal_managers').select('id, name').eq('id', id).eq('client_portal_id', c.portalId).maybeSingle()
  return { row: data as { id: string; name: string } | null, error }
}

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const c = await gate(req, params.slug); if (c instanceof NextResponse) return c
  const { data, error } = await db().from('portal_managers').select('id, name, email, active, created_at, created_by').eq('client_portal_id', c.portalId).order('created_at', { ascending: true })
  if (error) return bad(error.message, 500)
  return NextResponse.json({ me: c.me, managers: data ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const c = await gate(req, params.slug); if (c instanceof NextResponse) return c
  const b = await req.json().catch(() => ({}))
  const name = String(b.name ?? '').trim().slice(0, 80)
  const email = b.email ? String(b.email).trim().slice(0, 120) : null
  const pin = String(b.pin ?? '').trim()
  if (!name) return bad('Enter the person’s name.')
  if (email && !EMAIL_RE.test(email)) return bad('That email doesn’t look right.')
  if (!PIN_RE.test(pin)) return bad('The personal PIN must be 4 to 8 digits.')
  const taken = await pinTaken(c.portalId, pin)
  if (taken === null) return bad('Could not check that PIN — try again.', 500)
  if (taken) return bad('Someone here already uses that PIN. Pick another.', 409)
  const { data, error } = await db().from('portal_managers').insert({
    client_portal_id: c.portalId, org_id: c.orgId, site_id: c.siteId,
    name, email, pin_hash: hashManagerPin(pin), active: true, created_by: `${c.me.name} (portal)`,
  }).select('id, name, email, active, created_at, created_by').single()
  if (error) return bad(error.message, 500)
  await log(c, `Manager added: ${name}`)
  return NextResponse.json({ manager: data })
}

export async function PATCH(req: NextRequest, { params }: { params: { slug: string } }) {
  const c = await gate(req, params.slug); if (c instanceof NextResponse) return c
  const b = await req.json().catch(() => ({}))
  const id = String(b.manager_id ?? '')
  if (!id) return bad('manager_id required')
  const { row, error: rErr } = await mine(c, id)
  if (rErr) return bad(rErr.message, 500)
  if (!row) return bad('Not found.', 404)
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  const notes: string[] = []
  if (typeof b.active === 'boolean') {
    if (id === c.me.id && !b.active) return bad('You can’t turn yourself off — ask another manager.')
    update.active = b.active; notes.push(b.active ? 'turned on' : 'turned off')
  }
  if (typeof b.name === 'string' && b.name.trim()) { update.name = b.name.trim().slice(0, 80); notes.push('renamed') }
  if ('email' in b) {
    const email = b.email ? String(b.email).trim().slice(0, 120) : null
    if (email && !EMAIL_RE.test(email)) return bad('That email doesn’t look right.')
    update.email = email; notes.push('email changed')
  }
  if (b.pin != null && String(b.pin).trim()) {
    const pin = String(b.pin).trim()
    if (!PIN_RE.test(pin)) return bad('The personal PIN must be 4 to 8 digits.')
    const taken = await pinTaken(c.portalId, pin, id)
    if (taken === null) return bad('Could not check that PIN — try again.', 500)
    if (taken) return bad('Someone here already uses that PIN. Pick another.', 409)
    update.pin_hash = hashManagerPin(pin); notes.push('new PIN')
  }
  if (!notes.length) return bad('Nothing to change.')
  const { data, error } = await db().from('portal_managers').update(update).eq('id', id).eq('client_portal_id', c.portalId).select('id, name, email, active, created_at, created_by').single()
  if (error) return bad(error.message, 500)
  await log(c, `Manager ${row.name}: ${notes.join(', ')}`)
  return NextResponse.json({ manager: data })
}

export async function DELETE(req: NextRequest, { params }: { params: { slug: string } }) {
  const c = await gate(req, params.slug); if (c instanceof NextResponse) return c
  const b = await req.json().catch(() => ({}))
  const id = String(b.manager_id ?? '')
  if (!id) return bad('manager_id required')
  if (id === c.me.id) return bad('You can’t remove yourself — ask another manager.')
  const { row, error: rErr } = await mine(c, id)
  if (rErr) return bad(rErr.message, 500)
  if (!row) return bad('Not found.', 404)
  const { error } = await db().from('portal_managers').delete().eq('id', id).eq('client_portal_id', c.portalId)
  if (error) return bad(error.message, 500)
  await log(c, `Manager removed: ${row.name}`)
  return NextResponse.json({ ok: true })
}
