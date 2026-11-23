/**
 * /api/portal/[slug]/users/[userId] — one person at the property (a Brivo user).
 *   GET  (portal PIN)                → { groups, credentials, suspended }
 *   POST (portal PIN + manager PIN)  { action, ... }
 *     set_pin { pin }               — add a gate PIN (4–8 digits)
 *     mobile_pass                   — send a Brivo mobile pass to their email
 *     add_fob { card_number, facility_code? }
 *     credential_off / credential_on { credential_id }
 *     suspend / reactivate          — turn the whole person off / back on
 *     add_group / remove_group { group_id }  — this property's groups only
 * Only people in this property's Brivo groups can be read or changed.
 * Every change is logged to site_events with the manager's name.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyPortal } from '@/lib/portal-auth'
import { getPortalManager } from '@/lib/portal-manager'
import {
  getSiteBrivoToken, listBrivoSiteGroupIds, getBrivoUserGroups, getBrivoUser, getBrivoUserCredentialSummary,
  assignBrivoPin, issueBrivoMobilePass, assignBrivoFob, setBrivoCredentialSuspended, setBrivoUserSuspended,
  assignBrivoUserToGroup, removeBrivoUserFromGroup,
} from '@/lib/brivo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const bad = (error: string, status = 400, extra: Record<string, unknown> = {}) => NextResponse.json({ error, ...extra }, { status })

/** Brivo login for the portal's property + proof this person belongs to it. */
async function scoped(siteId: string, userId: string) {
  const { token, apiKey, brivoSiteId } = await getSiteBrivoToken(siteId)
  const [siteGroups, userGroups] = await Promise.all([
    brivoSiteId ? listBrivoSiteGroupIds(token, apiKey, brivoSiteId) : Promise.resolve([] as string[]),
    getBrivoUserGroups(token, apiKey, userId),
  ])
  const siteSet = new Set(siteGroups)
  // No site groups known (account = this property only) → the account itself is the scope.
  const inSite = siteSet.size === 0 || userGroups.some(g => siteSet.has(g.id))
  return { token, apiKey, siteSet, userGroups, inSite }
}

export async function GET(req: NextRequest, { params }: { params: { slug: string; userId: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return bad(v.error, v.status)
  if (!v.portal.site_id) return bad('Portal not linked to a site.')
  try {
    const s = await scoped(v.portal.site_id, params.userId)
    if (!s.inSite) return bad('That person isn’t at this property.', 404)
    const [credentials, raw] = await Promise.all([
      getBrivoUserCredentialSummary(s.token, s.apiKey, params.userId).catch(() => []),
      getBrivoUser(s.token, s.apiKey, params.userId).catch(() => null),
    ])
    return NextResponse.json({
      groups: s.userGroups.filter(g => s.siteSet.size === 0 || s.siteSet.has(g.id)),
      credentials,
      suspended: raw ? raw.suspended === true : null,
    })
  } catch (e) {
    return bad(e instanceof Error ? e.message : 'Could not load that person.', 502)
  }
}

export async function POST(req: NextRequest, { params }: { params: { slug: string; userId: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return bad(v.error, v.status)
  const siteId = v.portal.site_id
  if (!siteId) return bad('Portal not linked to a site.')
  const manager = await getPortalManager(req, params.slug)
  if (!manager) return bad('Sign in with your personal PIN to make changes.', 403, { need_manager: true })

  const b = await req.json().catch(() => ({}))
  const action = String(b.action ?? '')
  const who = String(b.name ?? 'a resident').slice(0, 80)
  try {
    const s = await scoped(siteId, params.userId)
    if (!s.inSite) return bad('That person isn’t at this property.', 404)
    const { token, apiKey } = s
    let summary = ''
    switch (action) {
      case 'set_pin': {
        const pin = String(b.pin ?? '').trim()
        if (!/^\d{4,8}$/.test(pin)) return bad('The gate PIN must be 4 to 8 digits.')
        await assignBrivoPin(token, apiKey, params.userId, pin)
        summary = 'Gate PIN added'
        break
      }
      case 'mobile_pass':
        await issueBrivoMobilePass(token, apiKey, params.userId, b.email ? String(b.email) : null)
        summary = 'Mobile pass sent'
        break
      case 'add_fob': {
        const card = String(b.card_number ?? '').trim()
        if (!card) return bad('Enter the fob or card number.')
        await assignBrivoFob(token, apiKey, params.userId, card, b.facility_code ? String(b.facility_code) : null)
        summary = `Fob added (#${card})`
        break
      }
      case 'credential_off':
      case 'credential_on': {
        const id = String(b.credential_id ?? '')
        if (!id) return bad('credential_id required')
        const creds = await getBrivoUserCredentialSummary(token, apiKey, params.userId)
        if (!creds.some(c => c.id === id)) return bad('That credential isn’t on this person.', 404)
        await setBrivoCredentialSuspended(token, apiKey, id, action === 'credential_off')
        summary = action === 'credential_off' ? 'Credential turned off' : 'Credential turned back on'
        break
      }
      case 'suspend':
      case 'reactivate':
        await setBrivoUserSuspended(token, apiKey, params.userId, action === 'suspend')
        summary = action === 'suspend' ? 'Access turned off' : 'Access turned back on'
        break
      case 'add_group':
      case 'remove_group': {
        const gid = String(b.group_id ?? '')
        if (!gid) return bad('group_id required')
        if (s.siteSet.size && !s.siteSet.has(gid)) return bad('That access group isn’t at this property.')
        if (action === 'add_group') await assignBrivoUserToGroup(token, apiKey, gid, params.userId)
        else await removeBrivoUserFromGroup(token, apiKey, gid, params.userId)
        summary = action === 'add_group' ? `Added to ${String(b.group_name ?? 'a group')}` : `Removed from ${String(b.group_name ?? 'a group')}`
        break
      }
      default:
        return bad('Unknown action.')
    }

    const { error: logErr } = await db().from('site_events').insert({
      site_id: siteId, event_type: 'access_admin', event_source: 'brivo',
      title: `${summary}: ${who}`,
      description: `From the property portal (${params.slug}) by ${manager.name}`,
      summary: `${summary} by ${manager.name}`,
      metadata: { brivo_user_id: params.userId, action, via: 'customer_portal', portal_slug: params.slug, by_name: manager.name, manager_id: manager.id, credential_id: b.credential_id ?? null, group_id: b.group_id ?? null },
    })
    if (logErr) console.error('[portal user] audit log failed:', logErr.message)
    return NextResponse.json({ ok: true, summary })
  } catch (e) {
    return bad(e instanceof Error ? e.message : 'That didn’t work.', 502)
  }
}
