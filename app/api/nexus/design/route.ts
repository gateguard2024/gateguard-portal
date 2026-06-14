import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

type Stage = 'floor_plan' | 'system_design' | 'as_built'

// Map a floor_plans.status into one of the three Design stages.
function stageFromStatus(status: string | null): Stage {
  const s = (status ?? '').toLowerCase()
  if (s.includes('as') && s.includes('built')) return 'as_built'
  if (s.includes('design') || s.includes('system') || s.includes('review')) return 'system_design'
  return 'floor_plan'
}

// GET /api/nexus/design — one Design record per site, built from its floor plans,
// org-scoped. Stages are derived from floor_plan status; device counts from
// floor_plan_devices.
export async function GET(_req: NextRequest) {
  const user = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  // floor_plans carry org_id directly — scope on that column (corporate sees all).
  let fpQ = supabase
    .from('floor_plans')
    .select('id, site_id, org_id, name, level, file_type, status, created_by, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(400)
  fpQ = applyOrgScope(fpQ, scope, 'org_id')
  const { data: plans, error } = await fpQ
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!plans?.length) return NextResponse.json({ records: [] })

  // Device counts per plan.
  const planIds = plans.map((p) => p.id)
  const { data: fpDevices } = await supabase
    .from('floor_plan_devices')
    .select('floor_plan_id, device_type')
    .in('floor_plan_id', planIds)
  const devicesByPlan = new Map<string, { device_type: string }[]>()
  for (const d of fpDevices ?? []) {
    if (!devicesByPlan.has(d.floor_plan_id)) devicesByPlan.set(d.floor_plan_id, [])
    devicesByPlan.get(d.floor_plan_id)!.push(d)
  }

  // Resolve site names for grouping/labels.
  const siteIds = Array.from(new Set(plans.map((p) => p.site_id).filter(Boolean)))
  const siteName = new Map<string, { name: string; address: string | null }>()
  if (siteIds.length) {
    const { data: sites } = await supabase
      .from('sites')
      .select('id, name, address, city, state')
      .in('id', siteIds)
    for (const s of sites ?? []) {
      siteName.set(s.id, { name: s.name, address: [s.address, s.city, s.state].filter(Boolean).join(', ') || null })
    }
  }

  // Group plans into one Design record per site (plans with no site_id stand alone).
  const groups = new Map<string, any[]>()
  for (const p of plans) {
    const key = p.site_id ?? `plan:${p.id}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(p)
  }

  const records = Array.from(groups.entries()).map(([key, gPlans]) => {
    const site = key.startsWith('plan:') ? null : siteName.get(key)
    const stagesPresent = new Set<Stage>(gPlans.map((p) => stageFromStatus(p.status)))
    const order: Stage[] = ['floor_plan', 'system_design', 'as_built']
    const currentStage = order.filter((s) => stagesPresent.has(s)).pop() ?? 'floor_plan'

    // Device counts across all plans in this group.
    const counts = new Map<string, number>()
    let deviceTotal = 0
    for (const p of gPlans) {
      for (const d of devicesByPlan.get(p.id) ?? []) {
        const t = d.device_type || 'Other'
        counts.set(t, (counts.get(t) ?? 0) + 1)
        deviceTotal++
      }
    }

    const lastUpdated = gPlans.map((p) => p.updated_at).filter(Boolean).sort().pop() ?? gPlans[0].created_at

    return {
      id: gPlans[0].id, // representative plan id (UI opens drawing tool with it)
      property_name: site?.name ?? gPlans[0].name ?? 'Untitled design',
      address: site?.address ?? null,
      current_stage: currentStage,
      stages: order.map<{ stage: Stage; status: 'done' | 'in_progress' | 'not_started'; version: number; updated_by?: string; updated_at?: string }>((stage) => {
        const planForStage = gPlans.find((p) => stageFromStatus(p.status) === stage)
        return {
          stage,
          status: planForStage
            ? stage === currentStage ? 'in_progress' : 'done'
            : 'not_started',
          version: planForStage ? 1 : 0,
          updated_by: planForStage?.created_by ?? undefined,
          updated_at: planForStage?.updated_at ?? undefined,
        }
      }),
      device_counts: Array.from(counts.entries()).map(([type, count]) => ({ type, count })),
      bom: Array.from(counts.entries()).map(([name, qty]) => ({ name, qty })),
      device_total: deviceTotal,
      plan_versions: gPlans.length,
      last_updated: lastUpdated,
      activity: [],
    }
  })

  return NextResponse.json({ records })
}
