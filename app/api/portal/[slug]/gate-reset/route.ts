/**
 * /api/portal/[slug]/gate-reset — the property portal's Reset button (lib/gate-reset.ts).
 * The recipe is Gate Guard's (Nexus, corporate only); the portal can't change it.
 *   GET            → { resets: [{ id, name, door_id, camera_id, camera_name, wait_seconds }] }  (portal_enabled only)
 *   GET ?run=<id>  → { run: RunState }   (progress for the sheet)
 *   POST { reset_id } → { run_id }       (signed-in manager; one run per gate at a time)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyPortal, portalDoorAllowed } from '@/lib/portal-auth'
import { getPortalManager } from '@/lib/portal-manager'
import { portalCameraScope } from '@/lib/video'
import { getRecipe, createRun, readRun, waitSeconds, stepFailed, type Recipe } from '@/lib/gate-reset'
import { inngest } from '@/inngest/client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status })
  const siteId = v.portal.site_id
  if (!siteId) return NextResponse.json({ resets: [] })
  const runId = req.nextUrl.searchParams.get('run')
  if (runId) {
    const run = await readRun(siteId, runId)
    return run ? NextResponse.json({ run }) : NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const { data, error } = await db().from('gate_reboots').select('*').eq('site_id', siteId).order('name')
  if (error) return NextResponse.json({ resets: [], error: error.message })
  const scope = portalCameraScope(v.portal.camera_ids)
  const resets = ((data ?? []) as Recipe[])
    .filter(r => r.portal_enabled !== false)
    .map(r => {
      const door = r.portal_door_id ?? (r.actuation_type === 'brivo' ? r.actuation_door_id : null)
      return { id: r.id, name: r.name, door_id: door, camera_id: r.camera_id && scope.allow(`een:${r.camera_id}`) ? r.camera_id : null, camera_name: r.camera_name, wait_seconds: waitSeconds(r) }
    })
    .filter(r => !r.door_id || portalDoorAllowed(v.portal, r.door_id))
  return NextResponse.json({ resets })
}

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status })
  const siteId = v.portal.site_id
  if (!siteId) return NextResponse.json({ error: 'This portal is not linked to a site.' }, { status: 400 })
  const manager = await getPortalManager(req, params.slug)
  if (!manager) return NextResponse.json({ error: 'Sign in with your personal PIN to reset a gate.', need_manager: true }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const r = b.reset_id ? await getRecipe(siteId, String(b.reset_id)) : null
  if (!r || r.portal_enabled === false) return NextResponse.json({ error: 'That reset isn’t available here.' }, { status: 404 })
  const door = r.portal_door_id ?? (r.actuation_type === 'brivo' ? r.actuation_door_id : null)
  if (door && !portalDoorAllowed(v.portal, door)) return NextResponse.json({ error: 'That gate isn’t on this portal.' }, { status: 403 })
  // One at a time per gate: refuse if a run for this recipe started < 10 min ago and isn't finished.
  const { data: recent } = await db().from('site_events').select('id, metadata').eq('site_id', siteId).eq('event_type', 'gate_reset')
    .gte('created_at', new Date(Date.now() - 10 * 60_000).toISOString()).order('created_at', { ascending: false }).limit(20)
  const busy = (recent ?? []).find(e => (e.metadata as { recipe_id?: string; finished?: boolean })?.recipe_id === r.id && !(e.metadata as { finished?: boolean })?.finished)
  if (busy) return NextResponse.json({ error: 'This gate is already being reset.', run_id: busy.id }, { status: 409 })
  let runId: string
  try { runId = await createRun(siteId, r, manager.name, `property portal ${params.slug}`) }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not start' }, { status: 500 }) }
  try { await inngest.send({ name: 'gate/reset.run', data: { siteId, recipeId: r.id, runId } }) }
  catch (e) { await stepFailed(runId, 'the background job didn’t start'); return NextResponse.json({ error: `Could not start the reset: ${e instanceof Error ? e.message : e}` }, { status: 502 }) }
  return NextResponse.json({ run_id: runId })
}
