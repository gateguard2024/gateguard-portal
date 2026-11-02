/**
 * Inactive properties + customers, and "Take a property offline" (migration 213).
 *
 *   Inactive        status 'inactive' — monthly billing stops (generate-monthly only bills 'active'),
 *                   Gate Watch pauses, the customer portal is turned off, a "final invoice" task is made.
 *   Take offline    the same, plus a Removal work order listing every installed device; each device is
 *                   marked removed → back to stock / thrown out / left with the customer; then close out
 *                   → 'decommissioned'. Nothing is deleted. Reactivate undoes the pauses.
 *
 * Who: starting / reactivating / closing is CORPORATE ONLY (routes check). Recording a removed device is
 * also allowed from the Removal job itself (guardWorkOrder) so the tech in the field can do it.
 * Vendor logins (Setup & keys) are NOT touched here — corporate removes them in Setup & keys.
 *
 * Every write is awaited and error-checked.
 */
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export const INACTIVE_SITE_STATUSES = ['inactive', 'decommissioning', 'decommissioned'] as const
export const isInactiveSite = (status: unknown) => (INACTIVE_SITE_STATUSES as readonly string[]).includes(String(status ?? ''))
export const REMOVED_TO = { stock: 'Back to stock', disposed: 'Thrown out', left_on_site: 'Left with the customer' } as const
export type RemovedTo = keyof typeof REMOVED_TO
export const isRemovedTo = (v: unknown): v is RemovedTo => typeof v === 'string' && v in REMOVED_TO

type Who = { id: string; name: string; org_id?: string | null }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = Record<string, any>
type Decom = {
  prev_status?: string | null
  started_at?: string | null
  removal_wo_id?: string | null
  billing_todo_id?: string | null
  paused_watch_ids?: string[]
  paused_portal_ids?: string[]
  shutoff_at?: string | null
  closed_at?: string | null
}

const missing212 = (m: string) => /column|does not exist|schema cache/i.test(m) && /inactive_|decommission|removed_|last_service/.test(m)
const friendly = (m: string) => (missing212(m) ? 'This needs migration 213 (Inactive + take offline). Run it on Supabase first.' : m)

const SITE_COLS = 'id, name, address, city, state, status, org_id, master_dealer_id, install_dealer_id, service_dealer_id, inactive_at, inactive_reason, inactive_by, last_service_date, decommission'

export async function loadSite(siteId: string): Promise<{ site?: Any; error?: string }> {
  const { data, error } = await sb.from('sites').select(SITE_COLS).eq('id', siteId).maybeSingle()
  if (error) return { error: friendly(error.message) }
  if (!data) return { error: 'Property not found.' }
  return { site: data }
}

