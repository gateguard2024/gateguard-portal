/**
 * /api/admin/portals/[id]/managers — the people who can CONTROL a property portal
 * (open gates, lockdown, packages…) with their own personal PIN (portal_managers,
 * migration 191). The portal's shared access code only lets people look.
 * Corporate only. PINs are stored as a hash (lib/portal-manager.ts) and never returned.
 *   GET                                   → { managers: [{ id, name, email, active, created_at }] }
 *   POST   { name, email?, pin }          → add a person
 *   PATCH  { manager_id, active?, pin?, name?, email? } → turn on/off, reset PIN, rename
 *   DELETE { manager_id }                 → remove for good
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { hashManagerPin } from '@/lib/portal-manager'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })
const PIN_RE = /^\d{4,8}$/

/** A personal PIN must be unique among this portal's managers (sign-in matches by PIN alone). */
async function pinTaken(portalId: string, pin: string, exceptId?: string): Promise<boolean | null> {
  const { data, error } = await db().from('portal_managers').select('id, pin_hash').eq('client_portal_id', portalId)
  if (error) return null
  const h = hashManagerPin(pin)
  return (data ?? []).some(r => r.pin_hash === h && r.id !== exceptId)
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user.isCorporate) return bad('Forbidden', 403)
  const { data, error } = await db().from('portal_managers')
    .select('id, name, email, active, created_at, created_by')
    .eq('client_portal_id', params.id).order('created_at', { ascending: true })
  if (error) return bad(error.message, 500)
  return NextResponse.json({ managers: data ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user.isCorporate) return bad('Forbidden', 403)
  const b = await req.json().catch(() => ({}))
  const name = String(b.name ?? '').trim()
  const email = b.email ? String(b.email).trim() : null
  const pin = String(b.pin ?? '').trim()
  if (!name) return bad('Enter the person’s name.')
  if (!PIN_RE.test(pin)) return bad('The personal PIN must be 4 to 8 digits.')

  const { data: portal, error: pErr } = await db().from('client_portals').select('id, org_id, site_id').eq('id', params.id).maybeSingle()
  if (pErr) return bad(pErr.message, 500)
  if (!portal) return bad('Portal not found.', 404)
  const taken = await pinTaken(portal.id, pin)
  if (taken === null) return bad('Could not check that PIN — try again.', 500)
  if (taken) return bad('Someone on this portal already uses that PIN. Pick another.', 409)

  const { data, error } = await db().from('portal_managers').insert({
    client_portal_id: portal.id, org_id: portal.org_id, site_id: portal.site_id,
    name, email, pin_hash: hashManagerPin(pin), active: true, created_by: user.email ?? user.id,
  }).select('id, name, email, active, created_at').single()
  if (error) return bad(error.message, 500)
  return NextResponse.json({ manager: data })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user.isCorporate) return bad('Forbidden', 403)
  const b = await req.json().catch(() => ({}))
  const id = String(b.manager_id ?? '')
  if (!id) return bad('manager_id required')
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof b.active === 'boolean') update.active = b.active
  if (typeof b.name === 'string' && b.name.trim()) update.name = b.name.trim()
  if ('email' in b) update.email = b.email ? String(b.email).trim() : null
  if (b.pin != null && String(b.pin).trim()) {
    const pin = String(b.pin).trim()
    if (!PIN_RE.test(pin)) return bad('The personal PIN must be 4 to 8 digits.')
    const taken = await pinTaken(params.id, pin, id)
    if (taken === null) return bad('Could not check that PIN — try again.', 500)
    if (taken) return bad('Someone on this portal already uses that PIN. Pick another.', 409)
    update.pin_hash = hashManagerPin(pin)
  }
  const { data, error } = await db().from('portal_managers').update(update)
    .eq('id', id).eq('client_portal_id', params.id).select('id, name, email, active, created_at').maybeSingle()
  if (error) return bad(error.message, 500)
  if (!data) return bad('Manager not found.', 404)
  return NextResponse.json({ manager: data })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user.isCorporate) return bad('Forbidden', 403)
  const b = await req.json().catch(() => ({}))
  const id = String(b.manager_id ?? '')
  if (!id) return bad('manager_id required')
  const { error } = await db().from('portal_managers').delete().eq('id', id).eq('client_portal_id', params.id)
  if (error) return bad(error.message, 500)
  return NextResponse.json({ ok: true })
}
