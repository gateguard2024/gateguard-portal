/**
 * POST /api/portal/[slug]/lockdown — engage or lift a site lockdown from the ops
 * portal. Body { active: boolean }. Requires a personally signed-in manager.
 *
 * HONEST STATE (Nov 24 2026): Brivo has no "hold locked" command we use yet, so a lockdown
 * does NOT lock anything physically. It is logged AND emails Gate Guard right away
 * (info@gateguard.co) so a person acts on it; the screen says so plainly.
 *
 * SAFETY: a lockdown secures vehicle entry gates only. It never locks the pedestrian
 * route or anything on the egress/exit side — people can always leave. Egress and
 * pedestrian openings are explicitly excluded here and in site_events.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyPortal, portalDoorAllowed } from '@/lib/portal-auth'
import { sendEmail } from '@/lib/email-sender'
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
    const { token, apiKey, brivoSiteId } = await getSiteBrivoToken(siteId)
    const doors = (await listBrivoDoors(token, apiKey, brivoSiteId)).filter(d => portalDoorAllowed(v.portal, String(d.id)))
    for (const d of doors) {
      if (EGRESS.test(d.name)) excluded.push(d.name)
      else affected.push(d.name)
    }
  } catch { /* if doors can't be listed, still record the command */ }

  {
    const { error: aErr } = await supabase.from('site_events').insert({
      site_id: siteId,
      event_type: active ? 'lockdown_engaged' : 'lockdown_lifted',
      event_source: 'ops_portal',
      severity: active ? 'alert' : 'info',
      title: active ? 'Emergency lockdown engaged' : 'Lockdown lifted',
      description: `${active ? 'Lockdown engaged' : 'Lockdown lifted'} from the ops portal (${params.slug}) by ${manager.name}. Egress and pedestrian routes remain open — people can always leave.`,
      summary: `${active ? 'Lockdown engaged' : 'Lockdown lifted'} · ${manager.name}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: { active, actor: manager.name, actor_id: manager.id, affected, excluded, physical: false, via: 'ops_portal', portal_slug: params.slug } as any,
    })
    if (aErr) console.error('[portal lockdown] audit failed:', aErr.message)
  }

  // Alert Gate Guard now — a person has to act, nothing is locked automatically yet.
  const when = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })
  const r = await sendEmail({
    to: ['info@gateguard.co'],
    subject: `${active ? '🚨 LOCKDOWN requested' : 'Lockdown lifted'} — ${params.slug}`,
    html: `<p><b>${active ? 'A lockdown was requested' : 'The lockdown was lifted'}</b> from the property portal <b>${params.slug}</b> by <b>${manager.name}</b> at ${when} ET.</p>`
      + (active ? `<p>Gates are <b>not</b> locked automatically — please act now. Entry gates: ${affected.join(', ') || '—'}. Left open (exit / pedestrian): ${excluded.join(', ') || '—'}.</p>` : ''),
  }).catch(e => ({ ok: false, error: e instanceof Error ? e.message : String(e) }))
  const alerted = !!(r as { ok?: boolean }).ok
  if (!alerted) console.error('[portal lockdown] alert email failed:', (r as { error?: string }).error)

  return NextResponse.json({ ok: true, active, affected, excluded, physical: false, alerted })
}
