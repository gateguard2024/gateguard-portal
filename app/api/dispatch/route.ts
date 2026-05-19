import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

const mapStatus = (s: string) => {
  if (s === 'open')        return 'Pending'
  if (s === 'in_progress') return 'In Progress'
  if (s === 'scheduled')   return 'Assigned'
  if (s === 'completed')   return 'Done'
  return 'Pending'
}

const mapPriority = (p: string) => {
  if (p === 'critical' || p === 'high') return 'urgent'
  if (p === 'normal')  return 'normal'
  return 'scheduled'
}

const mapTechStatus = (s: string) => {
  if (s === 'available') return 'Available'
  if (s === 'on_site')   return 'On Site'
  if (s === 'driving')   return 'Driving'
  return 'Offline'
}

// GET /api/dispatch — jobs + tech roster scoped to caller's org
export async function GET() {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  let jobQuery = supabase
    .from('work_orders')
    .select('id, wo_number, title, customer_name, job_type, assignee_id, assignee_name, priority, status, scheduled_date, due_date, site_id, created_at')
    .in('status', ['open', 'in_progress', 'scheduled', 'completed'])
    .order('created_at', { ascending: false })
    .limit(50)

  jobQuery = applyOrgScope(jobQuery, scope, 'org_id')

  let techQuery = supabase
    .from('technicians')
    .select('id, name, initials, role, status, current_job_id, phone, email, employment_type, can_access_portal, portal_invite_sent_at')
    .order('name')

  techQuery = applyOrgScope(techQuery, scope, 'org_id')

  const [jobsRes, techsRes] = await Promise.all([jobQuery, techQuery])

  if (jobsRes.error)  return NextResponse.json({ error: jobsRes.error.message },  { status: 500 })
  if (techsRes.error) return NextResponse.json({ error: techsRes.error.message }, { status: 500 })

  const jobs = (jobsRes.data ?? []).map(j => ({
    id:             j.id,
    property:       j.customer_name,
    jobType:        j.job_type,
    assignedTech:   j.assignee_name,
    assignedTechId: j.assignee_id,
    eta:            j.scheduled_date ?? 'TBD',
    priority:       mapPriority(j.priority),
    status:         mapStatus(j.status),
    woNumber:       j.wo_number,
    title:          j.title,
    site_id:        j.site_id,
  }))

  const techs = (techsRes.data ?? []).map(t => ({
    id:                   t.id,
    name:                 t.name,
    initials:             t.initials,
    role:                 t.role,
    status:               mapTechStatus(t.status),
    currentJobId:         t.current_job_id,
    employment_type:      t.employment_type ?? 'employee',
    can_access_portal:    t.can_access_portal ?? false,
    portal_invite_sent_at: t.portal_invite_sent_at ?? null,
    // Phone/email only sent if caller can view sensitive data
    phone:                user.canViewSensitive ? t.phone : null,
    email:                user.canViewSensitive ? t.email : null,
  }))

  return NextResponse.json({ jobs, techs })
}

// POST /api/dispatch — create job, auto-stamped with caller's org_id
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  const body = await req.json()

  const {
    customer_name, job_type = 'Repair', assignee_id, assignee_name,
    priority = 'normal', scheduled_date, notes, title, site_id,
  } = body

  if (!customer_name) {
    return NextResponse.json({ error: 'customer_name is required' }, { status: 400 })
  }

  const org_id = user.isCorporate ? (body.org_id ?? null) : (user.org_id ?? null)

  const { data, error } = await supabase
    .from('work_orders')
    .insert({
      title:          title || `${job_type} — ${customer_name}`,
      customer_name,
      job_type,
      assignee_id:    assignee_id ?? null,
      assignee_name:  assignee_name ?? null,
      priority,
      status:         assignee_id ? 'scheduled' : 'open',
      scheduled_date: scheduled_date ?? null,
      notes:          notes ?? null,
      site_id:        site_id ?? null,
      org_id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (data && assignee_id) {
    await supabase
      .from('technicians')
      .update({ current_job_id: data.id, status: 'on_site' })
      .eq('id', assignee_id)
  }

  return NextResponse.json({ job: data }, { status: 201 })
}