/** Everything the "Take offline" sheet shows. */
export async function getDecommission(siteId: string) {
  const s = await loadSite(siteId)
  if (!s.site) return { error: s.error }
  const site = s.site
  const d: Decom = site.decommission ?? {}
  const [assets, watches, portals, job, todo] = await Promise.all([
    sb.from('site_assets').select('id, product_name, product_category, serial_number, location_note, status, removed_at, removed_to, removed_by, removal_photo').eq('site_id', siteId).order('product_name'),
    sb.from('gate_watches').select('id, label, enabled').eq('site_id', siteId),
    sb.from('client_portals').select('id, slug, status').eq('site_id', siteId),
    d.removal_wo_id ? sb.from('work_orders').select('id, wo_number, status, scheduled_date, assignee_name').eq('id', d.removal_wo_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    d.billing_todo_id ? sb.from('todos').select('id, title, status, due_date, assigned_to_name').eq('id', d.billing_todo_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ])
  if (assets.error) return { error: friendly(assets.error.message) }
  const list = (assets.data ?? []) as Any[]
  const installed = list.filter(a => a.status !== 'removed')
  const removed = list.filter(a => a.status === 'removed')
  return {
    site: { id: site.id, name: site.name, address: [site.address, site.city, site.state].filter(Boolean).join(', '), status: site.status ?? 'active', inactive_at: site.inactive_at, inactive_reason: site.inactive_reason, inactive_by: site.inactive_by, last_service_date: site.last_service_date },
    decommission: d,
    installed, removed,
    watches: { total: (watches.data ?? []).length, on: (watches.data ?? []).filter((w: Any) => w.enabled).length },
    portals: { total: (portals.data ?? []).length, live: (portals.data ?? []).filter((p: Any) => p.status === 'live').length },
    job: job.data ?? null,
    billingTodo: todo.data ?? null,
  }
}

async function saveSite(siteId: string, patch: Any): Promise<string | null> {
  const { error } = await sb.from('sites').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', siteId)
  return error ? friendly(error.message) : null
}

/** Pause Gate Watch + turn the customer portal off. Returns the ids it changed so reactivate can undo exactly those. */
async function shutOff(siteId: string): Promise<{ watchIds: string[]; portalIds: string[]; error?: string }> {
  const w = await sb.from('gate_watches').update({ enabled: false, updated_at: new Date().toISOString() }).eq('site_id', siteId).eq('enabled', true).select('id')
  if (w.error) return { watchIds: [], portalIds: [], error: w.error.message }
  const p = await sb.from('client_portals').update({ status: 'disabled' }).eq('site_id', siteId).eq('status', 'live').select('id')
  // A site with no portal table yet (old DB) isn't a reason to stop.
  if (p.error && !/client_portals/.test(p.error.message)) return { watchIds: (w.data ?? []).map(r => String(r.id)), portalIds: [], error: p.error.message }
  return { watchIds: (w.data ?? []).map(r => String(r.id)), portalIds: (p.data ?? []).map(r => String(r.id)) }
}

async function billingTodo(site: Any, who: Who, lastDay: string | null, takingOffline: boolean): Promise<{ id?: string; error?: string }> {
  const { data, error } = await sb.from('todos').insert({
    title: `Final invoice or credit — ${site.name}`,
    body: `${site.name} was ${takingOffline ? 'taken offline' : 'marked inactive'}${lastDay ? ` (last day of service ${lastDay})` : ''}. Monthly billing has stopped. Send the final invoice, or a credit if they prepaid, and collect any equipment balance.`,
    priority: 'high', status: 'open',
    due_date: lastDay ?? new Date().toISOString().slice(0, 10),
    org_id: who.org_id ?? null, tags: ['billing', 'inactive'],
    created_by: who.id, created_by_name: who.name, assigned_to: who.id, assigned_to_name: who.name,
    linked_type: 'site', linked_id: site.id, linked_label: site.name,
  }).select('id').single()
  if (error) return { error: error.message }
  return { id: String(data.id) }
}

/** Mark a property inactive (or start taking it offline). */
export async function deactivateSite(siteId: string, who: Who, opts: { reason: string; lastDay?: string | null; takeOffline?: boolean }): Promise<{ ok: boolean; error?: string; warnings?: string[] }> {
  const reason = String(opts.reason ?? '').trim().slice(0, 500)
  if (!reason) return { ok: false, error: 'Say why (one line is fine).' }
  const lastDay = opts.lastDay && /^\d{4}-\d{2}-\d{2}$/.test(opts.lastDay) ? opts.lastDay : null
  const s = await loadSite(siteId)
  if (!s.site) return { ok: false, error: s.error }
  const site = s.site
  const d: Decom = site.decommission ?? {}
  const warnings: string[] = []
  const already = isInactiveSite(site.status)

  // Status first — this is what stops billing. If it fails, nothing else happens.
  const now = new Date().toISOString()
  const nextStatus = opts.takeOffline ? 'decommissioning' : (already ? site.status : 'inactive')
  const err = await saveSite(siteId, {
    status: nextStatus,
    inactive_at: already ? (site.inactive_at ?? now) : now,
    inactive_reason: reason, inactive_by: who.name, last_service_date: lastDay ?? site.last_service_date ?? null,
    decommission: { ...d, prev_status: already ? (d.prev_status ?? 'active') : (site.status ?? 'active'), ...(opts.takeOffline && !d.started_at ? { started_at: now } : {}) },
  })
  if (err) return { ok: false, error: err }

  const off = await shutOff(siteId)
  if (off.error) warnings.push(`Couldn’t pause everything: ${off.error}`)
  let todoId = d.billing_todo_id ?? null
  if (!todoId) {
    const t = await billingTodo(site, who, lastDay, !!opts.takeOffline)
    if (t.error) warnings.push(`The final-invoice task wasn’t made: ${t.error}`)
    todoId = t.id ?? null
  }
  const err2 = await saveSite(siteId, {
    decommission: {
      ...d,
      prev_status: already ? (d.prev_status ?? 'active') : (site.status ?? 'active'),
      ...(opts.takeOffline && !d.started_at ? { started_at: now } : {}),
      billing_todo_id: todoId,
      paused_watch_ids: [...new Set([...(d.paused_watch_ids ?? []), ...off.watchIds])],
      paused_portal_ids: [...new Set([...(d.paused_portal_ids ?? []), ...off.portalIds])],
      shutoff_at: d.shutoff_at ?? now,
    },
  })
  if (err2) warnings.push(`Saved, but the undo list didn’t: ${err2}`)
  return { ok: true, warnings }
}

/** Turn a property back on: status back, Gate Watch + portal that WE paused turn back on. Removed equipment stays removed. */
export async function reactivateSite(siteId: string): Promise<{ ok: boolean; error?: string; warnings?: string[] }> {
  const s = await loadSite(siteId)
  if (!s.site) return { ok: false, error: s.error }
  const site = s.site
  const d: Decom = site.decommission ?? {}
  const warnings: string[] = []
  const prev = d.prev_status && !isInactiveSite(d.prev_status) ? d.prev_status : 'active'
  const err = await saveSite(siteId, { status: prev, inactive_at: null, inactive_reason: null, inactive_by: null, decommission: null })
  if (err) return { ok: false, error: err }
  if (d.paused_watch_ids?.length) {
    const { error } = await sb.from('gate_watches').update({ enabled: true, next_check_at: new Date().toISOString(), updated_at: new Date().toISOString() }).in('id', d.paused_watch_ids).eq('site_id', siteId)
    if (error) warnings.push(`Gate Watch didn’t turn back on: ${error.message}`)
  }
  if (d.paused_portal_ids?.length) {
    const { error } = await sb.from('client_portals').update({ status: 'live' }).in('id', d.paused_portal_ids).eq('site_id', siteId)
    if (error) warnings.push(`The customer portal didn’t turn back on: ${error.message}`)
  }
  return { ok: true, warnings }
}

/** Make the Removal work order: one checklist step per installed device. */
export async function createRemovalJob(siteId: string, who: Who, opts: { date?: string | null }): Promise<{ ok: boolean; id?: string; error?: string }> {
  const r = await getDecommission(siteId)
  if (!r.site) return { ok: false, error: r.error }
  const d = r.decommission
  if (d.removal_wo_id && r.job) return { ok: true, id: d.removal_wo_id }
  const s = await loadSite(siteId)
  const site = s.site!
  const date = opts.date && /^\d{4}-\d{2}-\d{2}$/.test(opts.date) ? opts.date : null
  const { data: wo, error } = await sb.from('work_orders').insert({
    title: `Remove equipment — ${site.name}`,
    description: `Taking ${site.name} offline${r.site.inactive_reason ? ` (${r.site.inactive_reason})` : ''}. Remove each device on the list, and for each one record where it went: back to stock, thrown out, or left with the customer. Take a photo of the empty spots.`,
    customer_name: site.name, site_id: siteId, job_type: 'Removal', priority: 'normal',
    status: date ? 'scheduled' : 'open', scheduled_date: date,
    org_id: site.service_dealer_id ?? site.install_dealer_id ?? site.master_dealer_id ?? null,
  }).select('id').single()
  if (error) return { ok: false, error: error.message }
  const steps = [
    ...r.installed.map((a: Any) => `Remove ${a.product_name || 'device'}${a.location_note && a.location_note !== 'Main' ? ` — ${a.location_note}` : ''}${a.serial_number ? ` (SN ${a.serial_number})` : ''}`),
    'Photo of the empty mounting spots and the equipment room',
    'Bring removed equipment back to the office',
  ]
  const { error: cErr } = await sb.from('wo_checklist_items').insert(steps.map((title, i) => ({ work_order_id: wo.id, title: title.slice(0, 300), sort_order: i, category: 'task', added_by: 'management' })))
  const err = await saveSite(siteId, { decommission: { ...d, removal_wo_id: wo.id } })
  if (err) return { ok: false, id: wo.id, error: `Job made, but not linked to the property: ${err}` }
  if (cErr) return { ok: true, id: wo.id, error: `Job made, but the device list didn’t save: ${cErr.message}` }
  return { ok: true, id: wo.id }
}

/** Record where one device went (or undo with to = null). */
export async function recordRemoval(siteId: string, assetId: string, to: RemovedTo | null, who: { name: string }, opts: { woId?: string | null; photo?: string | null } = {}): Promise<{ ok: boolean; error?: string }> {
  const patch = to
    ? { status: 'removed', removed_at: new Date().toISOString(), removed_to: to, removed_by: who.name, removal_wo_id: opts.woId ?? null, ...(opts.photo ? { removal_photo: String(opts.photo).slice(0, 1000) } : {}) }
    : { status: 'active', removed_at: null, removed_to: null, removed_by: null, removal_wo_id: null, removal_photo: null }
  const { data, error } = await sb.from('site_assets').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', assetId).eq('site_id', siteId).select('id, product_name').maybeSingle()
  if (error) return { ok: false, error: friendly(error.message) }
  if (!data) return { ok: false, error: 'That device isn’t at this property.' }
  // Tick the matching step on the removal job (best match by name; awaited, failure is only a warning).
  if (opts.woId && data.product_name) {
    const { data: items } = await sb.from('wo_checklist_items').select('id, title').eq('work_order_id', opts.woId)
    const hit = (items ?? []).find(i => String(i.title).startsWith(`Remove ${data.product_name}`))
    if (hit) await sb.from('wo_checklist_items').update({ completed: !!to, completed_by_name: to ? who.name : null, completed_at: to ? new Date().toISOString() : null }).eq('id', hit.id)
  }
  return { ok: true }
}

/** Last step: every device accounted for → 'decommissioned'. */
export async function closeOut(siteId: string): Promise<{ ok: boolean; error?: string }> {
  const r = await getDecommission(siteId)
  if (!r.site) return { ok: false, error: r.error }
  if (r.installed.length) return { ok: false, error: `${r.installed.length} device${r.installed.length === 1 ? ' is' : 's are'} still listed as installed. Mark where each one went first.` }
  const err = await saveSite(siteId, { status: 'decommissioned', decommission: { ...r.decommission, closed_at: new Date().toISOString() } })
  return err ? { ok: false, error: err } : { ok: true }
}

/** Customer (organization) active / inactive. Optionally turns their properties off too. */
export async function setCustomerActive(orgId: string, active: boolean, who: Who, opts: { reason?: string; sites?: boolean; lastDay?: string | null }): Promise<{ ok: boolean; error?: string; sites?: number; warnings?: string[] }> {
  const reason = String(opts.reason ?? '').trim().slice(0, 500)
  if (!active && !reason) return { ok: false, error: 'Say why (one line is fine).' }
  const { data: org, error: oErr } = await sb.from('organizations').select('id, name, tier').eq('id', orgId).maybeSingle()
  if (oErr) return { ok: false, error: oErr.message }
  if (!org) return { ok: false, error: 'Customer not found.' }
  if (org.tier === 'corporate') return { ok: false, error: 'Gate Guard itself can’t be made inactive.' }
  const { error } = await sb.from('organizations').update(active
    ? { status: 'active', is_active: true, inactive_at: null, inactive_reason: null, inactive_by: null, updated_at: new Date().toISOString() }
    : { status: 'inactive', is_active: false, inactive_at: new Date().toISOString(), inactive_reason: reason, inactive_by: who.name, updated_at: new Date().toISOString() }).eq('id', orgId)
  if (error) return { ok: false, error: friendly(error.message) }
  if (!opts.sites) return { ok: true, sites: 0 }
  // Their properties: sites owned by this org.
  const { data: sites, error: sErr } = await sb.from('sites').select('id, status').eq('org_id', orgId)
  if (sErr) return { ok: true, sites: 0, warnings: [`Customer saved, properties not changed: ${sErr.message}`] }
  const warnings: string[] = []
  let n = 0
  for (const s of sites ?? []) {
    if (active ? !isInactiveSite(s.status) || s.status === 'decommissioned' : isInactiveSite(s.status)) continue
    const r = active ? await reactivateSite(String(s.id)) : await deactivateSite(String(s.id), who, { reason: `Customer inactive: ${reason}`, lastDay: opts.lastDay ?? null })
    if (r.ok) n++; else warnings.push(r.error ?? 'A property didn’t change.')
    if (r.warnings?.length) warnings.push(...r.warnings)
  }
  return { ok: true, sites: n, warnings }
}
