/**
 * GET /api/portal/[slug]/brivo-capabilities — Gate Guard staff only, READ-ONLY.
 * Asks this property's Brivo account what it supports before we turn on a REAL
 * lockdown / hold-open from the portal (Nov 24 2026): Brivo documents
 * POST /emergency-scenarios/lockdown/{id}/initiate and a door-override body, but not
 * the list / clear / override addresses. Only GETs are sent — nothing changes.
 * Open it in a browser while signed in to Nexus and send the result to the developer.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyPortal } from '@/lib/portal-auth'
import { gateGuardStaff } from '@/lib/portal-manager'
import { getSiteBrivoToken, listBrivoDoors } from '@/lib/brivo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const BASE = 'https://api.brivo.com'

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status })
  if (!(await gateGuardStaff())) return NextResponse.json({ error: 'Gate Guard staff only — sign in to Nexus.' }, { status: 403 })
  if (!v.portal.site_id) return NextResponse.json({ error: 'Portal not linked to a site.' }, { status: 400 })
  const { token, apiKey, brivoSiteId } = await getSiteBrivoToken(v.portal.site_id)
  const doors = await listBrivoDoors(token, apiKey, brivoSiteId).catch(() => [])
  const door = doors[0]?.id
  const paths = [
    '/v1/api/emergency-scenarios',
    '/v1/api/emergency-scenarios/lockdown',
    '/v1/api/emergency-scenarios/egress',
    '/v1/api/emergency-scenarios/active',
    ...(door ? [`/v1/api/access-points/${door}`, `/v1/api/access-points/${door}/schedule-override`, `/v1/api/access-points/${door}/door-override`, `/v1/api/access-points/${door}/override`, `/v1/api/access-points/${door}/schedules`] : []),
  ]
  const results: Record<string, unknown> = {}
  for (const p of paths) {
    try {
      const r = await fetch(BASE + p, { headers: { Authorization: `Bearer ${token}`, 'api-key': apiKey, Accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(8000) })
      const text = await r.text()
      results[p] = { status: r.status, body: text.slice(0, 1500) }
    } catch (e) { results[p] = { error: e instanceof Error ? e.message : String(e) } }
    await new Promise(res => setTimeout(res, 300)) // stay well under Brivo's rate limit
  }
  return NextResponse.json({ note: 'Read-only. Nothing was changed.', door_checked: doors[0] ?? null, results })
}
