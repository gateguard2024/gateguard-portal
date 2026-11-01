/**
 * lib/unifi-net.ts — SERVER ONLY. The property's UniFi console, through Ubiquiti's
 * cloud — no open port at the property.
 *
 *  1. Site Manager API (api.ui.com, same account key as lib/unifi-cloud.ts):
 *       GET /v1/isp-metrics/{5m|1h}?duration=24h|7d|30d   — internet history
 *  2. Cloud connector → the console's local **Network Integration API**:
 *       /v1/connector/consoles/{hostId}/proxy/network/integration/v1/...
 *     (console firmware 5.0.3+, an owner or organization API key; 100 req/min per
 *     console, 25 s timeout). Ubiquiti's docs show the prefix both with and
 *     without "/proxy" — we try both and remember which one the console answers.
 *       GET  /v1/sites                                         — find this property's site
 *       GET  /v1/sites/{s}/devices[/{id}[/statistics/latest]]  — gear, ports, radios, CPU…
 *       POST /v1/sites/{s}/devices/{id}/actions                {"action":"RESTART"}
 *       POST /v1/sites/{s}/devices/{id}/interfaces/ports/{i}/actions {"action":"POWER_CYCLE"}
 *       GET  /v1/sites/{s}/clients                             — who's connected
 *       GET/POST/DELETE /v1/sites/{s}/hotspot/vouchers         — guest Wi-Fi codes
 */
import { getSiteUniFiCloud, listCloudSites } from '@/lib/unifi-cloud'

const BASE = 'https://api.ui.com'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

export interface NetCtx { apiKey: string; hostId: string; cloudSiteId: string | null; siteName: string | null }

/** The console + site for a property, or a plain-English reason it can't be reached. */
export async function getNetCtx(siteId: string): Promise<{ ok: true; ctx: NetCtx } | { ok: false; error: string }> {
  const creds = await getSiteUniFiCloud(siteId)
  if (!creds) return { ok: false, error: 'UniFi isn’t connected for this property.' }
  let hostId = creds.hostId
  let siteName: string | null = null
  try {
    const sites = await listCloudSites(creds.apiKey)
    const s = creds.siteId ? sites.find((x: Any) => (x.siteId ?? x.id) === creds.siteId) : sites[0]
    hostId = hostId ?? s?.hostId ?? null
    siteName = s?.meta?.name ?? s?.name ?? null
  } catch (e) { if (!hostId) return { ok: false, error: e instanceof Error ? e.message : 'UniFi cloud unreachable.' } }
  if (!hostId) return { ok: false, error: 'Couldn’t find this property’s UniFi console on the account.' }
  return { ok: true, ctx: { apiKey: creds.apiKey, hostId, cloudSiteId: creds.siteId, siteName } }
}

// ── Cloud connector ──────────────────────────────────────────────────────────
const PREFIXES = ['/proxy/network/integration', '/network/integration']
const prefixFor = new Map<string, string>()

export class NetError extends Error { status: number; constructor(m: string, s: number) { super(m); this.status = s } }

function explain(status: number, body: string): string {
  if (status === 401 || status === 403) return 'UniFi refused the request — the API key must belong to the console’s owner or organization.'
  if (status === 404) return 'This console doesn’t offer remote control yet (needs UniFi OS 5.0.3+ and Network 9+).'
  if (status === 408) return 'The console took too long to answer (it may be offline or busy).'
  if (status === 429) return 'Too many requests to this console — wait a minute and try again.'
  if (status === 502) return 'The console is offline or not connected to the UniFi cloud.'
  return `UniFi returned ${status}${body ? `: ${body.slice(0, 160)}` : ''}`
}

