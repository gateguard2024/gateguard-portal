/**
 * Installed units (Catalog phase 2, migration 237). Keep the rules HERE.
 *
 *  - ONE record per physical unit at a property: site_assets. A unit sits at a
 *    gate/door (opening_id) and may belong to a bigger unit (parent_asset_id — a
 *    photo eye under its operator). Each has a QR code (qr_code) → /a/<code>.
 *  - A catalog part marked "Replaced" (work_order_parts.action = 'installed') on a
 *    job at a property creates the new unit there (serial, warranty end = install
 *    date + the product's warranty months, the job's gate/door) and, when the tech
 *    says which unit it replaced, marks that one replaced (status 'replaced',
 *    replaced_by_asset_id, removed_at, removal_wo_id). Removing the part from the
 *    job undoes both.
 *  - Confirming an item on a job's equipment list (wo_installed_equipment) makes
 *    its unit (or links the one already there: same serial).
 *  - Before migration 237: assetsReady() is false and none of this runs.
 */
import { createClient } from '@supabase/supabase-js'
import { randomInt } from 'crypto'

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export const newUnitCode = () => Array.from({ length: 10 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('')
export const cleanCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)

let ready: boolean | null = null
export async function assetsReady(): Promise<boolean> {
  if (ready) return true
  const { error } = await db().from('site_assets').select('qr_code').limit(1)
  ready = !error
  return ready
}
export const _resetAssetsReady = () => { ready = null }

/** Warranty end (YYYY-MM-DD) from the install date + months; null when unknown. */
export function warrantyEnd(installedAt: string | Date | null | undefined, months: number | null | undefined): string | null {
  if (!installedAt || !months || months <= 0) return null
  const d = new Date(installedAt)
  if (isNaN(d.getTime())) return null
  d.setUTCMonth(d.getUTCMonth() + Math.round(months))
  return d.toISOString().slice(0, 10)
}

/** "Front Gate — LiftMaster CSW24UL" */
export const unitLabel = (a: { product_name?: string | null; location_note?: string | null }, openingName?: string | null) =>
  [openingName || a.location_note || null, a.product_name || 'Unit'].filter(Boolean).join(' — ')

export type UnitInput = {
  site_id: string; org_id: string | null; product_id?: string | null; product_name: string; product_sku?: string | null
  product_category?: string | null; serial_number?: string | null; location_note?: string | null; opening_id?: string | null
  parent_asset_id?: string | null; work_order_id?: string | null; installed_by?: string | null; installed_at?: string | null
  install_notes?: string | null; warranty_expires_at?: string | null; installed_part_id?: string | null; status?: string
}

/** Insert a unit with a fresh QR code (retries a code clash). */
export async function createUnit(u: UnitInput) {
  for (let i = 0; i < 4; i++) {
    const { data, error } = await db().from('site_assets').insert({
      ...u, location_note: u.location_note || 'Main Gate', status: u.status ?? 'active', qr_code: newUnitCode(),
    }).select('*').single()
    if (!error) return data as Record<string, unknown> & { id: string; qr_code: string }
    if (error.code !== '23505') throw new Error(error.message)
  }
  throw new Error('Could not make a unique QR code')
}

async function productInfo(productId: string | null | undefined) {
  if (!productId) return null
  const { data } = await db().from('products').select('id, name, sku, category, warranty_months').eq('id', productId).maybeSingle()
  return data as { id: string; name: string; sku: string | null; category: string | null; warranty_months: number | null } | null
}

/** Units at a property for pickers: the job's gate/door first, active only. */
export async function unitsForJob(wo: { site_id: string | null; opening_id?: string | null }) {
  if (!wo.site_id || !(await assetsReady())) return []
  const { data } = await db().from('site_assets').select('id, product_name, serial_number, location_note, opening_id, status').eq('site_id', wo.site_id).limit(500)
  const rows = ((data ?? []) as { id: string; product_name: string; serial_number: string | null; location_note: string | null; opening_id: string | null; status: string | null }[])
    .filter((a) => !['replaced', 'removed'].includes(String(a.status ?? '')))
  const opIds = Array.from(new Set(rows.map((r) => r.opening_id).filter(Boolean))) as string[]
  const names = new Map<string, string>()
  if (opIds.length) { const { data: ops } = await db().from('site_openings').select('id, name').in('id', opIds); for (const o of (ops ?? []) as { id: string; name: string }[]) names.set(o.id, o.name) }
  return rows
    .map((r) => ({ id: r.id, label: unitLabel(r, r.opening_id ? names.get(r.opening_id) : null), serial: r.serial_number, here: !!wo.opening_id && r.opening_id === wo.opening_id }))
    .sort((a, b) => Number(b.here) - Number(a.here) || a.label.localeCompare(b.label))
}

/** A replaced catalog part → the new unit (+ the old one marked replaced). Returns the new unit id. */
export async function installFromPart(o: {
  wo: { id: string; site_id: string | null; org_id: string | null; opening_id?: string | null }
  part: { id: string; name: string; sku?: string | null; product_id: string }
  serial?: string | null; replacesAssetId?: string | null; by?: string | null
}): Promise<{ assetId: string | null; replaced: string | null; error?: string }> {
  if (!o.wo.site_id || !(await assetsReady())) return { assetId: null, replaced: null }
  type Old = { id: string; site_id: string; opening_id: string | null; parent_asset_id: string | null; location_note: string | null }
  let old: Old | null = null
  if (o.replacesAssetId) {
    const { data } = await db().from('site_assets').select('id, site_id, opening_id, parent_asset_id, location_note').eq('id', o.replacesAssetId).maybeSingle()
    old = (data as Old | null) ?? null
    if (!old || old.site_id !== o.wo.site_id) return { assetId: null, replaced: null, error: 'That unit isn’t at this job’s property.' }
  }
  const p = await productInfo(o.part.product_id)
  const now = new Date().toISOString()
  const unit = await createUnit({
    site_id: o.wo.site_id, org_id: o.wo.org_id, product_id: o.part.product_id, product_name: p?.name ?? o.part.name,
    product_sku: p?.sku ?? o.part.sku ?? null, product_category: p?.category ?? null, serial_number: o.serial?.trim() || null,
    opening_id: o.wo.opening_id ?? old?.opening_id ?? null, location_note: old?.location_note ?? null, parent_asset_id: old?.parent_asset_id ?? null,
    work_order_id: o.wo.id, installed_by: o.by ?? null, installed_at: now, warranty_expires_at: warrantyEnd(now, p?.warranty_months),
    installed_part_id: o.part.id, install_notes: old ? 'Replaced an older unit' : null,
  })
  if (old) {
    const { error } = await db().from('site_assets').update({ status: 'replaced', replaced_by_asset_id: unit.id, removed_at: now, removal_wo_id: o.wo.id, updated_at: now }).eq('id', old.id)
    if (error) throw new Error(error.message)
    // Units that hung under the old one now hang under the new one.
    const { error: cErr } = await db().from('site_assets').update({ parent_asset_id: unit.id }).eq('parent_asset_id', old.id)
    if (cErr) throw new Error(cErr.message)
  }
  const { error: lErr } = await db().from('work_order_parts').update({ site_asset_id: unit.id }).eq('id', o.part.id)
  if (lErr) throw new Error(lErr.message)
  return { assetId: unit.id, replaced: old?.id ?? null }
}

/** The part came off the job → remove the unit it made and put back the one it replaced. */
export async function undoInstall(partId: string) {
  if (!(await assetsReady())) return
  const { data } = await db().from('site_assets').select('id').eq('installed_part_id', partId)
  for (const a of (data ?? []) as { id: string }[]) {
    const { data: olds } = await db().from('site_assets').select('id').eq('replaced_by_asset_id', a.id).limit(1)
    const old = (olds?.[0] as { id: string } | undefined)?.id ?? null
    // units that hung under the new one go back under the old one (or loose)
    const { error: cErr } = await db().from('site_assets').update({ parent_asset_id: old }).eq('parent_asset_id', a.id)
    if (cErr) throw new Error(cErr.message)
    if (old) {
      const { error: rErr } = await db().from('site_assets').update({ status: 'active', replaced_by_asset_id: null, removed_at: null, removal_wo_id: null }).eq('id', old)
      if (rErr) throw new Error(rErr.message)
    }
    const { error } = await db().from('site_assets').delete().eq('id', a.id)
    if (error) throw new Error(error.message)
  }
}

/** A confirmed job-equipment item → its unit at the property (or the one already there with that serial). */
export async function unitFromEquipment(e: { id: string; work_order_id: string; name: string; make?: string | null; model?: string | null; sku?: string | null; serial_number?: string | null; location?: string | null; product_id?: string | null; confirmed_by?: string | null; site_asset_id?: string | null }): Promise<string | null> {
  if (e.site_asset_id || !(await assetsReady())) return e.site_asset_id ?? null
  const { data: wo } = await db().from('work_orders').select('id, site_id, org_id, opening_id').eq('id', e.work_order_id).maybeSingle()
  const w = wo as { id: string; site_id: string | null; org_id: string | null; opening_id?: string | null } | null
  if (!w?.site_id) return null
  let id: string | null = null
  if (e.serial_number?.trim()) {
    const { data } = await db().from('site_assets').select('id').eq('site_id', w.site_id).ilike('serial_number', e.serial_number.trim()).limit(1)
    id = (data?.[0] as { id: string } | undefined)?.id ?? null
  }
  if (!id) {
    const p = await productInfo(e.product_id)
    const now = new Date().toISOString()
    const name = [e.make, e.model].filter(Boolean).join(' ').trim() || p?.name || e.name
    const u = await createUnit({
      site_id: w.site_id, org_id: w.org_id, product_id: e.product_id ?? null, product_name: name, product_sku: e.sku ?? p?.sku ?? null,
      product_category: p?.category ?? null, serial_number: e.serial_number?.trim() || null, location_note: e.location || null,
      opening_id: w.opening_id ?? null, work_order_id: w.id, installed_by: e.confirmed_by ?? null, installed_at: now,
      warranty_expires_at: warrantyEnd(now, p?.warranty_months), install_notes: 'From the job’s equipment list',
    })
    id = u.id
  }
  const { error } = await db().from('wo_installed_equipment').update({ site_asset_id: id }).eq('id', e.id)
  if (error) throw new Error(error.message)
  return id
}

/** Everything that happened to a unit, newest first. */
export async function unitHistory(asset: { id: string; site_id: string; opening_id?: string | null; work_order_id?: string | null; removal_wo_id?: string | null; installed_at?: string | null; created_at?: string | null; product_name?: string | null }) {
  type Ev = { at: string; kind: 'install' | 'job' | 'part' | 'fault' | 'event' | 'request' | 'replaced'; text: string; job_id?: string | null }
  const out: Ev[] = []
  const safe = async <T>(p: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> => { const r = await p; return r.error ? [] : (r.data ?? []) }
  const [parts, faults, events, reqs, replacedBy] = await Promise.all([
    safe<{ work_order_id: string; name: string; qty: number | null; action: string | null; created_at: string }>(db().from('work_order_parts').select('work_order_id, name, qty, action, created_at').eq('site_asset_id', asset.id).limit(100)),
    safe<{ id: string; title: string | null; created_at: string; status: string | null }>(db().from('incidents').select('id, title, created_at, status').eq('asset_id', asset.id).order('created_at', { ascending: false }).limit(50)),
    safe<{ event_type: string; summary: string | null; created_at: string }>(db().from('site_events').select('event_type, summary, created_at').eq('asset_id', asset.id).order('created_at', { ascending: false }).limit(50)),
    safe<{ id: string; title: string; created_at: string; status: string | null }>(db().from('wo_requests').select('id, title, created_at, status').eq('asset_id', asset.id).order('created_at', { ascending: false }).limit(50)),
    safe<{ id: string; product_name: string; removed_at: string | null; removal_wo_id: string | null }>(db().from('site_assets').select('id, product_name, removed_at, removal_wo_id').eq('replaced_by_asset_id', asset.id).limit(5)),
  ])
  // Jobs: the install job, the removal job, jobs that used parts on it, and jobs at its gate/door.
  const jobIds = new Set<string>([asset.work_order_id, asset.removal_wo_id, ...parts.map((p) => p.work_order_id)].filter(Boolean) as string[])
  let jobs: { id: string; wo_number: string | null; title: string | null; status: string | null; completed_at: string | null; created_at: string; visit_type?: string | null }[] = []
  if (asset.opening_id) jobs = await safe(db().from('work_orders').select('id, wo_number, title, status, completed_at, created_at').eq('opening_id', asset.opening_id).order('created_at', { ascending: false }).limit(50))
  const missing = Array.from(jobIds).filter((id) => !jobs.some((j) => j.id === id))
  if (missing.length) jobs = jobs.concat(await safe(db().from('work_orders').select('id, wo_number, title, status, completed_at, created_at').in('id', missing)))
  if (asset.installed_at || asset.created_at) out.push({ at: String(asset.installed_at ?? asset.created_at), kind: 'install', text: `Installed${asset.product_name ? ` — ${asset.product_name}` : ''}`, job_id: asset.work_order_id ?? null })
  for (const j of jobs) out.push({ at: j.completed_at ?? j.created_at, kind: 'job', text: `${j.wo_number ? `${j.wo_number} · ` : ''}${j.title ?? 'Job'}${j.status ? ` (${j.status})` : ''}`, job_id: j.id })
  for (const p of parts) out.push({ at: p.created_at, kind: 'part', text: `${p.action === 'installed' ? 'Put in' : 'Part used'}: ${p.name}${(p.qty ?? 1) > 1 ? ` × ${p.qty}` : ''}`, job_id: p.work_order_id })
  for (const f of faults) out.push({ at: f.created_at, kind: 'fault', text: `Fault: ${f.title ?? 'problem'}${f.status ? ` (${f.status})` : ''}` })
  for (const e of events) out.push({ at: e.created_at, kind: 'event', text: e.summary ?? e.event_type })
  for (const r of reqs) out.push({ at: r.created_at, kind: 'request', text: `Request: ${r.title}${r.status ? ` (${r.status})` : ''}` })
  for (const o of replacedBy) out.push({ at: o.removed_at ?? '', kind: 'replaced', text: `Replaced ${o.product_name}`, job_id: o.removal_wo_id })
  return out.filter((e) => e.at).sort((a, b) => b.at.localeCompare(a.at))
}
