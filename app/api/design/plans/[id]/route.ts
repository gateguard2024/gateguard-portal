/**
 * GET    /api/design/plans/[id]  → { plan, devices }
 * PUT    /api/design/plans/[id]  → replace this plan's devices + update plan meta
 * DELETE /api/design/plans/[id]  → delete plan (+ cascade devices)
 *
 * Uses ONLY floor_plans + floor_plan_devices. Every canvas object (device, wire,
 * zone) is a floor_plan_devices row. Extra per-element data (manufacturer, model,
 * price, qty, status, fov, zone name, wire endpoints/color) is packed as JSON in
 * the notes column. Positions are stored as PERCENTAGES (x_pct / y_pct).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, isInScope } from '@/lib/org-scope'

export const dynamic = 'force-dynamic'

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface IncomingDevice {
  product_id?: string | null
  device_type?: string | null
  label?: string | null
  icon_key?: string | null
  x_pct?: number
  y_pct?: number
  condition?: string | null
  action?: string | null
  notes?: string | null
  photo_urls?: string[] | null
}

async function loadScopedPlan(id: string) {
  const user = await getCurrentUser()
  if (!user.id) return { error: 'Unauthorized', status: 401 as const }

  const db = serviceDb()
  const { data: plan, error } = await db
    .from('floor_plans')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !plan) return { error: 'Not found', status: 404 as const }

  const scope = await resolveOrgScope(user)
  if (!isInScope(scope, plan.org_id)) return { error: 'Not found', status: 404 as const }

  return { db, plan, user }
}

// GET /api/design/plans/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const res = await loadScopedPlan(params.id)
  if ('error' in res) return NextResponse.json({ error: res.error }, { status: res.status })

  const { db, plan } = res
  const { data: devices, error } = await db
    .from('floor_plan_devices')
    .select('*')
    .eq('floor_plan_id', plan.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ plan, devices: devices ?? [] })
}

// PUT /api/design/plans/[id]  { name?, level?, status?, file_url?, file_type?, devices: [...] }
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const res = await loadScopedPlan(params.id)
  if ('error' in res) return NextResponse.json({ error: res.error }, { status: res.status })

  const { db, plan } = res
  const body = await req.json().catch(() => ({}))
  const devices: IncomingDevice[] = Array.isArray(body.devices) ? body.devices : []

  // 1) Replace all devices for this plan (delete-then-insert).
  const { error: delErr } = await db
    .from('floor_plan_devices')
    .delete()
    .eq('floor_plan_id', plan.id)
  if (delErr) return NextResponse.json({ error: `Clear failed: ${delErr.message}` }, { status: 500 })

  if (devices.length > 0) {
    const rows = devices.map((d) => ({
      floor_plan_id: plan.id,
      product_id: d.product_id ?? null,
      device_type: d.device_type ?? 'device',
      label: d.label ?? 'Element',
      icon_key: d.icon_key ?? null,
      x_pct: typeof d.x_pct === 'number' ? d.x_pct : 0,
      y_pct: typeof d.y_pct === 'number' ? d.y_pct : 0,
      condition: d.condition ?? 'good',
      action: d.action ?? 'new_install',
      notes: d.notes ?? null,
      photo_urls: Array.isArray(d.photo_urls) ? d.photo_urls : null,
    }))
    const { error: insErr } = await db.from('floor_plan_devices').insert(rows)
    if (insErr) return NextResponse.json({ error: `Insert failed: ${insErr.message}` }, { status: 500 })
  }

  // 2) Update plan meta.
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.name === 'string') patch.name = body.name
  if (typeof body.level === 'string') patch.level = body.level
  if (typeof body.status === 'string') patch.status = body.status
  if (typeof body.file_url === 'string' || body.file_url === null) patch.file_url = body.file_url
  if (typeof body.file_type === 'string') patch.file_type = body.file_type

  const { data: updated, error: upErr } = await db
    .from('floor_plans')
    .update(patch)
    .eq('id', plan.id)
    .select()
    .single()
  if (upErr) return NextResponse.json({ error: `Update failed: ${upErr.message}` }, { status: 500 })

  return NextResponse.json({ plan: updated, device_count: devices.length })
}

// DELETE /api/design/plans/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const res = await loadScopedPlan(params.id)
  if ('error' in res) return NextResponse.json({ error: res.error }, { status: res.status })

  const { db, plan } = res
  const { error } = await db.from('floor_plans').delete().eq('id', plan.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