async function call(ctx: NetCtx, method: string, path: string, body?: unknown): Promise<Any> {
  const tryPrefix = async (prefix: string) => fetch(`${BASE}/v1/connector/consoles/${encodeURIComponent(ctx.hostId)}${prefix}${path}`, {
    method,
    headers: { 'X-API-KEY': ctx.apiKey, Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(26_000),
    cache: 'no-store',
  })
  const known = prefixFor.get(ctx.hostId)
  let res: Response | null = null
  for (const p of known ? [known] : PREFIXES) {
    try { res = await tryPrefix(p) } catch (e) { throw new NetError(/timeout|abort/i.test(String(e)) ? explain(408, '') : `Couldn’t reach UniFi: ${e instanceof Error ? e.message : e}`, 504) }
    if (res.status !== 404 || known) { if (res.ok) prefixFor.set(ctx.hostId, p); break }
  }
  if (!res) throw new NetError('Couldn’t reach UniFi.', 504)
  const text = await res.text()
  if (!res.ok) throw new NetError(explain(res.status, text), res.status)
  if (!text) return null
  try { return JSON.parse(text) } catch { return text }
}

// ── Which Network-app site is this property? (cached 10 min) ─────────────────
const siteCache = new Map<string, { id: string; at: number }>()
async function netSite(ctx: NetCtx): Promise<string> {
  const k = `${ctx.hostId}:${ctx.cloudSiteId ?? ''}`
  const c = siteCache.get(k)
  if (c && Date.now() - c.at < 600_000) return c.id
  const j = await call(ctx, 'GET', '/v1/sites?limit=200')
  const list: Any[] = j?.data ?? []
  if (!list.length) throw new NetError('The console reports no Network sites.', 404)
  const norm = (s: unknown) => String(s ?? '').trim().toLowerCase()
  const pick = list.length === 1 ? list[0]
    : list.find(s => ctx.siteName && (norm(s.name) === norm(ctx.siteName) || norm(s.internalReference) === norm(ctx.siteName)))
      ?? list.find(s => norm(s.internalReference) === 'default') ?? list[0]
  siteCache.set(k, { id: pick.id, at: Date.now() })
  return pick.id
}

async function pageAll(ctx: NetCtx, path: string, max = 1000): Promise<Any[]> {
  const out: Any[] = []
  for (let offset = 0; offset < max; offset += 200) {
    const j = await call(ctx, 'GET', `${path}${path.includes('?') ? '&' : '?'}offset=${offset}&limit=200`)
    const rows: Any[] = j?.data ?? []
    out.push(...rows)
    if (rows.length < 200 || (j?.totalCount != null && out.length >= j.totalCount)) break
  }
  return out
}

// ── Devices ──────────────────────────────────────────────────────────────────
export interface NetDevice {
  id: string; name: string; model: string | null; mac: string | null; ip: string | null
  state: string; online: boolean; firmware: string | null; updatable: boolean
  kind: 'gateway' | 'switch' | 'ap' | 'other'; ports: number; radios: number
}
const kindOf = (d: Any): NetDevice['kind'] => {
  const f: string[] = (Array.isArray(d.features) ? d.features : Object.keys(d.features ?? {})).map((x: Any) => String(x).toLowerCase())
  if (f.some(x => x.includes('gateway'))) return 'gateway'
  if (f.some(x => x.includes('accesspoint') || x.includes('access_point'))) return 'ap'
  if (f.some(x => x.includes('switching'))) return 'switch'
  return 'other'
}
function toDevice(d: Any): NetDevice {
  const state = String(d.state ?? 'UNKNOWN').toUpperCase()
  return {
    id: String(d.id), name: d.name || d.model || 'Device', model: d.model ?? null, mac: d.macAddress ?? null, ip: d.ipAddress ?? null,
    state, online: state === 'ONLINE', firmware: d.firmwareVersion ?? null, updatable: !!d.firmwareUpdatable, kind: kindOf(d),
    ports: Array.isArray(d.interfaces?.ports) ? d.interfaces.ports.length : 0,
    radios: Array.isArray(d.interfaces?.radios) ? d.interfaces.radios.length : 0,
  }
}
export async function listNetDevices(ctx: NetCtx): Promise<NetDevice[]> {
  const s = await netSite(ctx)
  return (await pageAll(ctx, `/v1/sites/${s}/devices`)).map(toDevice)
}

export interface NetPort { idx: number; state: string; up: boolean; speedMbps: number | null; maxSpeedMbps: number | null; connector: string | null; poe: { enabled: boolean; state: string | null; standard: string | null } | null }
export interface NetRadio { band: string; channel: number | null; widthMHz: number | null; standard: string | null; retriesPct: number | null }
export interface NetDeviceDetail extends NetDevice {
  adoptedAt: string | null; uplinkDeviceId: string | null
  ports: number; portList: NetPort[]; radioList: NetRadio[]
  stats: { uptimeSec: number | null; cpuPct: number | null; memPct: number | null; load1: number | null; load5: number | null; load15: number | null; txBps: number | null; rxBps: number | null; lastHeartbeatAt: string | null } | null
}
const n = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : null)

