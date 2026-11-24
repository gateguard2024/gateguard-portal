/**
 * Property uptime — the share of the property's SYSTEM-TIME that was working
 * (industry "availability": 1 − device-down-time ÷ (devices × time)). Decided Nov 24 2026.
 *  • A fault takes down the device it's on, not the whole property: one camera out
 *    of 20 for an hour is 1/20 of an hour. Network / power faults take everything down.
 *  • The same device's overlapping faults count once (no double counting).
 *  • Low-severity faults (cosmetic, nothing stopped working) don't count.
 *  • A fault closed without an end time ends at its last update — never "still down".
 *  • Time before the window, or before the property had any devices, isn't counted.
 * Pure function — no database. Used by /api/sites/[id]/command-summary.
 */
export type UptimeIncident = {
  status: string | null; severity?: string | null; category?: string | null; asset_id?: string | null; title?: string | null
  started_at?: string | null; created_at?: string | null; resolved_at?: string | null; updated_at?: string | null
}
export type Units = { camera?: number; gate?: number; door?: number; intercom?: number; network?: number; other?: number }

const OPEN = new Set(['open', 'investigating'])
const SITEWIDE = new Set(['network', 'relay', 'power'])
const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

function merge(iv: [number, number][]): number {
  iv.sort((a, b) => a[0] - b[0]); let total = 0, cs = -1, ce = -1
  for (const [a, b] of iv) { if (a > ce) { if (ce > cs) total += ce - cs; cs = a; ce = b } else if (b > ce) ce = b }
  if (ce > cs) total += ce - cs
  return total
}

export function siteUptime(incidents: UptimeIncident[], units: Units, now: number, windowMs: number): { pct: number; downMs: number; devices: number } {
  const devices = Math.max(1, Object.values(units).reduce<number>((s, n) => s + (Number(n) || 0), 0))
  const from = now - windowMs
  const groups = new Map<string, { weight: number; iv: [number, number][] }>()
  for (const i of incidents) {
    if (String(i.severity ?? '').toLowerCase() === 'low') continue
    const start = Date.parse(String(i.started_at ?? i.created_at ?? ''))
    if (Number.isNaN(start)) continue
    const open = OPEN.has(String(i.status ?? 'open'))
    const endRaw = open ? now : Date.parse(String(i.resolved_at ?? i.updated_at ?? ''))
    if (Number.isNaN(endRaw)) continue
    const a = Math.max(start, from), b = Math.min(endRaw, now)
    if (b <= a) continue
    const cat = norm(i.category)
    const sitewide = SITEWIDE.has(cat)
    const key = sitewide ? 'site' : i.asset_id ? `a:${i.asset_id}` : `${cat || 'other'}:${norm(i.title)}`
    const g = groups.get(key) ?? { weight: sitewide ? devices : 1, iv: [] }
    g.iv.push([a, b]); groups.set(key, g)
  }
  // Sitewide time already covers every device — don't add device faults on top of it.
  const site = groups.get('site')
  const siteIv = site ? [...site.iv] : []
  let deviceDown = 0
  for (const [k, g] of Array.from(groups.entries())) {
    if (k === 'site') { deviceDown += merge([...g.iv]) * devices; continue }
    const own = merge([...g.iv])
    const overlap = siteIv.length ? merge(g.iv.flatMap(([a, b]) => siteIv.map(([c, d]) => [Math.max(a, c), Math.min(b, d)] as [number, number]).filter(([x, y]) => y > x))) : 0
    deviceDown += Math.max(0, own - overlap) * g.weight
  }
  const pct = Math.max(0, Math.min(100, 100 * (1 - deviceDown / (devices * windowMs))))
  const shown = Math.round(pct * 100) / 100
  // Never round real downtime up to a perfect 100%.
  return { pct: deviceDown > 0 && shown >= 100 ? 99.99 : shown, downMs: Math.round(deviceDown / devices), devices }
}
