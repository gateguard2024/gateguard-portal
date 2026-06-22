/**
 * Win → auto-kickoff provisioning.
 *
 * When an opportunity is marked "won", this:
 *   1. Ensures a site exists for the deal (creates one from the opp if needed).
 *   2. Pre-fills the door list from the site survey (falls back to gate counts).
 *   3. Creates a "requested" controller row in site_panels (source = 'kickoff')
 *      so the site shows up in corporate's "Sites to provision" queue.
 *   4. Logs a timeline event.
 *
 * The dealer then confirms the door list; corporate programs the controller in
 * Brivo and enters the serial. Idempotent — safe to call more than once.
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Words that mark a surveyed device as an access point / opening worth a door.
const DOOR_KEYWORDS = ['gate', 'door', 'entry', 'entrance', 'pedestrian', 'vehicle', 'garage', 'lobby', 'turnstile', 'barrier', 'reader', 'access', 'arm', 'callbox', 'call box', 'intercom', 'manc-', 'man gate', 'side gate', 'rear gate']

export type KickoffResult = { ok: boolean; created_site?: boolean; site_id?: string; panel_id?: string; doors?: string[]; skipped?: string; error?: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

function isMissingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === '42703' || error.code === 'PGRST204'
}

/** Best-effort door-name list from the most recent survey, else from gate counts. */
async function extractDoors(oppId: string, siteId: string, opp: Row): Promise<string[]> {
  // 1. Most recent survey tied to this opp or site.
  let survey: Row | null = null
  try {
    const byOpp = await supabase.from('surveys').select('devices, created_at').eq('opportunity_id', oppId).order('created_at', { ascending: false }).limit(1)
    survey = (byOpp.data ?? [])[0] ?? null
    if (!survey) {
      const bySite = await supabase.from('surveys').select('devices, created_at').eq('site_id', siteId).order('created_at', { ascending: false }).limit(1)
      survey = (bySite.data ?? [])[0] ?? null
    }
  } catch { /* surveys optional */ }

  const devices: Row[] = Array.isArray(survey?.devices) ? survey!.devices : []
  if (devices.length) {
    const named = devices
      .map(d => ({ name: String(d?.name ?? d?.label ?? d?.location ?? '').trim(), text: `${d?.name ?? ''} ${d?.location ?? ''} ${d?.type ?? ''} ${d?.category ?? ''}`.toLowerCase() }))
      .filter(d => d.name)
    const openings = named.filter(d => DOOR_KEYWORDS.some(k => d.text.includes(k)))
    const picked = (openings.length ? openings : named).map(d => d.name)
    // De-dupe, keep order.
    const seen = new Set<string>()
    const doors = picked.filter(n => { const k = n.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true })
    if (doors.length) return doors
  }

  // 2. Fallback: synthesize from whatever gate/door counts the opp carries.
  const num = (...keys: string[]): number => {
    for (const k of keys) { const v = Number(opp?.[k]); if (Number.isFinite(v) && v > 0) return Math.min(v, 24) }
    return 0
  }
  const doors: string[] = []
  const veh = num('vehicles_gates', 'vehicle_gates', 'vehicle_gate_count', 'gates')
  const ped = num('pedestrian_gates', 'pedestrian_gate_count', 'ped_gates')
  for (let i = 1; i <= veh; i++) doors.push(veh === 1 ? 'Vehicle Gate' : `Vehicle Gate ${i}`)
  for (let i = 1; i <= ped; i++) doors.push(ped === 1 ? 'Pedestrian Gate' : `Pedestrian Gate ${i}`)
  return doors
}

