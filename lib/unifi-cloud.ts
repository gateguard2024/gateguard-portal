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

export interface UniFiDevice { name: string; model: string | null; type: string | null; ip: string | null; version: string | null; uptime_s: number | null; clients: number | null; online: boolean }
export interface UniFiOverview {
  connected: boolean
  site: { id: string | null; name: string | null }
  console: { name: string | null; model: string | null; public_ip: string | null; version: string | null; uptime_s: number | null } | null
  internet: { isp: string | null; status: 'up' | 'down' | 'unknown'; public_ip: string | null; download_mbps: number | null; upload_mbps: number | null; latency_ms: number | null; packet_loss_pct: number | null; uptime_pct: number | null; trend: number[] }
  clients: { wifi: number; wired: number; guest: number; total: number }
  devices: UniFiDevice[]
  health: { total: number; online: number; offline: number }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function num(...vals: any[]): number | null { for (const v of vals) if (typeof v === 'number' && !isNaN(v)) return v; return null }

/** One-call overview for a property's internet controller (defensive field reads). */
export async function getSiteUniFiOverview(siteId: string): Promise<UniFiOverview> {
  const creds = await getSiteUniFiCloud(siteId)
  const empty: UniFiOverview = {
    connected: false, site: { id: null, name: null }, console: null,
    internet: { isp: null, status: 'unknown', public_ip: null, download_mbps: null, upload_mbps: null, latency_ms: null, packet_loss_pct: null, uptime_pct: null, trend: [] },
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

  // ── Console / gateway info (from /v1/hosts) ─────────────────────────────────
  let consoleInfo: UniFiOverview['console'] = null
  let publicIp: string | null = null
  let ispFromHost: string | null = null
  try {
    const hosts = await listCloudHosts(creds.apiKey)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const h = (hostId ? hosts.find((x: any) => (x.id ?? x.hostId) === hostId) : hosts[0]) ?? hosts[0]
    const rs = h?.reportedState ?? h?.reported_state ?? h ?? {}
    publicIp = rs.ip ?? rs.wan?.ip ?? rs.internet?.ip ?? rs.ipAddress ?? null
    ispFromHost = rs.isp ?? rs.wan?.isp ?? rs.internet?.isp ?? null
    consoleInfo = {
      name: rs.hostname ?? rs.name ?? h?.hostname ?? null,
      model: rs.hardware?.shortname ?? rs.hardware?.name ?? rs.model ?? h?.hardwareId ?? null,
      public_ip: publicIp,
      version: rs.version ?? rs.firmwareVersion ?? rs.controllerVersion ?? null,
      uptime_s: num(rs.uptime, rs.controllerUptime),
    }
  } catch { /* host detail optional */ }

  // ── Devices + health ────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let devs: any[] = []
  try {
    const raw = await listCloudDevices(creds.apiKey, hostId ?? undefined)
    for (const r of raw) Array.isArray(r?.devices) ? devs.push(...r.devices) : devs.push(r)
  } catch { /* ignore */ }
  // Only this property's devices: a console can host several sites, so keep devices
  // that declare our siteId (or carry no site tag, i.e. single-site console).
  if (creds.siteId) devs = devs.filter(d => { const sid = d.siteId ?? d.site_id ?? d.site; return !sid || sid === creds.siteId })
  const devices: UniFiDevice[] = devs.map(d => ({
    name: d.name ?? d.model ?? 'Device', model: d.model ?? d.shortname ?? null,
    type: d.type ?? d.shortname ?? null,
    ip: d.ip ?? d.lanIp ?? d.ipAddress ?? null,
    version: d.version ?? d.firmwareVersion ?? null,
    uptime_s: num(d.uptime, d.uptimeSec),
    clients: num(d.numSta, d.num_client, d.clientCount, d.connectedClients),
    online: (d.state ?? d.status) === 'online' || d.state === 1 || d.connected === true,
  }))
  const online = devices.filter(d => d.online).length

  // ── Internet / WAN: prefer ISP metrics; fall back to gateway online ──────────
  let download_mbps: number | null = null, upload_mbps: number | null = null, latency_ms: number | null = null, packet_loss_pct: number | null = null, uptime_pct: number | null = null
  let trend: number[] = []
  let isp: string | null = site?.ispInfo?.name ?? stats.ispName ?? ispFromHost
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dlOf = (d: any) => num(d?.download_kbps != null ? d.download_kbps / 1000 : null, d?.wan?.download_mbps, d?.downloadMbps, d?.download_mbps)
  try {
    const m = await ispMetrics(creds.apiKey)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = Array.isArray(m) ? m : (m?.metrics ?? m?.sites ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mine = rows.find((r: any) => (r.siteId ?? r.site_id) === (creds.siteId ?? site?.siteId)) ?? rows[0]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const periods: any[] = mine?.periods ?? mine?.data ?? []
    trend = periods.map(pp => dlOf(pp?.data ?? pp)).filter((x): x is number => x != null)
    const p = periods.length ? (periods[periods.length - 1]?.data ?? periods[periods.length - 1]) : (mine?.data ?? mine)
    download_mbps = dlOf(p)
    upload_mbps = num(p?.upload_kbps != null ? p.upload_kbps / 1000 : null, p?.wan?.upload_mbps, p?.uploadMbps, p?.upload_mbps)
    latency_ms = num(p?.latency_avg_ms, p?.wan?.latency_ms, p?.latencyMs, p?.avgLatency)
    packet_loss_pct = num(p?.packetLoss, p?.wan?.packet_loss_pct, p?.packet_loss)
    uptime_pct = num(p?.uptime, p?.wan?.uptime_pct, p?.uptimePercentage)
    isp = isp ?? p?.isp_name ?? mine?.ispName ?? null
  } catch { /* metrics optional */ }

  const gatewayOnline = devices.some(d => /gateway|udm|usg|uxg|ugw|console/i.test(`${d.type ?? ''}${d.model ?? ''}`) && d.online)
  const status: 'up' | 'down' | 'unknown' =
    (download_mbps != null || uptime_pct != null) ? ((uptime_pct ?? 1) > 0 ? 'up' : 'down')
    : devices.length || consoleInfo ? (gatewayOnline || consoleInfo ? 'up' : 'down')
    : 'unknown'

  return {
    connected: true,
    site: { id: site?.siteId ?? creds.siteId ?? null, name: site?.meta?.name ?? site?.name ?? null },
    console: consoleInfo,
    internet: { isp, status, public_ip: publicIp, download_mbps, upload_mbps, latency_ms, packet_loss_pct, uptime_pct, trend },
    clients: { wifi, wired, guest, total },
    devices, health: { total: devices.length, online, offline: devices.length - online },
  }
}
