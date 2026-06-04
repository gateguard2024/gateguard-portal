import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type RouteContext = { params: { id: string } }

async function safe<T>(promise: PromiseLike<{ data: T | null; error: unknown }>, fallback: T): Promise<T> {
  try {
    const { data, error } = await promise
    if (error || !data) return fallback
    return data
  } catch {
    return fallback
  }
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser()

  if (!user.canViewWOs) {
    return NextResponse.json({ success: false, message: 'Work order access denied.' }, { status: 403 })
  }

  const scope = await resolveOrgScope(user)
  const jobId = params.id

  let jobQuery = supabase
    .from('work_orders')
    .select(`
      id, wo_number, org_id, client_org_id, property_id, site_id, device_id,
      created_by, assigned_to, assignee_id, assignee_name,
      title, description, priority, status, job_type, category,
      customer_name, notes, location,
      parent_wo_id, estimated_hours,
      scheduled_date, due_date, completed_at, created_at, updated_at
    `)
    .eq('id', jobId)
  jobQuery = applyOrgScope(jobQuery, scope)

  const { data: job, error: jobError } = await jobQuery.maybeSingle()

  if (jobError) {
    return NextResponse.json({ success: false, message: jobError.message }, { status: 500 })
  }

  if (!job) {
    return NextResponse.json({ success: false, message: 'Job not found or outside your access.' }, { status: 404 })
  }

  const jobRecord = job as Record<string, unknown>

  const [site, assignedProfile, tasks, checklist, notes, parts, files, subWorkOrders, fieldTickets, timeEntries] = await Promise.all([
    jobRecord.site_id
      ? safe(
          supabase
            .from('sites')
            .select('id, name, address, city, state, zip, property_type, units, status, primary_contact_name, primary_contact_email, primary_contact_phone, notes')
            .eq('id', jobRecord.site_id as string)
            .single(),
          null
        )
      : Promise.resolve(null),
    jobRecord.assigned_to
      ? safe(
          supabase
            .from('profiles')
            .select('id, first_name, last_name, email, phone, role')
            .eq('id', jobRecord.assigned_to as string)
            .single(),
          null
        )
      : Promise.resolve(null),
    safe(
      supabase
        .from('todos')
        .select('id, title, body, priority, status, due_date, linked_type, linked_id, linked_label, created_at, updated_at')
        .eq('linked_type', 'work_order')
        .eq('linked_id', jobId)
        .order('due_date', { ascending: true })
        .limit(20),
      []
    ),
    safe(
      supabase
        .from('wo_checklist_items')
        .select('id, title, completed, completed_at, completed_by, sort_order, created_at')
        .eq('work_order_id', jobId)
        .order('sort_order', { ascending: true })
        .limit(30),
      []
    ),
    safe(
      supabase
        .from('wo_comments')
        .select('id, author_name, author_initials, content, created_at')
        .eq('work_order_id', jobId)
        .order('created_at', { ascending: false })
        .limit(20),
      []
    ),
    safe(
      supabase
        .from('wo_parts_used')
        .select('id, part_name, part_number, quantity, unit_cost, created_at')
        .eq('work_order_id', jobId)
        .limit(20),
      []
    ),
    safe(
      supabase
        .from('attachments')
        .select('id, file_name, url, file_type, size_bytes, type, created_at')
        .eq('work_order_id', jobId)
        .order('created_at', { ascending: false })
        .limit(20),
      []
    ),
    safe(
      supabase
        .from('work_orders')
        .select('id, wo_number, title, status, priority, assignee_name, scheduled_date, due_date, created_at')
        .eq('parent_wo_id', jobId)
        .order('created_at', { ascending: false })
        .limit(10),
      []
    ),
    safe(
      supabase
        .from('field_tickets')
        .select('id, status, created_at, updated_at')
        .eq('work_order_id', jobId)
        .order('created_at', { ascending: false })
        .limit(5),
      []
    ),
    safe(
      supabase
        .from('work_order_time_entries')
        .select('id, tech_name, hours_worked, notes, date_worked, created_at')
        .eq('work_order_id', jobId)
        .order('date_worked', { ascending: false })
        .limit(10),
      []
    ),
  ])

  const profile = assignedProfile as Record<string, unknown> | null
  const assignedTeam = profile
    ? [{
        id: profile.id,
        name: [profile.first_name, profile.last_name].filter(Boolean).join(' ') || String(jobRecord.assignee_name ?? 'Assigned'),
        role: String(profile.role ?? 'technician'),
        email: profile.email,
        phone: profile.phone,
      }]
    : jobRecord.assignee_name
      ? [{ name: String(jobRecord.assignee_name), role: 'technician' }]
      : []

  return NextResponse.json({
    success: true,
    job,
    site,
    customer: jobRecord.customer_name ? { name: String(jobRecord.customer_name) } : null,
    assignedTeam,
    tasks,
    checklist,
    notes,
    parts,
    files,
    subWorkOrders,
    fieldTickets,
    timeEntries,
    nextBestActions: [
      { title: 'Add Note', subtitle: 'Capture what happened or what is next.', action: 'add_note' },
      { title: 'Assign Team', subtitle: 'Add a technician to this job.', action: 'assign_team' },
      { title: 'Schedule Visit', subtitle: 'Set a date for the next site visit.', action: 'schedule_visit' },
      { title: 'Create Task', subtitle: 'Add a to-do item for this job.', action: 'create_task' },
      { title: 'Upload File', subtitle: 'Attach a photo, doc, or drawing.', action: 'upload_file' },
      { title: 'Mark Complete', subtitle: 'Close this job when work is done.', action: 'mark_complete' },
    ],
  })
}
