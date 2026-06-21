/**
 * /api/sites/[id]/integrations — per-site vendor credentials (Brivo, Eagle Eye,
 * Shelly, UniFi). GET returns STATUS ONLY (never secrets). PUT saves encrypted
 * credentials. POST { action: 'test' } verifies connectivity.
 * Admin/corporate within the site's org scope only.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'
import { normalizeRole } from '@/lib/permissions'
import { credsKeyConfigured } from '@/lib/crypto-creds'
import { SITE_VENDORS, type SiteVendor, listSiteIntegrationStatus, setSiteVendorCreds, deleteSiteVendorCreds, markIntegrationTest, getSiteVendorCreds } from '@/lib/site-integrations'
import { getSiteBrivoToken } from '@/lib/brivo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function canManageSite(siteId: string): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user.isCorporate && normalizeRole(user.role) !== 'admin') return false
  const scope = await resolveOrgScope(user)
  if (scope.all) return true
  const { data } = await supabase.from('sites').select('master_dealer_id, install_dealer_id, service_dealer_id, org_id').eq('id', siteId).maybeSingle()
  if (!data) return false
  return [data.master_dealer_id, data.install_dealer_id, data.service_dealer_id, data.org_id].some(o => o && scope.ids.includes(o))
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await canManageSite(params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const integrations = await listSiteIntegrationStatus(params.id)
  return NextResponse.json({ integrations, key_configured: credsKeyConfigured() })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await canManageSite(params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!credsKeyConfigured()) return NextResponse.json({ error: 'Credential encryption key (CREDENTIALS_ENC_KEY) is not configured on the server.' }, { status: 503 })
  const body = await req.json().catch(() => ({}))
  const vendor = body.vendor as SiteVendor
  if (!SITE_VENDORS.includes(vendor)) return NextResponse.json({ error: 'Unknown vendor' }, { status: 400 })
  const credentials = body.credentials as Record<string, string>
  if (!credentials || typeof credentials !== 'object') return NextResponse.json({ error: 'credentials object required' }, { status: 400 })
  // Drop empty values so a partial update never wipes a secret with a blank.
  const clean: Record<string, string> = {}
  for (const [k, v] of Object.entries(credentials)) if (v != null && String(v).trim() !== '') clean[k] = String(v).trim()
  const { error } = await setSiteVendorCreds(params.id, vendor, clean)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await canManageSite(params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const vendor = (req.nextUrl.searchParams.get('vendor') ?? '') as SiteVendor
  if (!SITE_VENDORS.includes(vendor)) return NextResponse.json({ error: 'Unknown vendor' }, { status: 400 })
  const { error } = await deleteSiteVendorCreds(params.id, vendor)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await canManageSite(params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  if (body.action !== 'test') return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  const vendor = body.vendor as SiteVendor
  if (!SITE_VENDORS.includes(vendor)) return NextResponse.json({ error: 'Unknown vendor' }, { status: 400 })

  // Brivo is wired end-to-end: a real token request verifies the credentials.
  if (vendor === 'brivo') {
    try {
      await getSiteBrivoToken(params.id)
      await markIntegrationTest(params.id, 'brivo', true)
      return NextResponse.json({ ok: true, verified: true })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Brivo test failed'
      await markIntegrationTest(params.id, 'brivo', false, msg)
      return NextResponse.json({ ok: false, error: msg })
    }
  }

  // Shelly Cloud: a device-list call verifies the auth key + server.
  if (vendor === 'shelly') {
    try {
      const creds = await getSiteVendorCreds(params.id, 'shelly')
      if (!creds?.auth_key || !creds?.server) throw new Error('Shelly auth key and server are required.')
      const server = creds.server.replace(/^https?:\/\//, '').replace(/\/$/, '')
      const res = await fetch(`https://${server}/interface/device/list`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ auth_key: creds.auth_key }).toString(),
        signal: AbortSignal.timeout(8000),
      })
      const j = await res.json().catch(() => ({}))
      const ok = res.ok && j?.isok !== false
      await markIntegrationTest(params.id, 'shelly', ok, ok ? undefined : 'Shelly rejected the auth key / server.')
      return NextResponse.json({ ok, verified: ok, ...(ok ? {} : { error: 'Shelly rejected the auth key / server.' }) })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Shelly test failed'
      await markIntegrationTest(params.id, 'shelly', false, msg)
      return NextResponse.json({ ok: false, error: msg })
    }
  }

  // Eagle Eye + UniFi: credentials are stored; live test ports from GGSOC next.
  return NextResponse.json({ ok: true, verified: false, note: 'Saved. Live connection test for this vendor is coming next.' })
}
