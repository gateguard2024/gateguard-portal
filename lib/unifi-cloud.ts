/**
 * lib/unifi-cloud.ts — SERVER ONLY. UniFi **Site Manager Cloud API** (api.ui.com).
 *
 * Reaches every UniFi console adopted to your Ubiquiti account through Ubiquiti's
 * cloud — no public IP / port-forwarding on the property. One account API key.
 *
 * Auth:  header  X-API-KEY: <key>   (key from unifi.ui.com → Settings → API → Create)
 * Base:  https://api.ui.com
 * Endpoints used:
 *   GET /v1/hosts                  — consoles on the account
 *   GET /v1/sites                  — sites (with statistics: client/device counts, ISP)
 *   GET /v1/devices?hostIds[]=<id> — device inventory + online state
 *   GET /v1/isp-metrics/1h         — WAN throughput / latency / uptime
 *
 * Per-property creds in the vault (vendor 'unifi'):
 *   cloud_api_key (secret) · cloud_site_id (the api.ui.com siteId) · cloud_host_id (optional)
 * The api key may also come from env UNIFI_SITE_MANAGER_KEY (one account → many sites).
 */
import { getSiteVendorCreds } from '@/lib/site-integrations'

const BASE = 'https://api.ui.com'

async function uiGet(apiKey: string, path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'X-API-KEY': apiKey, Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) throw new Error(`UniFi cloud ${path} (${res.status}): ${(await res.text()).slice(0, 160)}`)
  return res.json()
}
// Responses are typically { data: [...] } or { data: { ... } }.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function data(j: any): any { return j?.data ?? j }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function listCloudHosts(apiKey: string): Promise<any[]> { const d = data(await uiGet(apiKey, '/v1/hosts')); return Array.isArray(d) ? d : [] }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function listCloudSites(apiKey: string): Promise<any[]> { const d = data(await uiGet(apiKey, '/v1/sites')); return Array.isArray(d) ? d : [] }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function listCloudDevices(apiKey: string, hostId?: string): Promise<any[]> {
  const d = data(await uiGet(apiKey, `/v1/devices${hostId ? `?hostIds[]=${encodeURIComponent(hostId)}` : ''}`))
  return Array.isArray(d) ? d : []
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ispMetrics(apiKey: string): Promise<any> { try { return data(await uiGet(apiKey, '/v1/isp-metrics/1h')) } catch { return null } }

export interface UniFiCloudCreds { apiKey: string; siteId: string | null; hostId: string | null }

export async function getSiteUniFiCloud(siteId: string): Promise<UniFiCloudCreds | null> {
  const c = await getSiteVendorCreds(siteId, 'unifi')
  const apiKey = c?.cloud_api_key || process.env.UNIFI_SITE_MANAGER_KEY
  if (!apiKey) return null
  return { apiKey, siteId: c?.cloud_site_id || null, hostId: c?.cloud_host_id || null }
}

export interface UniFiOverview {
  connected: boolean
  site: { id: string | null; name: string | null }
  internet: { isp: string | null; status: 'up' | 'down' | 'unknown'; download_mbps: number | null; upload_mbps: number | null; latency_ms: number | null; uptime_pct: number | null }
  clients: { wifi: number; wired: number; guest: number; total: number }
  devices: Array<{ name: string; model: string | null; type: string | null; online: boolean }>
  health: { total: number; online: number; offline: number }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function num(...vals: any[]): number | null { for (const v of vals) if (typeof v === 'number' && !isNaN(v)) return v; return null }

/** One-call overview for a property's internet controller (defensive field reads). */
export async function getSiteUniFiOverview(siteId: string): Promise<UniFiOverview> {
  const creds = await getSiteUniFiCloud(siteId)
  const empty: UniFiOverview = {
    connected: false, site: { id: null, name: null },
    internet: { isp: null, status: 'unknown', download_mbps: null, upload_mbps: null, latency_ms: null, uptime_pct: null },
    clients: { wifi: 0, wired: 0, guest: 0, total: 0 }, devices: [], health: { total: 0, online: 0, offline: 0 },
  }
  if (!creds) return empty

  const sites = await listCloudSites(creds.apiKey)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const site = creds.siteId ? sites.find((s: any) => (s.siteId ?? s.id) === creds.siteId) : sites[0]
  const hostId = creds.hostId ?? site?.hostId ?? null
  const stats = site?.statistics ?? {}
  const counts = stats.counts ?? {}

  const wifi = num(counts.wifiClient, counts.wirelessClient) ?? 0
  const wired = num(counts.wiredClient) ?? 0
  const guest = num(counts.guestClient) ?? 0
  const total = num(counts.totalClient) ?? (wifi + wired + guest)

  // Devices + health
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let devs: any[] = []
  try {
    const raw = await listCloudDevices(creds.apiKey, hostId ?? undefined)
    // device list may be grouped by host: [{ hostId, devices: [...] }] OR flat [...]
    for (const r of raw) Array.isArray(r?.devices) ? devs.push(...r.devices) : devs.push(r)
  } catch { /* ignore */ }
  const devices = devs.map(d => ({
    name: d.name ?? d.model ?? 'Device', model: d.model ?? null,
    type: d.type ?? d.shortname ?? null,
    online: (d.state ?? d.status) === 'online' || d.state === 1 || d.connected === true,
  }))
  const online = devices.filter(d => d.online).length

  // Internet status: prefer ISP metrics; fall back to gateway online + counts.
  let download_mbps: number | null = null, upload_mbps: number | null = null, latency_ms: number | null = null, uptime_pct: number | null = null
  let isp: string | null = site?.ispInfo?.name ?? stats.ispName ?? null
  try {
    const m = await ispMetrics(creds.apiKey)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = Array.isArray(m) ? m : (m?.metrics ?? m?.sites ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mine = rows.find((r: any) => (r.siteId ?? r.site_id) === (creds.siteId ?? site?.siteId)) ?? rows[0]
    const p = mine?.periods?.[mine.periods.length - 1]?.data ?? mine?.data ?? mine
    download_mbps = num(p?.download_kbps && p.download_kbps / 1000, p?.wan?.download_mbps, p?.downloadMbps)
    upload_mbps = num(p?.upload_kbps && p.upload_kbps / 1000, p?.wan?.upload_mbps, p?.uploadMbps)
    latency_ms = num(p?.latency_avg_ms, p?.wan?.latency_ms, p?.latencyMs)
    uptime_pct = num(p?.uptime, p?.wan?.uptime_pct)
    isp = isp ?? p?.isp_name ?? mine?.ispName ?? null
  } catch { /* metrics optional */ }

  const gatewayOnline = devices.some(d => /gateway|udm|usg|uxg|ugw/i.test(`${d.type ?? ''}${d.model ?? ''}`) && d.online)
  const status: 'up' | 'down' | 'unknown' =
    (download_mbps != null || uptime_pct != null) ? ((uptime_pct ?? 1) > 0 ? 'up' : 'down')
    : devices.length ? (gatewayOnline ? 'up' : 'down')
    : 'unknown'

  return {
    connected: true,
    site: { id: site?.siteId ?? creds.siteId ?? null, name: site?.meta?.name ?? site?.name ?? null },
    internet: { isp, status, download_mbps, upload_mbps, latency_ms, uptime_pct },
    clients: { wifi, wired, guest, total },
    devices, health: { total: devices.length, online, offline: devices.length - online },
  }
}