export async function getNetDevice(ctx: NetCtx, id: string): Promise<NetDeviceDetail> {
  const s = await netSite(ctx)
  const [d, st] = await Promise.all([
    call(ctx, 'GET', `/v1/sites/${s}/devices/${encodeURIComponent(id)}`),
    call(ctx, 'GET', `/v1/sites/${s}/devices/${encodeURIComponent(id)}/statistics/latest`).catch(() => null),
  ])
  const base = toDevice(d)
  const radiosStats: Any[] = st?.interfaces?.radios ?? []
  const portList: NetPort[] = (d?.interfaces?.ports ?? []).map((p: Any) => ({
    idx: Number(p.idx), state: String(p.state ?? 'UNKNOWN').toUpperCase(), up: String(p.state ?? '').toUpperCase() === 'UP',
    speedMbps: n(p.speedMbps), maxSpeedMbps: n(p.maxSpeedMbps), connector: p.connector ?? null,
    poe: p.poe ? { enabled: !!p.poe.enabled, state: p.poe.state ?? null, standard: p.poe.standard ?? null } : null,
  })).sort((a: NetPort, b: NetPort) => a.idx - b.idx)
  const radioList: NetRadio[] = (d?.interfaces?.radios ?? []).map((r: Any) => {
    const ghz = n(r.frequencyGHz)
    const stat = radiosStats.find(x => n(x.frequencyGHz) === ghz)
    return { band: ghz ? `${ghz} GHz` : 'Radio', channel: n(r.channel), widthMHz: n(r.channelWidthMHz), standard: r.wlanStandard ?? null, retriesPct: n(stat?.txRetriesPct) }
  })
  return {
    ...base, ports: portList.length, radios: radioList.length, portList, radioList,
    adoptedAt: d?.adoptedAt ?? null, uplinkDeviceId: d?.uplink?.deviceId ?? null,
    stats: st ? {
      uptimeSec: n(st.uptimeSec), cpuPct: n(st.cpuUtilizationPct), memPct: n(st.memoryUtilizationPct),
      load1: n(st.loadAverage1Min), load5: n(st.loadAverage5Min), load15: n(st.loadAverage15Min),
      txBps: n(st.uplink?.txRateBps), rxBps: n(st.uplink?.rxRateBps), lastHeartbeatAt: st.lastHeartbeatAt ?? null,
    } : null,
  }
}

export async function restartDevice(ctx: NetCtx, id: string): Promise<void> {
  const s = await netSite(ctx)
  await call(ctx, 'POST', `/v1/sites/${s}/devices/${encodeURIComponent(id)}/actions`, { action: 'RESTART' })
}
export async function powerCyclePort(ctx: NetCtx, id: string, port: number): Promise<void> {
  const s = await netSite(ctx)
  await call(ctx, 'POST', `/v1/sites/${s}/devices/${encodeURIComponent(id)}/interfaces/ports/${port}/actions`, { action: 'POWER_CYCLE' })
}

// ── Clients ──────────────────────────────────────────────────────────────────
export interface NetClient { id: string; name: string; type: string; ip: string | null; mac: string | null; connectedAt: string | null; uplinkDeviceId: string | null; guest: boolean }
export async function listNetClients(ctx: NetCtx): Promise<NetClient[]> {
  const s = await netSite(ctx)
  return (await pageAll(ctx, `/v1/sites/${s}/clients`, 2000)).map((c: Any) => ({
    id: String(c.id), name: c.name || c.macAddress || c.ipAddress || 'Device', type: String(c.type ?? 'UNKNOWN').toUpperCase(),
    ip: c.ipAddress ?? null, mac: c.macAddress ?? null, connectedAt: c.connectedAt ?? null, uplinkDeviceId: c.uplinkDeviceId ?? null,
    guest: /GUEST/i.test(String(c.access?.type ?? '')),
  }))
}

