/**
 * GET   /api/admin/pricing — service_catalog pricing lines + program settings
 * PATCH /api/admin/pricing — bulk update floor/target/status/quotable/base/notes + settings
 *
 * ONE catalog: pricing lives on service_catalog (extended by migration 157).
 * GateGuard program lines are is_gateguard_program = true; third-party
 * marketplace services share the same table and the same console.
 * The hardware `products` table (troubleshooter/manuals ecosystem) is untouched.
 *
 * GateGuard corporate only (edits require corporate admin). Every change is
 * written to catalog_pricing_log with the editor's name.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function GET() {
  const caller = await getCurrentUser()
  if (!caller.isCorporate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [{ data: items, error: iErr }, { data: settings, error: sErr }] = await Promise.all([
    supabase
      .from('service_catalog')
      .select('id, item_code, name, provider, category, billing_type, unit_label, base_price, floor_price, target_price, gg_cost, floor_inputs, bucket, status, quotable, dealer_visible, is_gateguard_program, notes, sort_order, is_active')
      .eq('is_active', true)
      .order('is_gateguard_program', { ascending: false })
      .order('sort_order', { ascending: true }),
    supabase.from('catalog_pricing_settings').select('*').order('key'),
  ])
  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 })
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 })
  return NextResponse.json({ items: items ?? [], settings: settings ?? [] })
}

const EDITABLE = ['floor_price', 'target_price', 'gg_cost', 'floor_inputs', 'base_price', 'status', 'quotable', 'dealer_visible', 'notes'] as const

// The floor build-up: gg_cost = hardware+labor+platform;
// floor_price = gg_cost + gg_net + dist + sales + dealer. Server is authoritative
// whenever floor_inputs is present so the stored floor can never drift from its parts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deriveFromFloorInputs(fi: any): { gg_cost: number; floor_price: number } {
  const n = (v: any) => (v == null || v === '' || isNaN(Number(v)) ? 0 : Number(v))
  const gg_cost = n(fi.hardware_cost) + n(fi.labor_cost) + n(fi.platform_cost)
  const floor_price = gg_cost + n(fi.gg_net) + n(fi.dist) + n(fi.sales) + n(fi.dealer)
  return { gg_cost, floor_price }
}

// POST /api/admin/pricing — corporate adds a NEW line item to the catalog.
// Body: { name, bucket, category, billing_type, unit_label, floor_price?, target_price?, status?, notes?, item_code? }
export async function POST(req: NextRequest) {
  const caller = await getCurrentUser()
  if (!caller.isCorporate || caller.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { name, bucket, category, billing_type, unit_label, floor_price, target_price, gg_cost, floor_inputs, status, notes, item_code } = body ?? {}
  const derived = floor_inputs && typeof floor_inputs === 'object' ? deriveFromFloorInputs(floor_inputs) : null
  if (!name?.trim() || !['A', 'B', 'C'].includes(bucket) || !billing_type) {
    return NextResponse.json({ error: 'name, bucket (A|B|C), and billing_type are required' }, { status: 400 })
  }
  if (floor_price != null && target_price != null && Number(floor_price) > Number(target_price)) {
    return NextResponse.json({ error: 'floor cannot exceed target' }, { status: 400 })
  }
  const st = ['approved', 'for_review', 'open'].includes(status) ? status : 'for_review'
  const code = (item_code?.trim() || `CUSTOM.${name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 40)}`)

  const { data, error } = await supabase
    .from('service_catalog')
    .insert({
      item_code: code,
      name: name.trim(),
      provider: 'GateGuard',
      category: category || 'other',
      billing_type,
      unit_label: unit_label || 'unit',
      base_price: target_price ?? 0,
      floor_price: derived ? derived.floor_price : (floor_price ?? null),
      target_price: target_price ?? null,
      gg_cost: derived ? derived.gg_cost : (gg_cost ?? null),
      floor_inputs: floor_inputs ?? null,
      bucket,
      status: st,
      quotable: st !== 'open',
      dealer_visible: true,
      is_gateguard_program: true,
      requires_enrollment: false,
      contract_months: 60,
      notes: notes ?? null,
      sort_order: 500,
    })
    .select()
    .single()
  if (error) {
    const msg = error.message.includes('duplicate') ? `Item code "${code}" already exists — pick a different code.` : error.message
    return NextResponse.json({ error: msg }, { status: 500 })
  }
  const { error: logErr } = await supabase.from('catalog_pricing_log').insert({
    item_code: code,
    changed_by: caller.name,
    changes: { created: true, name: data.name, bucket, floor_price, target_price, status: st },
  })
  if (logErr) console.error('pricing log write failed:', logErr.message)
  return NextResponse.json({ ok: true, item: data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const caller = await getCurrentUser()
  if (!caller.isCorporate || caller.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const updates: Array<Record<string, any>> = Array.isArray(body?.updates) ? body.updates : []
  const settings: Array<{ key: string; value: number }> = Array.isArray(body?.settings) ? body.settings : []
  if (!updates.length && !settings.length) {
    return NextResponse.json({ error: 'updates or settings required' }, { status: 400 })
  }

  let updated = 0
  for (const u of updates) {
    if (!u?.id) continue
    const patch: Record<string, any> = { updated_at: new Date().toISOString() }
    for (const k of EDITABLE) if (k in u) patch[k] = u[k]

    // Floor build-up is authoritative: if floor_inputs is a live object, the
    // server recomputes gg_cost + floor_price from it (client values ignored).
    if (patch.floor_inputs && typeof patch.floor_inputs === 'object') {
      const d = deriveFromFloorInputs(patch.floor_inputs)
      patch.gg_cost = d.gg_cost
      patch.floor_price = d.floor_price
    }

    // Guardrails: an [Open] item can never be quotable; a floor above the
    // target is a data error, not a pricing strategy.
    if (patch.status === 'open') patch.quotable = false
    if (
      patch.floor_price != null && patch.target_price != null &&
      Number(patch.floor_price) > Number(patch.target_price)
    ) {
      return NextResponse.json(
        { error: `floor ($${patch.floor_price}) cannot exceed target ($${patch.target_price})` },
        { status: 400 },
      )
    }

    const { data, error } = await supabase
      .from('service_catalog')
      .update(patch)
      .eq('id', u.id)
      .select('id, item_code, name')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    updated++

    const { error: logErr } = await supabase.from('catalog_pricing_log').insert({
      item_code: data.item_code ?? data.name,
      changed_by: caller.name,
      changes: patch,
    })
    if (logErr) console.error('pricing log write failed:', logErr.message)
  }

  for (const s of settings) {
    if (!s?.key || typeof s.value !== 'number') continue
    const { error } = await supabase
      .from('catalog_pricing_settings')
      .update({ value: s.value, updated_at: new Date().toISOString() })
      .eq('key', s.key)
    if (error) return NextResponse.json({ error: `${s.key}: ${error.message}` }, { status: 500 })
    updated++
    const { error: logErr } = await supabase.from('catalog_pricing_log').insert({
      item_code: `setting:${s.key}`,
      changed_by: caller.name,
      changes: { value: s.value },
    })
    if (logErr) console.error('pricing log write failed:', logErr.message)
  }

  return NextResponse.json({ ok: true, updated })
}