export async function kickoffProvisioning(oppId: string): Promise<KickoffResult> {
  try {
    const { data: oppData } = await supabase.from('opportunities').select('*').eq('id', oppId).maybeSingle()
    if (!oppData) return { ok: false, error: 'opportunity not found' }
    const opp = oppData as Row

    // 1. Ensure a site exists.
    let siteId: string | null = opp.site_id ?? null
    let createdSite = false
    if (!siteId) {
      const { data: existing } = await supabase.from('sites').select('id').eq('crm_opp_id', oppId).maybeSingle()
      siteId = (existing as { id?: string } | null)?.id ?? null
    }
    if (!siteId) {
      const orgId = opp.dealer_org_id ?? null
      const insert: Row = {
        name: opp.account_name ?? 'New site',
        address: opp.property_address ?? null,
        city: opp.property_city ?? null,
        state: opp.property_state ?? null,
        units: opp.units ?? null,
        org_id: orgId,
        master_dealer_id: orgId,
        primary_contact_name: opp.site_contact_name ?? null,
        primary_contact_email: opp.site_contact_email ?? null,
        primary_contact_phone: opp.site_contact_phone ?? null,
        status: 'active',
        crm_opp_id: oppId,
      }
      let { data: site, error } = await supabase.from('sites').insert(insert).select('id').single()
      // Drift-resilient: strip any column this DB doesn't have and retry.
      let guard = 0
      while (error && isMissingColumn(error) && guard < 12) {
        const m = /Could not find the '([a-z_]+)' column/i.exec(error.message) || /column "?([a-z_]+)"?/i.exec(error.message)
        const col = m?.[1]
        if (!col || !(col in insert)) break
        delete insert[col]; guard++
        ;({ data: site, error } = await supabase.from('sites').insert(insert).select('id').single())
      }
      if (error || !site) return { ok: false, error: error?.message ?? 'site create failed' }
      siteId = (site as { id: string }).id
      createdSite = true
    }
    if (!opp.site_id && siteId) {
      await supabase.from('opportunities').update({ site_id: siteId }).eq('id', oppId)
    }

    // 2. Idempotency — one kickoff panel per site.
    const { data: existingPanel } = await supabase.from('site_panels').select('id').eq('site_id', siteId).eq('source', 'kickoff').maybeSingle()
    if (existingPanel) return { ok: true, site_id: siteId!, created_site: createdSite, skipped: 'kickoff panel exists', panel_id: (existingPanel as { id: string }).id }

    // 3. Pull doors from the survey.
    const doors = await extractDoors(oppId, siteId!, opp)

    // 4. Create the provisioning (requested) panel.
    const panelInsert: Row = {
      site_id: siteId, status: 'requested', source: 'kickoff',
      doors: doors.map(name => ({ name })), door_count: doors.length || null,
      notes: 'Auto-created when the deal was won. Dealer confirms the door list, then corporate programs the controller in Brivo.',
    }
    let { data: panel, error: pErr } = await supabase.from('site_panels').insert(panelInsert).select('id').single()
    let pg = 0
    while (pErr && isMissingColumn(pErr) && pg < 6) {
      const m = /Could not find the '([a-z_]+)' column/i.exec(pErr.message) || /column "?([a-z_]+)"?/i.exec(pErr.message)
      const col = m?.[1]
      if (!col || !(col in panelInsert)) break
      delete panelInsert[col]; pg++
      ;({ data: panel, error: pErr } = await supabase.from('site_panels').insert(panelInsert).select('id').single())
    }
    if (pErr || !panel) return { ok: false, site_id: siteId!, created_site: createdSite, error: pErr?.message ?? 'panel create failed' }

    // 5. Timeline event (live site_events column set: no title/description).
    try {
      await supabase.from('site_events').insert({
        site_id: siteId, event_type: 'provisioning_kickoff', event_source: 'nexus',
        summary: `Deal won — provisioning kicked off${doors.length ? ` (${doors.length} door${doors.length === 1 ? '' : 's'} pre-filled from survey)` : ''}`,
        severity: 'info',
        metadata: { opportunity_id: oppId, doors, created_site: createdSite } as Row,
      })
    } catch { /* timeline optional */ }

    return { ok: true, site_id: siteId!, created_site: createdSite, panel_id: (panel as { id: string }).id, doors }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
