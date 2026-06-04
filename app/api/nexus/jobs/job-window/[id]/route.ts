import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser, type PortalUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type RouteContext = { params: { id: string } }

type JobRecord = Record<string, unknown> & {
  id: string
  org_id: string | null
  wo_number?: string | null
  title?: string | null
  due_date?: string | null
}

async function safe<T>(promise: PromiseLike<{ data: T | null; error: unknown }>, fallback: T): Promise<T> {
  try {
    const { data, error } = await promise
    if (error || !data) return fallback
    return data
  } catch {
    return fallback
  }
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'NX'
}

function jobLabel(job: JobRecord): string {
  return [job.wo_number, job.title].filter(Boolean).join(' — ') || 'Job'
}

async function getScopedJob(jobId: string, user: PortalUser): Promise<{ job: JobRecord | null; error?: string }> {
  const scope = await resolveOrgScope(user)

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

  // TODO: Install contractor visibility needs a contractor-org assignment field.
  // Live schema has org_id, assigned_to, and assignee_id only. Stage 2 scopes by org_id.
  jobQuery = applyOrgScope(jobQuery, scope)

  const { data, error } = await jobQuery.maybeSingle()
  if (error) return { job: null, error: error.message }
  return { job: data as JobRecord | null }
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser()

  if (!user.canViewWOs) {
    return NextResponse.json({ success: false, message: 'Work order access denied.' }, { status: 403 })
  }

  const jobId = params.id
  const { job, error } = await getScopedJob(jobId, user)

  if (error) {
    return NextResponse.json({ success: false, message: error }, { status: 500 })
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

export async function POST(req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser()

  if (!user.canViewWOs) {
    return NextResponse.json({ success: false, message: 'Work order access denied.' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const action = clean(body.action)
  const { job, error } = await getScopedJob(params.id, user)

  if (error) {
    return NextResponse.json({ success: false, message: error }, { status: 500 })
  }

  if (!job) {
    return NextResponse.json({ success: false, message: 'Job not found or outside your access.' }, { status: 404 })
  }

  const authorName = user.name || 'Nexus User'
  const authorInitials = initials(authorName)

  if (action === 'add_note') {
    const note = clean(body.note ?? body.content ?? body.body)
    if (!note) {
      return NextResponse.json({ success: false, message: 'Tell Nexus what to remember.' }, { status: 400 })
    }

    const { data, error: insertError } = await supabase
      .from('wo_comments')
      .insert({ work_order_id: job.id, author_name: authorName, author_initials: authorInitials, content: note })
      .select('id, author_name, author_initials, content, created_at')
      .single()

    if (insertError) {
      return NextResponse.json({ success: false, message: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Note added.', note: data })
  }

  if (action === 'create_task') {
    const title = clean(body.title)
    const notes = clean(body.notes ?? body.body)
    const dueDate = clean(body.due_date ?? body.dueDate)
    const priorityInput = clean(body.priority)
    const priority = ['high', 'normal', 'low'].includes(priorityInput) ? priorityInput : 'normal'

    if (!title) {
      return NextResponse.json({ success: false, message: 'What needs to get done?' }, { status: 400 })
    }

    const { data, error: taskError } = await supabase
      .from('todos')
      .insert({
        org_id: job.org_id,
        title,
        body: notes || null,
        priority,
        status: 'open',
        due_date: dueDate || null,
        created_by: user.id,
        created_by_name: authorName,
        assigned_to: user.id,
        assigned_to_name: authorName,
        linked_type: 'work_order',
        linked_id: job.id,
        linked_label: jobLabel(job),
      })
      .select('id, title, body, priority, status, due_date, linked_type, linked_id, linked_label, created_at, updated_at')
      .single()

    if (taskError) {
      return NextResponse.json({ success: false, message: taskError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Task created.', task: data })
  }

  if (action === 'schedule_visit') {
    const scheduledDate = clean(body.scheduled_date ?? body.scheduledDate)
    const note = clean(body.note ?? body.notes)

    if (!scheduledDate) {
      return NextResponse.json({ success: false, message: 'Pick a visit date.' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {
      scheduled_date: scheduledDate,
      status: 'scheduled',
      updated_at: new Date().toISOString(),
    }

    if (!job.due_date) updates.due_date = scheduledDate

    const { data, error: updateError } = await supabase
      .from('work_orders')
      .update(updates)
      .eq('id', job.id)
      .select('id, wo_number, title, status, scheduled_date, due_date, updated_at')
      .single()

    if (updateError) {
      return NextResponse.json({ success: false, message: updateError.message }, { status: 500 })
    }

    if (note) {
      const content = `Visit scheduled for ${scheduledDate}. ${note}`
      const { error: noteError } = await supabase
        .from('wo_comments')
        .insert({ work_order_id: job.id, author_name: authorName, author_initials: authorInitials, content })
      if (noteError) {
        return NextResponse.json({ success: false, message: noteError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, message: 'Visit scheduled.', job: data })
  }

  if (action === 'mark_complete') {
    const note = clean(body.note ?? body.notes)

    const { data, error: updateError } = await supabase
      .from('work_orders')
      .update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', job.id)
      .select('id, wo_number, title, status, completed_at, updated_at')
      .single()

    if (updateError) {
      return NextResponse.json({ success: false, message: updateError.message }, { status: 500 })
    }

    if (note) {
      const { error: noteError } = await supabase
        .from('wo_comments')
        .insert({ work_order_id: job.id, author_name: authorName, author_initials: authorInitials, content: `Job completed. ${note}` })
      if (noteError) {
        return NextResponse.json({ success: false, message: noteError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, message: 'Job marked complete.', job: data })
  }

  return NextResponse.json({ success: false, message: 'Unknown job action.' }, { status: 400 })
}
