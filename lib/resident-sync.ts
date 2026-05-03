/**
 * lib/resident-sync.ts — GateGuard Portal
 *
 * Core resident reconciliation engine.
 *
 * For each org with Brivo + (optionally) UniFi configured:
 *   1. Pull all users from Brivo for the org's site
 *   2. Upsert active residents into our residents table
 *   3. Deactivate residents no longer in Brivo
 *   4. If UniFi is configured + resident has a known MAC:
 *      → ensure their MAC is in the "Residents" UniFi client group
 *      → remove deactivated residents' MACs from the group
 *
 * Designed to run on a schedule (hourly via Vercel Cron) or on-demand.
 */

import { createClient }             from '@supabase/supabase-js'
import { getOrgBrivoToken, listBrivoUsers } from './brivo'
import { makeUniFiClient, uniFiConfigFromOrg } from './unifi'

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export interface SyncResult {
  orgId:       string
  orgName:     string
  upserted:    number
  deactivated: number
  unifiSynced: number
  error?:      string
  durationMs:  number
}

/**
 * Sync residents for a single org. Returns a result summary.
 */
export async function syncOrgResidents(orgId: string): Promise<SyncResult> {
  const start = Date.now()
  const db    = serviceDb()

  // Load org config
  const { data: org, error: orgErr } = await db
    .from('organizations')
    .select([
      'id', 'name',
      'brivo_site_id', 'brivo_username', 'brivo_password',
      'unifi_host', 'unifi_api_key', 'unifi_site_id', 'unifi_resident_group',
    ].join(', '))
    .eq('id', orgId)
    .single()

  if (orgErr || !org) {
    return { orgId, orgName: '?', upserted: 0, deactivated: 0, unifiSynced: 0, error: `Org not found: ${orgErr?.message}`, durationMs: Date.now() - start }
  }

  const result: SyncResult = {
    orgId,
    orgName:     org.name,
    upserted:    0,
    deactivated: 0,
    unifiSynced: 0,
    durationMs:  0,
  }

  try {
    // ── 1. Fetch Brivo users ────────────────────────────────────────────────
    if (!org.brivo_site_id) throw new Error('brivo_site_id not set on org')

    const { token, apiKey } = await getOrgBrivoToken(orgId)
    const brivoUsers        = await listBrivoUsers(token, apiKey, org.brivo_site_id)

    console.log(`[resident-sync] ${org.name}: ${brivoUsers.length} users from Brivo`)

    // ── 2. Upsert active residents ──────────────────────────────────────────
    const now         = new Date().toISOString()
    const activeUsers = brivoUsers.filter(u => u.active)

    if (activeUsers.length > 0) {
      const rows = activeUsers.map(u => ({
        org_id:         orgId,
        brivo_user_id:  u.id,
        first_name:     u.firstName || '(Unknown)',
        last_name:      u.lastName  || '',
        email:          u.email,
        phone:          u.phone,
        unit_number:    u.unitNumber,
        active:         true,
        last_synced_at: now,
      }))

      const { error: upsertErr } = await db
        .from('residents')
        .upsert(rows, { onConflict: 'org_id, brivo_user_id', ignoreDuplicates: false })

      if (upsertErr) throw new Error(`Upsert failed: ${upsertErr.message}`)
      result.upserted = rows.length
    }

    // ── 3. Deactivate residents no longer in Brivo ──────────────────────────
    const activeBrivoIds = activeUsers.map(u => u.id)

    if (activeBrivoIds.length > 0) {
      // First, find the residents we need to deactivate so we have their MACs
      const { data: toDeactivate } = await db
        .from('residents')
        .select('id, mac_address')
        .eq('org_id', orgId)
        .eq('active', true)
        .not('brivo_user_id', 'in', `(${activeBrivoIds.map(id => `"${id}"`).join(',')})`)

      if (toDeactivate && toDeactivate.length > 0) {
        const ids = toDeactivate.map(r => r.id)
        await db.from('residents').update({ active: false, last_synced_at: now }).in('id', ids)
        result.deactivated = toDeactivate.length

        // Remove deactivated residents from UniFi group
        const uniFiCfg = uniFiConfigFromOrg(org)
        if (uniFiCfg) {
          const unifi = makeUniFiClient(uniFiCfg)
          for (const r of toDeactivate) {
            if (r.mac_address) {
              try { await unifi.removeFromGroup(r.mac_address) } catch (e: any) {
                console.warn(`[resident-sync] UniFi remove ${r.mac_address}: ${e.message}`)
              }
            }
          }
        }
      }
    }

    // ── 4. Sync MACs to UniFi resident group ───────────────────────────────
    const uniFiCfg = uniFiConfigFromOrg(org)

    if (uniFiCfg) {
      try {
        const unifi = makeUniFiClient(uniFiCfg)
        const group = await unifi.findOrCreateGroup(uniFiCfg.residentGroup)

        // Fetch all active residents with known MACs for this org
        const { data: residentsWithMac } = await db
          .from('residents')
          .select('id, mac_address, first_name, last_name, unit_number, unifi_group_id')
          .eq('org_id', orgId)
          .eq('active', true)
          .not('mac_address', 'is', null)

        let synced = 0
        for (const r of (residentsWithMac ?? [])) {
          try {
            const displayName = `${r.first_name} ${r.last_name}${r.unit_number ? ` · Unit ${r.unit_number}` : ''}`
            await unifi.assignToGroup(r.mac_address, group._id, displayName)

            // Record the group ID back to the resident row (only if changed)
            if (r.unifi_group_id !== group._id) {
              await db.from('residents').update({ unifi_group_id: group._id }).eq('id', r.id)
            }
            synced++
          } catch (e: any) {
            console.warn(`[resident-sync] UniFi assign ${r.mac_address}: ${e.message}`)
          }
        }

        result.unifiSynced = synced
        console.log(`[resident-sync] ${org.name}: ${synced} MACs synced to UniFi group "${group.name}"`)
      } catch (e: any) {
        // UniFi errors are non-fatal — Brivo sync still succeeded
        console.warn(`[resident-sync] ${org.name} UniFi error: ${e.message}`)
      }
    }

  } catch (err: any) {
    result.error = err.message
    console.error(`[resident-sync] ${org.name} error:`, err.message)
  }

  result.durationMs = Date.now() - start

  // ── Write sync log ────────────────────────────────────────────────────────
  await serviceDb().from('sync_log').insert({
    org_id:      orgId,
    sync_type:   'brivo_residents',
    status:      result.error ? 'error' : 'success',
    upserted:    result.upserted,
    deactivated: result.deactivated,
    unifi_synced: result.unifiSynced,
    error_msg:   result.error ?? null,
    duration_ms: result.durationMs,
  })

  return result
}

/**
 * Sync all orgs with brivo_site_id set.
 * Optionally filter to a single org by ID.
 */
export async function syncAllResidents(orgIdFilter?: string): Promise<SyncResult[]> {
  const db = serviceDb()

  let q = db
    .from('organizations')
    .select('id')
    .eq('status', 'active')
    .not('brivo_site_id', 'is', null)
    .not('brivo_username', 'is', null)

  if (orgIdFilter) q = q.eq('id', orgIdFilter)

  const { data: orgs, error } = await q
  if (error || !orgs?.length) return []

  // Run sequentially to avoid hammering Brivo API
  const results: SyncResult[] = []
  for (const { id } of orgs) {
    results.push(await syncOrgResidents(id))
  }
  return results
}
