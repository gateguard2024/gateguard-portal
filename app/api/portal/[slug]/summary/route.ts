import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyPortal } from '@/lib/portal-auth'
import { getSiteEagleEyeAccess, listEagleEyeCameras } from '@/lib/eagle-eye'
import { getSiteBrivoToken, listBrivoDoors, listBrivoEvents } from '@/lib/brivo'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/portal/[slug]/summary — read-only site data for the customer portal.
// PIN-gated. Uses the SITE's stored vendor creds server-side (same feeds as the
// internal Systems page). Every feed is independent + failure-tolerant.
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status })

  const siteId = v.portal.site_id
  if (!siteId) return NextResponse.json({ cameras: [], doors: [], activity: [], balanceDue: null })

  const camWhitelist = v.portal.camera_ids && v.portal.camera_ids.length ? new Set(v.portal.camera_ids) : null

  // ── Cameras (Eagle Eye) ──────────────────────────────────────────────────
  const cameras = await (async () => {
    try {
      const { token, baseHost } = await getSiteEagleEyeAccess(siteId)
      const all = await listEagleEyeCameras(token, baseHost)
      const scoped = camWhitelist ? all.filter(c => camWhitelist.has(c.id)) : all
      return scoped.map(c => ({ id: c.id, name: c.name, online: c.online !== false }))
    } catch { return [] }
  })()

  // ── Doors + recent access events (Brivo) ─────────────────────────────────
  let doors: { id: string; name: string }[] = []
  let activity: { id: string; label: string; where: string; time: string }[] = []
  try {
    const { token, apiKey, brivoSiteId } = await getSiteBrivoToken(siteId)
    try {
      doors = (await listBrivoDoors(token, apiKey, brivoSiteId)).map(d => ({ id: d.id, name: d.name }))
    } catch { /* doors optional */ }
    try {
      const events = await listBrivoEvents(token, apiKey, 12)
      activity = events.map(e => ({
        id: e.id,
        label: e.actor ? `${e.action} — ${e.actor}` : e.action,
        where: e.door || 'Site',
        time: e.occurred ? new Date(e.occurred).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '',
      }))
    } catch { /* events optional */ }
  } catch { /* Brivo not connected */ }

  // ── Open balance (portal + QBO-imported invoices) ────────────────────────
  const balanceDue = await (async () => {
    try {
      const { data } = await supabase
        .from('invoices')
        .select('balance_due, status')
        .eq('site_id', siteId)
      if (!data) return null
      const open = data.filter(i => i.status !== 'void' && Number(i.balance_due) > 0)
      return open.reduce((s, i) => s + Number(i.balance_due || 0), 0)
    } catch { return null }
  })()

  return NextResponse.json({ cameras, doors, activity, balanceDue })
}