// ── Guest Wi-Fi vouchers ─────────────────────────────────────────────────────
export interface NetVoucher { id: string; code: string; name: string | null; createdAt: string | null; activatedAt: string | null; expiresAt: string | null; expired: boolean; minutes: number | null; guestLimit: number | null; guestsUsed: number }
const toVoucher = (v: Any): NetVoucher => ({
  id: String(v.id), code: String(v.code ?? ''), name: v.name ?? null, createdAt: v.createdAt ?? null, activatedAt: v.activatedAt ?? null,
  expiresAt: v.expiresAt ?? null, expired: !!v.expired, minutes: n(v.timeLimitMinutes), guestLimit: n(v.authorizedGuestLimit), guestsUsed: n(v.authorizedGuestCount) ?? 0,
})
export async function listVouchers(ctx: NetCtx): Promise<NetVoucher[]> {
  const s = await netSite(ctx)
  return (await pageAll(ctx, `/v1/sites/${s}/hotspot/vouchers`, 1000)).map(toVoucher)
}
export async function createVouchers(ctx: NetCtx, v: { count: number; name: string; minutes: number; guestLimit?: number | null; dataMB?: number | null }): Promise<NetVoucher[]> {
  const s = await netSite(ctx)
  const body: Record<string, unknown> = { count: v.count, name: v.name, timeLimitMinutes: v.minutes }
  if (v.guestLimit) body.authorizedGuestLimit = v.guestLimit
  if (v.dataMB) body.dataUsageLimitMBytes = v.dataMB
  const j = await call(ctx, 'POST', `/v1/sites/${s}/hotspot/vouchers`, body)
  return ((j?.vouchers ?? j?.data ?? []) as Any[]).map(toVoucher)
}
export async function deleteVoucher(ctx: NetCtx, id: string): Promise<void> {
  const s = await netSite(ctx)
  await call(ctx, 'DELETE', `/v1/sites/${s}/hotspot/vouchers/${encodeURIComponent(id)}`)
}

// ── Internet history (Site Manager ISP metrics) ──────────────────────────────
export interface IspPoint { t: string; down: number | null; up: number | null; latency: number | null; maxLatency: number | null; loss: number | null; uptime: number | null; downtime: number | null }
export async function ispHistory(siteId: string, range: '24h' | '7d' | '30d'): Promise<{ isp: string | null; points: IspPoint[] }> {
  const creds = await getSiteUniFiCloud(siteId)
  if (!creds) throw new NetError('UniFi isn’t connected for this property.', 400)
  const type = range === '24h' ? '5m' : '1h'
  const res = await fetch(`${BASE}/v1/isp-metrics/${type}?duration=${range}`, { headers: { 'X-API-KEY': creds.apiKey, Accept: 'application/json' }, signal: AbortSignal.timeout(15_000), cache: 'no-store' })
  if (!res.ok) throw new NetError(explain(res.status, await res.text().catch(() => '')), res.status)
  const j = await res.json()
  const metrics: Any[] = Array.isArray(j?.data) ? j.data : (j?.data?.metrics ?? j?.metrics ?? [])
  const mine = (creds.siteId ? metrics.find(m => m.siteId === creds.siteId) : null) ?? metrics[0]
  let isp: string | null = null
  const points: IspPoint[] = ((mine?.periods ?? []) as Any[]).map(p => {
    const w = p?.data?.wan ?? p?.data ?? {}
    isp = isp ?? w.ispName ?? null
    return {
      t: p.metricTime, down: w.download_kbps != null ? w.download_kbps / 1000 : null, up: w.upload_kbps != null ? w.upload_kbps / 1000 : null,
      latency: n(w.avgLatency), maxLatency: n(w.maxLatency), loss: n(w.packetLoss), uptime: n(w.uptime), downtime: n(w.downtime),
    }
  }).filter(p => p.t).sort((a, b) => a.t.localeCompare(b.t))
  return { isp, points }
}
