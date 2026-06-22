/**
 * lib/shelly.ts — SERVER ONLY. Shelly Cloud control for a site's relays.
 * Per-site creds: { auth_key, server } in the vault. Endpoints (Shelly Cloud):
 *   list:    POST https://<server>/interface/device/list   (auth_key)
 *   control: POST https://<server>/device/relay/control     (id, channel, turn)
 * If a Shelly plan differs, list/control are the two spots to adjust.
 */
import { getSiteVendorCreds } from '@/lib/site-integrations'

export interface ShellyRelay { id: string; name: string; channel: number; on: boolean | null }

async function creds(siteId: string) {
  const c = await getSiteVendorCreds(siteId, 'shelly')
  if (!c?.auth_key || !c?.server) throw new Error('Shelly auth key + server are not set for this site.')
  return { authKey: c.auth_key, server: c.server.replace(/^https?:\/\//, '').replace(/\/$/, '') }
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

/** List relays across the site's Shelly devices. */
export async function listSiteShellyRelays(siteId: string): Promise<ShellyRelay[]> {
  const { authKey, server } = await creds(siteId)
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
    const name = (dev?.name as string) || `Shelly ${id.slice(-4)}`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const relays = (status[id] as any)?.relays as any[] | undefined
    if (Array.isArray(relays) && relays.length) {
      relays.forEach((r, i) => out.push({ id, name: relays.length > 1 ? `${name} · CH${i + 1}` : name, channel: i, on: typeof r?.ison === 'boolean' ? r.ison : null }))
    } else {
      out.push({ id, name, channel: 0, on: null })
    }
  }
  return out
}

/** Turn a relay on or off. */
export async function controlSiteShellyRelay(siteId: string, deviceId: string, channel: number, on: boolean): Promise<void> {
  const { authKey, server } = await creds(siteId)
  await shellyPost(server, '/device/relay/control', { id: deviceId, channel: String(channel), turn: on ? 'on' : 'off', auth_key: authKey })
}
