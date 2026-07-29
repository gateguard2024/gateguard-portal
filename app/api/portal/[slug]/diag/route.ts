import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyPortal } from '@/lib/portal-auth'
import { getSiteEagleEyeAccess, listEagleEyeCameras, eagleEyePreviewFrame } from '@/lib/eagle-eye'
import { getSiteBrivoToken, getOrgBrivoToken, listBrivoDoors, listBrivoEvents, listBrivoUsers } from '@/lib/brivo'
import { getQboAuth, qboApi } from '@/lib/qbo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// GET /api/portal/[slug]/diag — PIN-gated health check. Runs every vendor call the
// portal depends on and reports ok/count/error for each, so we can see exactly
// what's failing (creds missing, timeout, wrong site, etc.) instead of the silent
// empty states the data routes return. Never throws; each probe is isolated.
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return NextResponse.json({ authed: false, status: v.status, error: v.error }, { status: v.status })

  const siteId = v.portal.site_id
  const out: Record<string, unknown> = {
    authed: true,
    slug: params.slug,
    site_id: siteId,
    org_id: v.portal.org_id,
    modules: v.portal.modules,
    camera_ids_whitelist: v.portal.camera_ids?.length ?? 0,
  }

  const probe = async (name: string, fn: () => Promise<unknown>) => {
    const t0 = Date.now()
    try {
      const r = await fn()
      out[name] = { ok: true, ms: Date.now() - t0, ...(typeof r === 'object' && r ? r : { value: r }) }
    } catch (e) {
      out[name] = { ok: false, ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) }
    }
  }

  if (!siteId) { out.note = 'Portal not linked to a site.'; return NextResponse.json(out) }

  // Eagle Eye — cameras list + a preview frame for EVERY camera (which stream?)
  let allCams: { id: string; name: string; online: boolean | null }[] = []
  await probe('eagle_eye_cameras', async () => {
    const { token, baseHost } = await getSiteEagleEyeAccess(siteId)
    const cams = await listEagleEyeCameras(token, baseHost)
    allCams = cams.map(c => ({ id: c.id, name: c.name, online: c.online }))
    return { count: cams.length, baseHost }
  })
  await probe('eagle_eye_preview_all', async () => {
    const { token, baseHost } = await getSiteEagleEyeAccess(siteId)
    const results = []
    for (const c of allCams) {
      const t0 = Date.now()
      const frame = await eagleEyePreviewFrame(token, baseHost, c.id).catch(() => null)
      results.push({ name: c.name, online: c.online, ms: Date.now() - t0, bytes: frame ? frame.length : 0, streams: !!frame })
    }
    return { cameras: results, streaming: results.filter(r => r.streams).length, total: results.length }
  })

  // Brivo — SITE token vs ORG token, so we can see if it's a scope/creds issue
  await probe('brivo_site_token', async () => {
    const { token, apiKey, brivoSiteId } = await getSiteBrivoToken(siteId)
    const doors = await listBrivoDoors(token, apiKey, brivoSiteId).catch(e => ({ __err: e instanceof Error ? e.message : String(e) }))
    const events = await listBrivoEvents(token, apiKey, 5).catch(e => ({ __err: e instanceof Error ? e.message : String(e) }))
    const users = brivoSiteId
      ? await listBrivoUsers(token, apiKey, brivoSiteId).catch(e => ({ __err: e instanceof Error ? e.message : String(e) }))
      : '(no brivo_site_id saved)'
    return {
      has_brivo_site_id: !!brivoSiteId,
      doors: Array.isArray(doors) ? doors.length : doors,
      events: Array.isArray(events) ? events.length : events,
      users: Array.isArray(users) ? users.length : users,
    }
  })
  await probe('brivo_org_token', async () => {
    const { token, apiKey } = await getOrgBrivoToken(v.portal.org_id)
    const events = await listBrivoEvents(token, apiKey, 5).catch(e => ({ __err: e instanceof Error ? e.message : String(e) }))
    return { events: Array.isArray(events) ? events.length : events }
  })

  // QuickBooks — connection source + a REAL test query (reproduces the 401)
  await probe('quickbooks', async () => {
    const { data: conn } = await supabase.from('qbo_connection').select('realm_id, environment, access_expires_at, refresh_expires_at, is_active, last_refreshed_at').eq('is_active', true).order('updated_at', { ascending: false }).limit(1).maybeSingle()
    const { data: siteRow } = await supabase.from('sites').select('qbo_customer_id, qbo_customer_name').eq('id', siteId).maybeSingle()
    const { data: invs } = await supabase.from('invoices').select('id, status, balance_due').eq('site_id', siteId)
    const open = (invs ?? []).filter(i => i.status !== 'void' && Number(i.balance_due) > 0)

    const auth = await getQboAuth()
    let live_query: string | { rows: number } = 'not attempted'
    if (auth.ok) {
      const r = await qboApi(auth, `/query?query=${encodeURIComponent('select * from CompanyInfo')}&minorversion=73`)
      if (r.ok) { const j = await r.json().catch(() => ({})); live_query = { rows: (j?.QueryResponse?.CompanyInfo ?? []).length } }
      else live_query = `HTTP ${r.status}: ${(await r.text()).slice(0, 180)}`
    }

    return {
      token_source: conn ? 'stored_oauth_connection' : (process.env.QBO_ACCESS_TOKEN ? 'legacy_env_var (stale!)' : 'none'),
      stored_connection: conn ? { realm_id: conn.realm_id, access_expires_at: conn.access_expires_at, refresh_expires_at: conn.refresh_expires_at, last_refreshed_at: conn.last_refreshed_at } : null,
      getQboAuth_ok: auth.ok,
      getQboAuth_reason: auth.ok ? undefined : auth.reason,
      live_query,
      site_linked_to_customer: !!siteRow?.qbo_customer_id,
      qbo_customer_name: siteRow?.qbo_customer_name ?? null,
      invoices_for_site: (invs ?? []).length,
      open_invoices: open.length,
    }
  })

  return NextResponse.json(out)
}
