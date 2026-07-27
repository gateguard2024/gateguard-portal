/**
 * Nexus: Fleet Health Rollup — Phase 2 of the Operations Command Center.
 *
 * Nightly (and on-demand), for every site that has UniFi and/or Eagle Eye
 * credentials in site_integrations, pull LIVE device state and write it back
 * into the site_assets.status / last_seen_at / offline_since columns that
 * already exist (populated at install, never live until now). No new tables.
 *
 * Matching (honest — only writes rows we can confidently identify):
 *   • UniFi network gear → matched to site_assets by MAC address.
 *   • Eagle Eye cameras  → matched by ESN (serial_number), else exact name.
 * Anything we can't match keeps its install status untouched. Gate operators
 * have no cloud feed, so they are never touched here.
 *
 * The Operations dashboard reads site_assets, so once this runs the "online"
 * tiles light up automatically (onlineTrackingLive flips true) — driven off
 * last_seen_at recency, so only genuinely-polled devices count as live.
 */
import { createClient } from '@supabase/supabase-js'
import { inngest } from '@/inngest/client'
import { getSiteUniFiCloud, listCloudDevices } from '@/lib/unifi-cloud'
import { getSiteEagleEyeAccess, listEagleEyeCameras } from '@/lib/eagle-eye'

type Asset = { id: string; mac_address: string | null; serial_number: string | null; product_name: string | null; product_category: string | null; status: string | null }

// Bucket an asset into an incident category so a machine-raised fault uses the
// same taxonomy codes as a manually-filed one (lib/incident-taxonomy.ts).
// Order matters: camera is checked before network because an NVR reads as both.
function categoryForAsset(cat: string | null, name: string | null): 'network' | 'camera' | 'gate' | 'access' | 'other' {
  const s = `${cat ?? ''} ${name ?? ''}`.toLowerCase()
  if (/camera|nvr|dvr|\bcam\b/.test(s)) return 'camera'
  if (/gate|operator|slide|swing|barrier/.test(s)) return 'gate'
  if (/reader|access|controller|panel|brivo|credential|keypad|intercom/.test(s)) return 'access'
  if (/switch|router|access point|\bap\b|network|unifi|gateway|firewall/.test(s)) return 'network'
  return 'other'
}

const CATEGORY_SEVERITY: Record<string, string> = {
  network: 'high', camera: 'medium', gate: 'high', access: 'medium', other: 'medium',
}

