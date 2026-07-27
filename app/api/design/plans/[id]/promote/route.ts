/**
 * POST /api/design/plans/[id]/promote  { to_stage? }
 *
 * Advances a floor plan to the next stage (Floor Plan → System Design → As-Built)
 * as a NEW plan in the SAME design_group_id, version + 1. The current device
 * layout is cloned so the next stage starts from the last one, not blank. Device
 * ids are remapped and any id references inside notes (e.g. wire endpoints) are
 * rewritten so nothing points back at the source plan.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'

export const dynamic = 'force-dynamic'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const ORDER = ['floor_plan', 'system_design', 'as_built'] as const
function normStage(s: string | null): typeof ORDER[number] {
  const v = (s ?? '').toLowerCase().replace(/[\s-]+/g, '_')
  if (v.includes('as') && v.includes('built')) return 'as_built'
  if (v.includes('system')) return 'system_design'
  return 'floor_plan'
}
function nextStage(s: string | null): typeof ORDER[number] {
  const i = ORDER.indexOf(normStage(s))
  return ORDER[Math.min(i + 1, ORDER.length - 1)]
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (user.id === 'anonymous') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { data: src, error: srcErr } = await db.from('floor_plans').select('*').eq('id', params.id).maybeSingle()
  if (srcErr) return NextResponse.json({ error: srcErr.message }, { status: 500 })
  if (!src) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

  // Scope guard — non-corporate can only promote their own org's plans.
  const scope = await resolveOrgScope(user)
  if (!scope.all && src.org_id && !scope.ids.includes(src.org_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const group = src.design_group_id ?? src.id
  const target = (body.to_stage as string) || nextStage(src.status)

  // Next version number within this design set.
  const { data: peers } = await db.from('floor_plans').select('version').eq('design_group_id', group).order('version', { ascending: false }).limit(1)
  const version = ((peers?.[0]?.version as number) ?? 1) + 1

  const STAGE_NAME: Record<string, string> = { floor_plan: 'Floor Plan', system_design: 'System Design', as_built: 'As-Built' }
  const baseName = String(src.name ?? 'Design').replace(/\s*[–-]\s*(Floor Plan|System Design|As-?Built).*$/i, '').trim()

  const { data: plan, error: planErr } = await db.from('floor_plans').insert({
    org_id:          src.org_id,
    site_id:         src.site_id,
    name:            `${baseName} – ${STAGE_NAME[target] ?? target}`,
    level:           src.level,
    file_url:        src.file_url,
    file_type:       src.file_type,
    status:          target,
    design_group_id: group,
    version,
    created_by:      user.id,
  }).select().single()
  if (planErr || !plan) return NextResponse.json({ error: planErr?.message ?? 'Could not create stage' }, { status: 500 })

  // Clone devices (incl. wires/zones) with fresh ids + notes-id remap.
  const { data: srcDevices } = await db.from('floor_plan_devices').select('*').eq('floor_plan_id', params.id)
  let cloned = 0
  if (srcDevices && srcDevices.length) {
    const idMap = new Map<string, string>()
    for (const d of srcDevices) idMap.set(String(d.id), randomUUID())
    const rows = srcDevices.map((d: Record<string, unknown>) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, created_at, ...rest } = d
      let notes = rest.notes
      if (typeof notes === 'string' && notes) { for (const [o, n] of idMap) notes = (notes as string).split(o).join(n) }
      return { ...rest, id: idMap.get(String(d.id)), floor_plan_id: plan.id, notes }
    })
    const { error: devErr } = await db.from('floor_plan_devices').insert(rows)
    if (!devErr) cloned = rows.length
  }

  return NextResponse.json({ plan, cloned_devices: cloned }, { status: 201 })
}
