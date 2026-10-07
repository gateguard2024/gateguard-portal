/**
 * POST /api/portal/[slug]/gate — manager gate control from the ops portal.
 * Body { door_id, door_name?, action: 'open' | 'hold_open' | 'force_close', minutes? }.
 *
 * Requires a personally signed-in manager (pm_<slug> cookie) on top of the shared
 * PIN — so every command names a real person in site_events. "open" pulses the
 * Brivo door for real (admin /activate); hold_open / force_close record the command
 * (physical hold/close depends on the gate controller's capability).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyPortal } from '@/lib/portal-auth'
import { getPortalManager } from '@/lib/portal-manager'
import { getSiteBrivoToken, unlockBrivoDoor } from '@/lib/brivo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const ACTIONS = ['open', 'hold_open', 'force_close'] as const
type Action = typeof ACTIONS[number]

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status })
  const siteId = v.portal.site_id
  if (!siteId) return NextResponse.json({ error: 'This portal is not linked to a site.' }, { status: 400 })

  const manager = await getPortalManager(req, params.slug)
  if (!manager) return NextResponse.json({ error: 'Sign in with your personal PIN to control gates.', need_manager: true }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const doorId = String(body.door_id ?? '')
  const doorName = String(body.door_name ?? 'Gate')
  const action = String(body.action ?? 'open') as Action
  const minutes = Math.max(1, Math.min(240, Number(body.minutes) || 60))
  if (!doorId) return NextResponse.json({ error: 'door_id is required' }, { status: 400 })
  if (!ACTIONS.includes(action)) return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  const label: Record<Action, string> = {
    open: `Gate opened: ${doorName}`,
    hold_open: `Gate held open: ${doorName} (${minutes} min)`,
    force_close: `Gate force-closed: ${doorName}`,
  }

  let physical = false
  let physicalNote = ''
  try {
    if (action === 'open') {
      const { token, apiKey, credentialValue } = await getSiteBrivoToken(siteId)
      await unlockBrivoDoor(token, apiKey, doorId, credentialValue)
      physical = true
    } else {
      // hold_open / force_close: no generic Brivo primitive — record the command;
      // physical enforcement is controller-dependent and handled out of band.
      physicalNote = 'Command recorded; physical hold/close depends on the gate controller.'
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gate command failed' }, { status: 502 })
  }

  // Audit — names the manager who ran it.
  try {
    await supabase.from('site_events').insert({
      site_id: siteId,
      event_type: `gate_${action}`,
      event_source: 'brivo',
      title: label[action],
      description: `${label[action]} from the ops portal (${params.slug}) by ${manager.name}.${physicalNote ? ` ${physicalNote}` : ''}`,
      summary: `${label[action]} · ${manager.name}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: { door_id: doorId, door_name: doorName, action, minutes: action === 'hold_open' ? minutes : undefined, actor: manager.name, actor_id: manager.id, via: 'ops_portal', portal_slug: params.slug } as any,
    })
  } catch { /* audit best-effort */ }

  return NextResponse.json({ ok: true, physical, note: physicalNote || undefined })
}