export const fleetHealth = inngest.createFunction(
  {
    id: 'nexus-fleet-health',
    name: 'Nexus: Fleet Health Rollup',
    retries: 1,
    timeouts: { finish: '600s' },
    triggers: [
      { cron: '*/10 * * * *' },           // every 10 min — near-real-time outage detection
      { cron: '0 5 * * *' },              // nightly full sweep (safety net / catches drift)
      { event: 'operations/fleet.sync' }, // on-demand (admin "refresh now" or single site)
    ],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const singleSite: string | undefined = event?.data?.site_id

    return step.run('fleet-health-rollup', async () => {
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      const now = new Date().toISOString()

      // Which sites have integrations to poll?
      let integ = supabase.from('site_integrations').select('site_id, vendor').in('vendor', ['unifi', 'eagle_eye'])
      if (singleSite) integ = integ.eq('site_id', singleSite)
      const { data: rows, error: integErr } = await integ
      if (integErr) return { error: integErr.message }

      const bySite = new Map<string, Set<string>>()
      for (const r of rows ?? []) {
        if (!r.site_id) continue
        if (!bySite.has(r.site_id)) bySite.set(r.site_id, new Set())
        bySite.get(r.site_id)!.add(r.vendor)
      }

      let sitesChecked = 0, matched = 0, online = 0, offline = 0, errors = 0
      let incidentsOpened = 0, incidentsResolved = 0

      // Auto-file a fault into the SAME ledger a human uses (source: 'monitor').
      // Dedup guard: only open if this asset has no already-open monitor incident,
      // so a device that stays down doesn't spawn a new row every 10-minute poll.
      const openMonitorIncident = async (asset: Asset, siteId: string) => {
        const category = categoryForAsset(asset.product_category, asset.product_name)
        const { data: existing } = await supabase
          .from('incidents')
          .select('id')
          .eq('asset_id', asset.id)
          .eq('source', 'monitor')
          .in('status', ['open', 'investigating'])
          .limit(1)
        if (existing && existing.length) return
        const label = category.charAt(0).toUpperCase() + category.slice(1)
        const nm = asset.product_name || asset.mac_address || asset.serial_number || 'device'
        const { error } = await supabase.from('incidents').insert({
          site_id:     siteId,
          title:       `${label} offline — ${nm}`,
          description: 'Auto-detected: device stopped responding to the monitoring poll.',
          severity:    CATEGORY_SEVERITY[category] ?? 'medium',
          status:      'open',
          category,
          cause:       'unknown',
          asset_id:    asset.id,
          source:      'monitor',
          started_at:  now,  // this poll is the moment we first saw it stop responding
        })
        if (error) { errors++; return }
        incidentsOpened++
      }

      // Device recovered → auto-resolve any open monitor incidents for it. Manual /
      // ai / ggsoc incidents are left alone — a person closes those deliberately.
      const resolveMonitorIncidents = async (asset: Asset) => {
        const { data, error } = await supabase
          .from('incidents')
          .update({ status: 'resolved', resolved_at: now })
          .eq('asset_id', asset.id)
          .eq('source', 'monitor')
          .in('status', ['open', 'investigating'])
          .select('id')
        if (error) { errors++; return }
        incidentsResolved += (data?.length ?? 0)
      }

      // Apply one device's live state to its matched asset, and bridge the flip
      // into the incident ledger (down → open a monitor incident, up → resolve it).
      const applyStatus = async (asset: Asset, siteId: string, isOnline: boolean) => {
        matched++; isOnline ? online++ : offline++
        const wasOffline = asset.status === 'offline'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const patch: Record<string, any> = { status: isOnline ? 'active' : 'offline', updated_at: now }
        if (isOnline) { patch.last_seen_at = now; patch.offline_since = null }
        else if (!wasOffline) { patch.offline_since = now }
        const { error } = await supabase.from('site_assets').update(patch).eq('id', asset.id)
        if (error) { errors++; return }

        // Transition-driven so it's self-deduping: only act on an actual flip.
        if (!isOnline && !wasOffline)      await openMonitorIncident(asset, siteId)
        else if (isOnline && wasOffline)   await resolveMonitorIncidents(asset)
      }

      for (const [siteId, vendors] of bySite) {
        sitesChecked++
        const { data: assetsData } = await supabase
          .from('site_assets')
          .select('id, mac_address, serial_number, product_name, product_category, status')
          .eq('site_id', siteId)
        const assets = (assetsData ?? []) as Asset[]
        if (assets.length === 0) continue

        // ---- UniFi: match raw devices by MAC ----
        if (vendors.has('unifi')) {
          try {
            const creds = await getSiteUniFiCloud(siteId)
            if (creds) {
              const raw = await listCloudDevices(creds.apiKey, creds.hostId ?? undefined)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const devs: any[] = []
              for (const r of raw) Array.isArray(r?.devices) ? devs.push(...r.devices) : devs.push(r)
              for (const d of devs) {
                const mac = String(d.mac ?? d.macAddress ?? d.hardwareAddress ?? '').toLowerCase()
                if (!mac) continue
                const asset = assets.find(a => (a.mac_address ?? '').toLowerCase() === mac)
                if (!asset) continue
                const isOnline = (d.state ?? d.status) === 'online' || d.state === 1 || d.connected === true
                await applyStatus(asset, siteId, isOnline)
              }
            }
          } catch { errors++ }
        }

        // ---- Eagle Eye: match cameras by ESN, else exact name ----
        if (vendors.has('eagle_eye')) {
          try {
            const { token, baseHost } = await getSiteEagleEyeAccess(siteId)
            const cams = await listEagleEyeCameras(token, baseHost)
            for (const cam of cams) {
              if (cam.online == null) continue // unknown → don't guess
              const esn = String(cam.esn ?? cam.id ?? '').toLowerCase()
              const nm = cam.name.toLowerCase()
              const asset =
                (esn && assets.find(a => (a.serial_number ?? '').toLowerCase() === esn)) ||
                assets.find(a => /camera|nvr|dvr/i.test(`${a.product_category ?? ''} ${a.product_name ?? ''}`) && (a.product_name ?? '').toLowerCase() === nm)
              if (!asset) continue
              await applyStatus(asset, siteId, cam.online)
            }
          } catch { errors++ }
        }
      }

      return { sitesChecked, matched, online, offline, incidentsOpened, incidentsResolved, errors, at: now }
    })
  },
)
