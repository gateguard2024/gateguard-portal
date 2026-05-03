/**
 * lib/unifi.ts — GateGuard Portal
 *
 * UniFi Network API client.
 *
 * Auth:
 *   UniFi Network 8.x+ supports API keys (Settings → Control Plane → API → Create API Key)
 *   Header: X-API-KEY: {key}
 *   Base: https://{host}/proxy/network/api
 *
 * Per-org config (from organizations table):
 *   unifi_host           — IP or hostname of the UniFi console (e.g. 10.0.0.1)
 *   unifi_api_key        — API key from UniFi console
 *   unifi_site_id        — site slug (default: "default")
 *   unifi_resident_group — name of the client group for residents (default: "Residents")
 *
 * Key endpoints used:
 *   GET  /s/{site}/stat/sta              — all connected clients
 *   GET  /s/{site}/rest/usergroup        — client groups
 *   POST /s/{site}/rest/usergroup        — create group
 *   PUT  /s/{site}/rest/usergroup/{id}   — update group
 *   GET  /s/{site}/rest/user             — all known clients (incl. offline)
 *   PUT  /s/{site}/rest/user/{id}        — update client (set usergroup_id)
 *   POST /s/{site}/cmd/stamgr            — block/unblock MAC
 */

// ─── Types ────────────────────────────────────────────────────────────────────
export interface UniFiConfig {
  host:          string
  apiKey:        string
  site:          string
  residentGroup: string
}

export interface UniFiClient {
  _id:           string
  mac:           string
  hostname:      string | null
  name:          string | null
  usergroup_id:  string | null
  is_wired:      boolean
  ip:            string | null
  oui:           string | null
}

export interface UniFiGroup {
  _id:         string
  name:        string
  qos_rate_max_down: number
  qos_rate_max_up:   number
}

// ─── Client factory ───────────────────────────────────────────────────────────
export function makeUniFiClient(cfg: UniFiConfig) {
  const base = `https://${cfg.host}/proxy/network/api/s/${cfg.site}`

  const headers: HeadersInit = {
    'X-API-KEY':    cfg.apiKey,
    'Content-Type': 'application/json',
    Accept:         'application/json',
  }

  // UniFi uses self-signed certs on many installs; in Node 18+, we need to
  // skip TLS verification for on-prem controllers. Set UNIFI_TLS_VERIFY=1 to
  // enforce strict cert checking (for cloud-hosted consoles).
  const fetchOpts: RequestInit = process.env.UNIFI_TLS_VERIFY === '1'
    ? {}
    : { // @ts-ignore — Node fetch agent option
      agent: (() => {
        const https = require('https')
        return new https.Agent({ rejectUnauthorized: false })
      })(),
    }

  async function get(path: string): Promise<any> {
    const res = await fetch(`${base}${path}`, { ...fetchOpts, headers })
    if (!res.ok) throw new Error(`UniFi GET ${path} failed (${res.status}): ${await res.text()}`)
    const json = await res.json()
    return json.data ?? json
  }

  async function post(path: string, body: Record<string, any>): Promise<any> {
    const res = await fetch(`${base}${path}`, {
      ...fetchOpts, method: 'POST', headers, body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`UniFi POST ${path} failed (${res.status}): ${await res.text()}`)
    const json = await res.json()
    return json.data ?? json
  }

  async function put(path: string, body: Record<string, any>): Promise<any> {
    const res = await fetch(`${base}${path}`, {
      ...fetchOpts, method: 'PUT', headers, body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`UniFi PUT ${path} failed (${res.status}): ${await res.text()}`)
    const json = await res.json()
    return json.data ?? json
  }

  // ── Group management ────────────────────────────────────────────────────────

  async function listGroups(): Promise<UniFiGroup[]> {
    return get('/rest/usergroup')
  }

  async function findOrCreateGroup(name: string): Promise<UniFiGroup> {
    const groups: UniFiGroup[] = await listGroups()
    const existing = groups.find(g => g.name.toLowerCase() === name.toLowerCase())
    if (existing) return existing

    console.log(`[unifi] Creating client group "${name}"`)
    const created = await post('/rest/usergroup', {
      name,
      qos_rate_max_down: -1,  // -1 = no rate limit
      qos_rate_max_up:   -1,
    })
    // UniFi returns an array on creation
    return Array.isArray(created) ? created[0] : created
  }

  // ── Client (known device) management ───────────────────────────────────────

  async function listKnownClients(): Promise<UniFiClient[]> {
    return get('/rest/user')
  }

  async function listConnectedClients(): Promise<UniFiClient[]> {
    return get('/stat/sta')
  }

  /**
   * Assign a MAC address to a client group.
   * Creates a "known client" record if the MAC has never been seen.
   */
  async function assignToGroup(mac: string, groupId: string, name?: string): Promise<void> {
    const normalMac = mac.toLowerCase()
    const clients: UniFiClient[] = await listKnownClients()
    const existing = clients.find(c => c.mac === normalMac)

    if (existing) {
      if (existing.usergroup_id === groupId) return  // already in group
      await put(`/rest/user/${existing._id}`, {
        usergroup_id: groupId,
        ...(name ? { name } : {}),
      })
      console.log(`[unifi] Assigned ${mac} → group ${groupId}`)
    } else {
      // Create a "fixed" client entry so UniFi remembers it even before connection
      await post('/rest/user', {
        mac:          normalMac,
        usergroup_id: groupId,
        ...(name ? { name } : {}),
        noted: true,
      })
      console.log(`[unifi] Created known client ${mac} → group ${groupId}`)
    }
  }

  /**
   * Remove a MAC from any managed group (set usergroup_id to empty = default).
   */
  async function removeFromGroup(mac: string): Promise<void> {
    const normalMac = mac.toLowerCase()
    const clients: UniFiClient[] = await listKnownClients()
    const existing = clients.find(c => c.mac === normalMac)
    if (!existing || !existing.usergroup_id) return

    await put(`/rest/user/${existing._id}`, { usergroup_id: '' })
    console.log(`[unifi] Removed ${mac} from group`)
  }

  /**
   * Block a client MAC from the network entirely (e.g. after lease violation).
   */
  async function blockClient(mac: string): Promise<void> {
    await post('/cmd/stamgr', { cmd: 'block-sta', mac: mac.toLowerCase() })
    console.log(`[unifi] Blocked ${mac}`)
  }

  /**
   * Unblock a previously blocked client.
   */
  async function unblockClient(mac: string): Promise<void> {
    await post('/cmd/stamgr', { cmd: 'unblock-sta', mac: mac.toLowerCase() })
    console.log(`[unifi] Unblocked ${mac}`)
  }

  return {
    listGroups,
    findOrCreateGroup,
    listKnownClients,
    listConnectedClients,
    assignToGroup,
    removeFromGroup,
    blockClient,
    unblockClient,
  }
}

// ─── Build config from org row ────────────────────────────────────────────────
export function uniFiConfigFromOrg(org: {
  unifi_host?:           string | null
  unifi_api_key?:        string | null
  unifi_site_id?:        string | null
  unifi_resident_group?: string | null
}): UniFiConfig | null {
  if (!org.unifi_host || !org.unifi_api_key) return null
  return {
    host:          org.unifi_host,
    apiKey:        org.unifi_api_key,
    site:          org.unifi_site_id          ?? 'default',
    residentGroup: org.unifi_resident_group   ?? 'Residents',
  }
}
