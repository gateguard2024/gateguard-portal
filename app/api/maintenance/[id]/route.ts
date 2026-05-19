import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyWOEvent, type WOEvent } from '@/lib/email'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Status → email event mapping
const STATUS_EVENT: Record<string, WOEvent | null> = {
  scheduled:   'scheduled',
  in_route:    'in_route',
  on_site:     'on_site',
  completed:   'completed',
  open:        null,
  in_progress: null,
  cancelled:   null,
}

// GET /api/maintenance/[id] — full detail with sub-data
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const [woRes, checklistRes, commentsRes, partsRes, subWoRes] = await Promise.all([
    // Join to sites to pull address + access_notes for the tech
    supabase.from('work_orders')
      .select('*, site:sites(id, name, address, city, state, zip, access_notes, pm_name, pm_email, pm_phone, primary_contact_name, primary_contact_email, primary_contact_phone)')
      .eq('id', params.id)
      .single(),
    supabase.from('wo_checklist_items').select('*').eq('work_order_id', params.id).order('sort_order'),
    supabase.from('wo_comments').select('*').eq('work_order_id', params.id).order('created_at'),
    supabase.from('wo_parts_used').select('*').eq('work_order_id', params.id).order('created_at'),
    supabase.from('work_orders').select('*').eq('parent_wo_id', params.id).order('created_at'),
  ])

  if (woRes.error || !woRes.data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Flatten site fields onto work_order for easy frontend consumption
  const wo = woRes.data as Record<string, unknown>
  const site = wo.site as Record<string, unknown> | null
  const work_order = {
    ...wo,
    // Expose site address fields at top level so frontend doesn't need deep access
    site_address:      site?.address      ?? null,
    site_city:         site?.city         ?? null,
    site_state:        site?.state        ?? null,
    site_zip:          site?.zip          ?? null,
    site_access_notes: site?.access_notes ?? null,
    site_pm_name:      site?.pm_name      ?? null,
    site_pm_email:     site?.pm_email     ?? null,
    site_pm_phone:     site?.pm_phone     ?? null,
    site_contact_name:  site?.primary_contact_name  ?? null,
    site_contact_email: site?.primary_contact_email ?? null,
    site_contact_phone: site?.primary_contact_phone ?? null,
  }

  return NextResponse.json({
    work_order,
    checklist:       checklistRes.data ?? [],
    comments:        commentsRes.data  ?? [],
    parts_used:      partsRes.data     ?? [],
    sub_work_orders: subWoRes.data     ?? [],
  })
}

// PATCH /api/maintenance/[id] — update + send email notifications
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()

  // Fetch current WO so we can detect status changes
  const { data: current } = await supabase
    .from('work_orders')
    .select('*, sites(primary_contact_email, pm_email, name)')
    .eq('id', params.id)
    .single()

  // Auto-set timestamps based on status
  if (body.status === 'completed' && !body.completed_at) {
    body.completed_at = new Date().toISOString()
  }
  if (body.status === 'on_site' && !body.arrived_at) {
    body.arrived_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('work_orders')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Update technician's current_job_id if assignee changed
  if (body.assignee_id !== undefined) {
    await supabase
      .from('technicians')
      .update({ current_job_id: null })
      .eq('current_job_id', params.id)
      .neq('id', body.assignee_id || '00000000-0000-0000-0000-000000000000')

    if (body.assignee_id) {
      await supabase
        .from('technicians')
        .update({ current_job_id: params.id })
        .eq('id', body.assignee_id)
    }
  }

  // ── Email notification ────────────────────────────────────────────
  // Only fire when status actually changed, the new status has an event,
  // and the caller has not explicitly opted out (send_notifications defaults to true)
  const sendNotifications = body.send_notifications !== false   // default: true
  const statusChanged     = body.status && current && body.status !== current.status
  const emailEvent        = statusChanged ? STATUS_EVENT[body.status] : null
  const site              = current?.sites as { primary_contact_email?: string; pm_email?: string; name?: string } | null

  // Prefer PM email, fall back to primary contact email
  const recipientEmail = site?.pm_email ?? site?.primary_contact_email ?? null

  if (sendNotifications && emailEvent && recipientEmail) {
    // Fire and forget — don't block response
    notifyWOEvent({
      work_order_id:   params.id,
      wo_number:       data.wo_number,
      title:           data.title,
      customer_name:   data.customer_name,
      event:           emailEvent,
      recipient_email: recipientEmail,
      assignee_name:   data.assignee_name ?? undefined,
      scheduled_date:  data.scheduled_date ?? undefined,
      tech_eta:        data.tech_eta ?? undefined,
    }).catch(console.error)
  }

  return NextResponse.json({ work_order: data })
}

// DELETE /api/maintenance/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await supabase
    .from('technicians')
    .update({ current_job_id: null })
    .eq('current_job_id', params.id)

  const { error } = await supabase
    .from('work_orders')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
