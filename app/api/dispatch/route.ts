import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'
import { notifyWOEvent } from '@/lib/email'

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
    .select('id, name, initials, role, status, current_job_id, phone, email, employment_type, can_access_portal, portal_invite_sent_at, schedule')
    .order('name')

  // Technicians may have org_id = NULL (legacy/unscoped records).
  // Include both org-scoped techs AND those with no org assigned so the roster
  // is never empty due to a missing org_id on existing tech records.
  if (!scope.all && scope.ids.length > 0) {
    const idList = scope.ids.join(',')
    techQuery = (techQuery as any).or(`org_id.in.(${idList}),org_id.is.null`) as typeof techQuery
  }

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
    schedule:             t.schedule ?? null,
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
    customer_name, job_type = 'Repair', assignee_id, assignee_name, assigned_to,
    priority = 'normal', scheduled_date, notes, title, site_id, due_date,
    opportunity_id, description,
  } = body

  // A "task" is a general work item — no site/customer needed, just a title
  // (and optionally a tech). Everything else still needs a customer.
  const isTask = job_type === 'task' || (!site_id && !customer_name)
  const resolvedCustomer = customer_name || (isTask ? 'General Task' : null)
  if (!title && !resolvedCustomer) {
    return NextResponse.json({ error: 'customer_name is required' }, { status: 400 })
  }

  const org_id = user.isCorporate ? (body.org_id ?? null) : (user.org_id ?? null)

  // ── assigned_to vs assignee_id — DIFFERENT TABLES. Do not conflate. ──────────
  //   work_orders.assigned_to → profiles(id)     (migration 001)
  //   work_orders.assignee_id → technicians(id)  (migration 011)
  //
  // This used to be `const owner = assigned_to ?? assignee_id` written to BOTH
  // columns. Picking a technician therefore shoved a technicians.id into a
  // column whose FK points at profiles, and Postgres rejected the whole insert:
  //   violates foreign key constraint "work_orders_assigned_to_fkey"
  // Creating a work order with a tech assigned was impossible.
  //
  // A technician is linked to a login via technicians.clerk_user_id, and a
  // profile is found by profiles.clerk_user_id. So resolve tech → profile
  // rather than assuming the two ids are interchangeable.
  let ownerProfileId: string | null = assigned_to ?? null
  if (!ownerProfileId && assignee_id) {
    const { data: tech } = await supabase
      .from('technicians')
      .select('clerk_user_id')
      .eq('id', assignee_id)
      .maybeSingle()
    const clerkId = (tech as { clerk_user_id?: string } | null)?.clerk_user_id
    if (clerkId) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('id')
        .eq('clerk_user_id', clerkId)
        .maybeSingle()
      ownerProfileId = (prof as { id?: string } | null)?.id ?? null
    }
  }
  // A tech with no portal login has no profile. That is normal and must NOT
  // block the job — leave assigned_to null; assignee_id still records the tech.
  const techId: string | null = assignee_id ?? null

  // Drift-resilient insert: opportunity_id/description need migration 124.
  // If a column isn't present yet, strip it and retry rather than failing.
  let row: Record<string, unknown> = {
    title:          title || `${job_type} — ${resolvedCustomer}`,
    customer_name:  resolvedCustomer,
    job_type,
    assigned_to:    ownerProfileId,   // profiles(id) — the portal login, or null
    assignee_id:    techId,           // technicians(id) — the person doing the work
    assignee_name:  assignee_name ?? null,
    priority,
    status:         scheduled_date ? 'scheduled' : 'open',  // New until it actually has a date
    scheduled_date: scheduled_date ?? null,
    due_date:       due_date ?? null,
    notes:          notes ?? null,
    description:    description ?? notes ?? null,
    site_id:        site_id ?? null,
    opportunity_id: opportunity_id ?? null,
    org_id,
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let error: any = null
  for (let i = 0; i < 4; i++) {
    const res = await supabase.from('work_orders').insert(row).select().single()
    data = res.data; error = res.error
    if (!error) break
    const m = /Could not find the '(\w+)' column|column "?(\w+)"? .* does not exist/.exec(error.message)
    const bad = m?.[1] || m?.[2]
    // Never strip the scoping column — a work order written with org_id = NULL
    // is invisible to the dealer who created it (applyOrgScope filters on it)
    // and would leak into corporate's unfiltered view. Fail loudly instead.
    if (bad === 'org_id') break
    if ((error.code === 'PGRST204' || error.code === '42703') && bad && bad in row) { delete row[bad]; continue }
    // 23503 = foreign key violation. One bad id sinks the whole row, so drop the
    // *link* rather than the job: the person still gets their work order, just
    // unassigned, and the message says so in plain words.
    if (error.code === '23503' && /assigned_to/.test(error.message) && row.assigned_to) {
      row.assigned_to = null; continue
    }
    break
  }

  if (error) {
    // Plain-English errors — a raw Postgres constraint name means nothing to
    // whoever is trying to book a job.
    const friendly =
      error.code === '23503' && /assignee_id/.test(error.message)
        ? 'That technician no longer exists. Pick someone else and try again.'
        : error.code === '23503' && /site_id/.test(error.message)
        ? 'That site could not be found. Pick the site again and try again.'
        : error.code === '23503' && /org_id/.test(error.message)
        ? 'This job has no valid company attached. Tell an admin — your account may not be linked to a company yet.'
        : error.message
    return NextResponse.json({ error: friendly }, { status: 500 })
  }

  if (data && assignee_id) {
    await supabase
      .from('technicians')
      .update({ current_job_id: data.id, status: 'on_site' })
      .eq('id', assignee_id)

    // Email the assigned tech about the new ticket — unless the creator opted out.
    if (body.notify !== false) {
      try {
        const { data: tech } = await supabase.from('technicians').select('email, name').eq('id', assignee_id).maybeSingle()
        const techEmail = (tech as { email?: string } | null)?.email
        if (techEmail) {
          await notifyWOEvent({
            work_order_id:   data.id,
            wo_number:       data.wo_number ?? '',
            title:           data.title ?? '',
            customer_name:   data.customer_name ?? '',
            event:           'created',
            recipient_email: techEmail,
            assignee_name:   data.assignee_name ?? (tech as { name?: string } | null)?.name ?? undefined,
            scheduled_date:  data.scheduled_date ?? undefined,
          })
        }
      } catch (e) { console.error('[dispatch] tech notify failed:', (e as Error).message) }
    }
  }

  return NextResponse.json({ job: data }, { status: 201 })
}
