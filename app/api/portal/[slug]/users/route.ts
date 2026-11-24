import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyPortal } from '@/lib/portal-auth'
import { getPortalManager } from '@/lib/portal-manager'
import { getSiteBrivoToken, listBrivoUsers, listBrivoGroups, listBrivoSiteGroupIds, createBrivoUser, issueBrivoMobilePass, assignBrivoFob, assignBrivoPin } from '@/lib/brivo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// GET /api/portal/[slug]/users?q=&groups=1 — PIN-gated Brivo user directory for
// the site. Mirrors /api/brivo/users but authed by the portal PIN. Users belong
// to a site via groups, so listBrivoUsers narrows to the site's Brivo Site ID.
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status })

  const siteId = v.portal.site_id
  if (!siteId) return NextResponse.json({ users: [] })

  try {
    const { token, apiKey, brivoSiteId } = await getSiteBrivoToken(siteId)
    if (!brivoSiteId) return NextResponse.json({ users: [], needs_site_id: true })
    const all = await listBrivoUsers(token, apiKey, brivoSiteId)
    const q = (req.nextUrl.searchParams.get('q') ?? '').trim().toLowerCase()
    const users = q
      ? all.filter(u => [`${u.firstName} ${u.lastName}`, u.email ?? '', u.phone ?? '', u.unitNumber ?? '']
          .some(f => f.toLowerCase().includes(q)))
      : all
    const groups = req.nextUrl.searchParams.get('groups')
      ? await listBrivoGroups(token, apiKey, brivoSiteId).catch(() => [])
      : undefined
    // Last time each person used a door/gate — from the saved access history (kept 90 days,
    // migration 241), matched by name. null = no history yet (241 not run / not synced).
    // history_days = how far back the history reaches (the 60-day flag needs >= 60).
    let lastUsed: Record<string, string> | null = null
    let historyDays = 0
    {
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      const { data, error } = await sb.from('brivo_events').select('actor, occurred_at').eq('site_id', siteId)
        .gte('occurred_at', new Date(Date.now() - 90 * 864e5).toISOString()).not('actor', 'is', null)
        .order('occurred_at', { ascending: false }).limit(10000)
      if (!error) {
        const latest = new Map<string, string>()
        for (const r of (data ?? []) as { actor: string; occurred_at: string }[]) { const k = r.actor.trim().toLowerCase(); if (!latest.has(k)) latest.set(k, r.occurred_at) }
        lastUsed = {}
        const { data: first } = await sb.from('brivo_events').select('occurred_at').eq('site_id', siteId).order('occurred_at', { ascending: true }).limit(1).maybeSingle()
        if (first?.occurred_at) historyDays = Math.min(90, Math.floor((Date.now() - Date.parse(first.occurred_at)) / 864e5))
        for (const u of users) { const t = latest.get(`${u.firstName} ${u.lastName}`.trim().toLowerCase()); if (t) lastUsed[u.id] = t }
      }
    }
    return NextResponse.json({ users, last_used: lastUsed, history_days: historyDays, ...(groups ? { groups } : {}) })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not load users', users: [] }, { status: 502 })
  }
}

// POST /api/portal/[slug]/users  { firstName, lastName, email?, unit?, groupId? }
// Add a resident/staff user (permanent). Group carries access.
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status })
  const siteId = v.portal.site_id
  if (!siteId) return NextResponse.json({ error: 'Portal not linked to a site.' }, { status: 400 })
  // Adding a person gives them gate access — it must name a real manager (personal PIN).
  const manager = await getPortalManager(req, params.slug)
  if (!manager) return NextResponse.json({ error: 'Sign in with your personal PIN to add people.', need_manager: true }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const firstName = String(body.firstName ?? '').trim()
  const lastName = String(body.lastName ?? '').trim()
  const email = body.email ? String(body.email).trim() : null
  const phone = body.phone ? String(body.phone).trim() : null
  if (!firstName || !lastName) return NextResponse.json({ error: 'First and last name are required.' }, { status: 400 })

  try {
    const { token, apiKey, brivoSiteId } = await getSiteBrivoToken(siteId)
    // Only this property's own access groups.
    if (body.groupId && brivoSiteId) {
      const ids = await listBrivoSiteGroupIds(token, apiKey, brivoSiteId).catch(() => [] as string[])
      if (!ids.includes(String(body.groupId))) return NextResponse.json({ error: 'That access group isn’t at this property.' }, { status: 400 })
    }
    if (body.pin && !/^\d{4,8}$/.test(String(body.pin).trim())) return NextResponse.json({ error: 'The gate PIN must be 4 to 8 digits.' }, { status: 400 })
    const created = await createBrivoUser(token, apiKey, {
      firstName, lastName, email, phone,
      externalId: body.unit ? String(body.unit).trim() : null,
      groupId: body.groupId ? String(body.groupId) : null,
    })

    // Optional credentials issued on creation. Each is best-effort + reported so
    // the UI can show which succeeded (a fob failing shouldn't undo the user).
    const credentials: Record<string, string> = {}
    if (body.mobilePass) {
      try { await issueBrivoMobilePass(token, apiKey, created.id, email); credentials.mobile_pass = 'issued' }
      catch (e) { credentials.mobile_pass = `failed: ${e instanceof Error ? e.message : 'error'}` }
    }
    if (body.fobCardNumber) {
      try { await assignBrivoFob(token, apiKey, created.id, String(body.fobCardNumber), body.fobFacilityCode ? String(body.fobFacilityCode) : null); credentials.fob = 'assigned' }
      catch (e) { credentials.fob = `failed: ${e instanceof Error ? e.message : 'error'}` }
    }
    if (body.pin) {
      try { await assignBrivoPin(token, apiKey, created.id, String(body.pin)); credentials.pin = 'assigned' }
      catch (e) { credentials.pin = `failed: ${e instanceof Error ? e.message : 'error'}` }
    }

    const { error: logErr } = await supabase.from('site_events').insert({
      site_id: siteId, event_type: 'access_admin', event_source: 'brivo',
      title: `User added: ${firstName} ${lastName}`,
      description: `Added from the property portal (${params.slug}) by ${manager.name}`,
      summary: `User added by ${manager.name}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: { brivo_user_id: created.id, via: 'customer_portal', portal_slug: params.slug, by_name: manager.name, manager_id: manager.id } as any,
    })
    if (logErr) console.error('[portal users] audit log failed:', logErr.message)
    return NextResponse.json({ ok: true, user_id: created.id, credentials })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not add user' }, { status: 502 })
  }
}
