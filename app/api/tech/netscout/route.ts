/**
 * GET /api/tech/netscout
 *
 * NETSCOUT backend — connectivity probe for field techs.
 * Auth: x-tech-code header.
 *
 * Returns:
 *   - connectivity tests to key GateGuard endpoints
 *   - UniFi connected clients (if org has UniFi credentials configured)
 *   - timestamp
 *
 * Query params:
 *   org_id?   — optional, to pull per-org UniFi credentials
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ProbeResult {
  label:       string
  url:         string
  status:      'ok' | 'slow' | 'fail' | 'unknown'
  latency_ms:  number | null
  http_code?:  number
  error?:      string
}

async function probe(label: string, url: string, timeoutMs = 5000): Promise<ProbeResult> {
  const start = Date.now()
  try {
    const controller = new AbortController()
    const timer      = setTimeout(() => controller.abort(), timeoutMs)
    const res        = await fetch(url, { signal: controller.signal, method: 'HEAD' })
    clearTimeout(timer)
    const latency = Date.now() - start
    return {
      label,
      url,
      status:     latency > 3000 ? 'slow' : 'ok',
      latency_ms: latency,
      http_code:  res.status,
    }
  } catch (err: unknown) {
    const latency = Date.now() - start
    const isTimeout = (err instanceof Error) && err.name === 'AbortError'
    return {
      label,
      url,
      status:     'fail',
      latency_ms: latency,
      error:      isTimeout ? 'Timeout' : (err instanceof Error ? err.message : 'Connection failed'),
    }
  }
}

export async function GET(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const techCode = req.headers.get('x-tech-code')
  if (techCode !== process.env.TECH_ACCESS_CODE) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = req.nextUrl.searchParams.get('org_id')

  // ── Probe core endpoints in parallel ─────────────────────────────────────
  const coreProbes = await Promise.all([
    probe('GateGuard Portal',     'https://portal.gateguard.co'),
    probe('GateGuard API',        'https://portal.gateguard.co/api/health', 3000),
    probe('Brivo API',            'https://auth.brivo.com'),
    probe('Eagle Eye (EEN)',      'https://rest.cameramanager.com'),
    probe('Stripe',               'https://api.stripe.com'),
    probe('Anthropic (AI)',       'https://api.anthropic.com'),
    probe('Supabase',             process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://supabase.io'),
  ])

  // ── UniFi connected clients (per-org, optional) ───────────────────────────
  interface UniFiClientEntry {
    mac:       string
    hostname:  string | null
    name:      string | null
    ip:        string | null
    is_wired:  boolean
    rssi?:     number | null
    oui?:      string | null
    signal?:   number | null
    essid?:    string | null
    uptime?:   number | null
    tx_bytes?: number | null
    rx_bytes?: number | null
  }

  let unifiClients: UniFiClientEntry[] = []
  let unifiError:   string | null      = null

  if (orgId) {
    try {
      const { data: org } = await supabase
        .from('organizations')
        .select('unifi_host, unifi_api_key, unifi_site_id')
        .eq('id', orgId)
        .single()

      if (org?.unifi_host && org?.unifi_api_key) {
        const site   = (org.unifi_site_id as string | null) ?? 'default'
        const apiKey = org.unifi_api_key as string
        const host   = (org.unifi_host as string).replace(/\/$/, '')
        const url    = `https://${host}/proxy/network/api/s/${site}/stat/sta`

        const res = await fetch(url, {
          headers: {
            'X-API-KEY': apiKey,
            'Accept':    'application/json',
          },
        })

        if (res.ok) {
          const json = await res.json() as { data?: UniFiClientEntry[] }
          unifiClients = (json.data ?? []).map((c) => ({
            mac:      c.mac,
            hostname: c.hostname ?? c.name ?? null,
            name:     c.name ?? null,
            ip:       c.ip ?? null,
            is_wired: !!c.is_wired,
            rssi:     (c as unknown as Record<string, unknown>).rssi as number | null ?? null,
            signal:   (c as unknown as Record<string, unknown>).signal as number | null ?? null,
            essid:    (c as unknown as Record<string, unknown>).essid as string | null ?? null,
            oui:      c.oui ?? null,
            uptime:   c.uptime ?? null,
          }))
        } else {
          unifiError = `UniFi API ${res.status}`
        }
      }
    } catch (err) {
      unifiError = err instanceof Error ? err.message : 'UniFi fetch failed'
    }
  }

  return NextResponse.json({
    timestamp:      new Date().toISOString(),
    probes:         coreProbes,
    unifi_clients:  unifiClients,
    unifi_error:    unifiError,
    unifi_count:    unifiClients.length,
  })
}
