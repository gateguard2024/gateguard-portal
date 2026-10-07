/**
 * POST /api/portal/[slug]/lockdown — engage or lift a site lockdown from the ops
 * portal. Body { active: boolean }. Requires a personally signed-in manager.
 *
 * SAFETY: a lockdown secures vehicle entry gates only. It never locks the pedestrian
 * route or anything on the egress/exit side — people can always leave. Egress and
 * pedestrian openings are explicitly excluded here and in site_events.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyPortal } from '@/lib/portal-auth'
import { getPortalManager } from '@/lib/portal-manager'
import { getSiteBrivoToken, listBrivoDoors } from '@/lib/brivo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Openings that must never be held by a lockdown (egress + pedestrian/ADA routes).
const EGRESS = /(exit|egress|ped|pedestrian|walk|man\s?gate|ada|emergenc)/i

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status })
  const siteId = v.portal.site_id
  if (!siteId) return NextResponse.json({ error: 'This portal is not linked to a site.' }, { status: 400 })

  const manager = await getPortalManager(req, params.slug)
  if (!manager) return NextResponse.json({ error: 'Sign in with your personal PIN to engage lockdown.', need_manager: true }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const active = body.active === true

  // Which openings a lockdown would affect — vehicle/entry only; egress + pedestrian excluded.
  let affected: string[] = []
  let excluded: string[] = []
  try {
    const { token, apiKey } = await getSiteBrivoToken(siteId)
    const doors = await listBrivoDoors(token, apiKey)
    for (const d of doors) {
      if (EGRESS.test(d.name)) excluded.push(d.name)
      else affected.push(d.name)
    }
  } catch { /* if doors can't be listed, still record the command */ }

  try {
    await supabase.from('site_events').insert({
      site_id: siteId,
      event_type: active ? 'lockdown_engaged' : 'lockdown_lifted',
      event_source: 'ops_portal',
      severity: active ? 'alert' : 'info',
      title: active ? 'Emergency lockdown engaged' : 'Lockdown lifted',
      description: `${active ? 'Lockdown engaged' : 'Lockdown lifted'} from the ops portal (${params.slug}) by ${manager.name}. Egress and pedestrian routes remain open — people can always leave.`,
      summary: `${active ? 'Lockdown engaged' : 'Lockdown lifted'} · ${manager.name}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: { active, actor: manager.name, actor_id: manager.id, affected, excluded, via: 'ops_portal', portal_slug: params.slug } as any,
    })
  } catch { /* audit best-effort */ }

  return NextResponse.json({ ok: true, active, affected, excluded })
}
