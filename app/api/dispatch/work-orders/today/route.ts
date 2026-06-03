import { NextResponse } from 'next/server'
import { createClient }  from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// Deterministic AI score 70–99 based on priority + id hash
function aiScore(id: string, priority: string): number {
  const h = Array.from(id).reduce((a, c) => ((a * 31) + c.charCodeAt(0)) & 0xffff, 0)
  const base = (h % 20) + 70
  const bump: Record<string, number> = { critical: 15, high: 10, normal: 5, low: 0 }
  return Math.min(99, base + (bump[priority] ?? 5))
}

// Pick a recommended tech from available roster
function pickBestTech(techs: Array<{ id: string; name: string; status: string; role: string }>) {
  const ranked = [...techs].sort((a, b) => {
    const rank = (s: string) => (s === 'available' ? 0 : s === 'driving' ? 1 : s === 'on_site' ? 2 : 3)
    return rank(a.status) - rank(b.status)
  })
  return ranked[0] ?? null
}

// Generate AI reasoning sentence
function buildReasoning(
  tech: { name: string; status: string } | null,
  wo: { title: string; priority: string }
): string {
  if (!tech) return `No technician currently available for "${wo.title}".`

  const statusPhrase: Record<string, string> = {
    available:  `${tech.name} is available and ready to dispatch.`,
    driving:    `${tech.name} is already en route — minimal detour expected.`,
    on_site:    `${tech.name} is on-site nearby and can handle this next.`,
    offline:    `${tech.name} is the best available option despite being offline.`,
  }

  const priorityNote = wo.priority === 'critical' || wo.priority === 'high'
    ? ' This is a high-priority job.'
    : ''

  return (statusPhrase[tech.status] ?? `${tech.name} is the recommended technician.`) + priorityNote
}

// GET /api/dispatch/work-orders/today
// Returns today's open/scheduled WOs with AI tech recommendations
export async function GET() {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // Fetch today's WOs (open + in_progress + scheduled)
  let woQuery = supabase
    .from('work_orders')
    .select('id, wo_number, title, customer_name, job_type, assignee_id, assignee_name, priority, status, scheduled_date, site_id')
    .in('status', ['open', 'in_progress', 'scheduled'])
    .or(`scheduled_date.is.null,scheduled_date.gte.${today.toISOString()},scheduled_date.lt.${tomorrow.toISOString()}`)
    .order('priority', { ascending: false })
    .limit(5)

  woQuery = applyOrgScope(woQuery, scope, 'org_id')

  // Fetch available techs
  let techQuery = supabase
    .from('technicians')
    .select('id, name, status, role')
    .neq('status', 'offline')
    .order('name')

  if (!scope.all && scope.ids.length > 0) {
    const idList = scope.ids.join(',')
    techQuery = (techQuery as any).or(`org_id.in.(${idList}),org_id.is.null`) as typeof techQuery
  }

  const [woRes, techRes] = await Promise.all([woQuery, techQuery])

  if (woRes.error) return NextResponse.json({ error: woRes.error.message }, { status: 500 })

  const techs   = (techRes.data ?? []) as Array<{ id: string; name: string; status: string; role: string }>
  const rawWOs  = (woRes.data  ?? []) as Array<{
    id: string; wo_number: string | null; title: string
    customer_name: string | null; job_type: string | null
    assignee_id: string | null; assignee_name: string | null
    priority: string; status: string; scheduled_date: string | null
    site_id: string | null
  }>

  const workOrders = rawWOs.map(wo => {
    // If already assigned, use that tech; otherwise pick best available
    const assignedTech = wo.assignee_id
      ? techs.find(t => t.id === wo.assignee_id) ?? null
      : null
    const recommendedTech = assignedTech ?? pickBestTech(techs)
    const score     = aiScore(wo.id, wo.priority)
    const reasoning = buildReasoning(recommendedTech, wo)

    return {
      id:               wo.id,
      wo_number:        wo.wo_number ?? `WO-${wo.id.slice(0, 6).toUpperCase()}`,
      title:            wo.title,
      customer_name:    wo.customer_name,
      job_type:         wo.job_type,
      priority:         wo.priority,
      status:           wo.status,
      scheduled_date:   wo.scheduled_date,
      already_assigned: !!wo.assignee_id,
      recommended_tech: recommendedTech
        ? { id: recommendedTech.id, name: recommendedTech.name, status: recommendedTech.status }
        : null,
      ai_score:    score,
      ai_reasoning: reasoning,
    }
  })

  return NextResponse.json({ work_orders: workOrders, total_techs: techs.length })
}
