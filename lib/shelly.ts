/**
 * lib/shelly.ts — SERVER ONLY. Shelly Cloud control for a site's relays.
 * Per-site creds: { auth_key, server, device_tag? } in the vault. Endpoints (Shelly Cloud):
 *   list:    POST https://<server>/interface/device/list   (auth_key)
 *   status:  POST https://<server>/device/all_status        (auth_key)
 *   control: POST https://<server>/device/relay/control     (id, channel, turn)
 *
 * One Shelly Cloud account can hold devices for MANY properties. We tell them apart
 * by the property tag in each device's name (e.g. "Elevate Greene - Front Gate").
 * `device_tag` defaults to the site's name; only devices whose name contains the tag
 * show up for that site, and the rest of the name becomes the area label.
 */
import { getSiteVendorCreds } from '@/lib/site-integrations'
import { createClient } from '@supabase/supabase-js'

export interface ShellyRelay { id: string; name: string; channel: number; on: boolean | null }

async function creds(siteId: string) {
  const c = await getSiteVendorCreds(siteId, 'shelly')
  if (!c?.auth_key || !c?.server) throw new Error('Shelly auth key + server are not set for this site.')
  return { authKey: c.auth_key, server: c.server.replace(/^https?:\/\//, '').replace(/\/$/, ''), deviceTag: (c.device_tag || '').trim() }
}

async function siteName(siteId: string): Promise<string> {
  try {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data } = await db.from('sites').select('name').eq('id', siteId).maybeSingle()
    return (data?.name as string) || ''
  } catch { return '' }
}

// Does this device belong to the property? (tag found anywhere in the name, case-insensitive)
function matchesTag(name: string, tag: string): boolean {
  return !tag || name.toLowerCase().includes(tag.toLowerCase())
}
// Strip the property tag + surrounding separators → the area name.
function areaLabel(name: string, tag: string): string {
  if (!tag) return name
  const i = name.toLowerCase().indexOf(tag.toLowerCase())
  const rest = (i >= 0 ? name.slice(0, i) + name.slice(i + tag.length) : name)
    .replace(/^[\s\-_/:·|]+|[\s\-_/:·|]+$/g, '').trim()
  return rest || name
}

async function shellyPost(server: string, path: string, body: Record<string, string>) {
  const res = await fetch(`https://${server}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(), signal: AbortSignal.timeout(9000),
  })
  if (!res.ok) throw new Error(`Shelly ${path} (${res.status})`)
  const j = await res.json()
  if (j?.isok === false) throw new Error('Shelly rejected the request (check auth key / server).')
  return j
}

/** List relays for THIS property's Shelly devices (filtered out of the shared account). */
export async function listSiteShellyRelays(siteId: string): Promise<ShellyRelay[]> {
  const { authKey, server, deviceTag } = await creds(siteId)
  const tag = deviceTag || await siteName(siteId)   // default the property tag to the site name

  const list = await shellyPost(server, '/interface/device/list', { auth_key: authKey })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const devices = (list?.data?.devices ?? {}) as Record<string, any>
  let status: Record<string, unknown> = {}
  try {
    const st = await shellyPost(server, '/device/all_status', { auth_key: authKey })
    status = (st?.data?.devices_status ?? {}) as Record<string, unknown>
  } catch { /* status optional */ }

  const out: ShellyRelay[] = []
  for (const [id, dev] of Object.entries(devices)) {
    const fullName = (dev?.name as string) || `Shelly ${id.slice(-4)}`
    if (!matchesTag(fullName, tag)) continue            // not this property's device
    const label = areaLabel(fullName, tag)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const relays = (status[id] as any)?.relays as any[] | undefined
    if (Array.isArray(relays) && relays.length) {
      relays.forEach((r, i) => out.push({ id, name: relays.length > 1 ? `${label} · CH${i + 1}` : label, channel: i, on: typeof r?.ison === 'boolean' ? r.ison : null }))
    } else {
      out.push({ id, name: label, channel: 0, on: null })
    }
  }
  return out
}

/** Turn a relay on or off. */
export async function controlSiteShellyRelay(siteId: string, deviceId: string, channel: number, on: boolean): Promise<void> {
  const { authKey, server } = await creds(siteId)
  await shellyPost(server, '/device/relay/control', { id: deviceId, channel: String(channel), turn: on ? 'on' : 'off', auth_key: authKey })
}
