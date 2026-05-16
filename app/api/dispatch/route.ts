import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/dispatch — returns today's jobs (open/in_progress/assigned) + full tech roster
export async function GET() {
  const [jobsRes, techsRes] = await Promise.all([
    supabase
      .from('work_orders')
      .select('id, wo_number, title, customer_name, job_type, assignee_id, assignee_name, priority, status, scheduled_date, due_date, created_at')
      .in('status', ['open', 'in_progress', 'scheduled', 'completed'])
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('technicians')
      .select('id, name, initials, role, status, current_job_id, phone, email')
      .order('name'),
  ])

  if (jobsRes.error)  return NextResponse.json({ error: jobsRes.error.message },  { status: 500 })
  if (techsRes.error) return NextResponse.json({ error: techsRes.error.message }, { status: 500 })

  // Map DB statuses to dispatch board statuses
  const mapStatus = (s: string) => {
    if (s === 'open')        return 'Pending'
    if (s === 'in_progress') return 'In Progress'
    if (s === 'scheduled')   return 'Assigned'
    if (s === 'completed')   return 'Done'
    return 'Pending'
  }

  const mapPriority = (p: string) => {
    if (p === 'urgent') return 'urgent'
    if (p === 'high')   return 'urgent'
    if (p === 'medium') return 'normal'
    return 'scheduled'
  }

  const jobs = (jobsRes.data ?? []).map(j => ({
    id:           j.id,
    property:     j.customer_name,
    jobType:      j.job_type,
    assignedTech: j.assignee_name,
    assignedTechId: j.assignee_id,
    eta:          j.scheduled_date ?? 'TBD',
    priority:     mapPriority(j.priority),
    status:       mapStatus(j.status),
    woNumber:     j.wo_number,
    title:        j.title,
  }))

  const mapTechStatus = (s: string) => {
    if (s === 'available') return 'Available'
    if (s === 'on_site')   return 'On Site'
    if (s === 'driving')   return 'Driving'
    return 'Offline'
  }

  const techs = (techsRes.data ?? []).map(t => ({
    id:          t.id,
    name:        t.name,
    initials:    t.initials,
    role:        t.role,
    status:      mapTechStatus(t.status),
    currentJobId: t.current_job_id,
    phone:       t.phone,
    email:       t.email,
  }))

  return NextResponse.json({ jobs, techs })
}

// POST /api/dispatch — create a new job (same as maintenance POST but dispatch-aware)
export async function POST(req: NextRequest) {
  const body = await req.json()

  const {
    customer_name, job_type = 'Repair', assignee_id, assignee_name,
    priority = 'medium', scheduled_date, notes, title,
  } = body

  if (!customer_name) {
    return NextResponse.json({ error: 'customer_name is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('work_orders')
    .insert({
      title:          title || `${job_type} — ${customer_name}`,
      customer_name,
      job_type,
      assignee_id:    assignee_id || null,
      assignee_name:  assignee_name || null,
      priority,
      status:         assignee_id ? 'scheduled' : 'open',
      scheduled_date: scheduled_date || null,
      notes:          notes || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update tech's current job if assigned
  if (data && assignee_id) {
    await supabase
      .from('technicians')
      .update({ current_job_id: data.id, status: 'on_site' })
      .eq('id', assignee_id)
  }

  return NextResponse.json({ job: data }, { status: 201 })
}
