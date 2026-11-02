import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyWOEvent, type WOEvent } from '@/lib/email'
import { notifyWOSMS, type SMSEvent } from '@/lib/sms'
import { guardSite, guardWorkOrder } from '@/lib/ops-scope'
import { getCurrentUser } from '@/lib/current-user'
import { isInScope, resolveOrgScope } from '@/lib/org-scope'

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

// Status → SMS event mapping (subset — not every status triggers SMS)
const SMS_EVENT: Record<string, SMSEvent | null> = {
  scheduled:   'scheduled',
  in_route:    'in_route',
  on_site:     'on_site',
  completed:   'completed',
  open:        null,
  in_progress: null,
  cancelled:   null,
}

// GET /api/maintenance/[id] — full detail with sub-data
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await guardWorkOrder(req, params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Fetch the core work order WITHOUT a sites join — this guarantees the WO
  // detail page always loads even when site_id is null or site columns are
  // not yet present in the DB. Site data is fetched separately below.
  const [woRes, checklistRes, commentsRes, partsRes, subWoRes] = await Promise.all([
    supabase.from('work_orders')
      .select('*')
      .eq('id', params.id)
      .single(),
    supabase.from('wo_checklist_items').select('*').eq('work_order_id', params.id).order('sort_order'),
    supabase.from('wo_comments').select('*').eq('work_order_id', params.id).order('created_at'),
    supabase.from('work_order_parts').select('*').eq('work_order_id', params.id).order('created_at'),
    supabase.from('work_orders').select('*').eq('parent_wo_id', params.id).order('created_at'),
  ])

  if (woRes.error || !woRes.data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const wo = woRes.data as Record<string, unknown>

  // Default site fields — all null if no site is linked or the lookup fails
  let siteFields: Record<string, unknown> = {
    site_address: null, site_city: null, site_state: null, site_zip: null,
    site_access_notes: null, site_pm_name: null, site_pm_email: null,
    site_pm_phone: null, site_contact_name: null, site_contact_email: null,
    site_contact_phone: null,
  }

  // Try to enrich with site data — failure is non-fatal
  const siteId = wo.site_id as string | null
  if (siteId) {
    try {
      const { data: site } = await supabase
        .from('sites')
        .select('address, city, state, zip, access_notes, pm_name, pm_email, pm_phone, primary_contact_name, primary_contact_email, primary_contact_phone')
        .eq('id', siteId)
        .single()

      if (site) {
        const s = site as Record<string, unknown>
        siteFields = {
          site_address:       s.address               ?? null,
          site_city:          s.city                  ?? null,
          site_state:         s.state                 ?? null,
          site_zip:           s.zip                   ?? null,
          site_access_notes:  s.access_notes          ?? null,
          site_pm_name:       s.pm_name               ?? null,
          site_pm_email:      s.pm_email              ?? null,
          site_pm_phone:      s.pm_phone              ?? null,
          site_contact_name:  s.primary_contact_name  ?? null,
          site_contact_email: s.primary_contact_email ?? null,
          site_contact_phone: s.primary_contact_phone ?? null,
        }
      }
    } catch (_) {
      // Site lookup failed — non-fatal, work order still loads without site data
    }
  }

  return NextResponse.json({
    work_order:      { ...wo, ...siteFields },
    checklist:       checklistRes.data ?? [],
    comments:        commentsRes.data  ?? [],
    parts_used:      partsRes.data     ?? [],
    sub_work_orders: subWoRes.data     ?? [],
  })
}

// PATCH /api/maintenance/[id] — update + send email notifications
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await guardWorkOrder(req, params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await req.json()

  // Fetch current WO so we can detect status changes (no join — avoids FK errors)
  const { data: current } = await supabase
    .from('work_orders')
    .select('*')
    .eq('id', params.id)
    .single()

  // Auto-set timestamps based on status
  if (body.status === 'completed' && !body.completed_at) {
    body.completed_at = new Date().toISOString()
  }
  if (body.status === 'on_site' && !body.arrived_at) {
    body.arrived_at = new Date().toISOString()
  }

  // Drift-resilient update: strip any key that isn't a real column (control flags
  // like send_notifications, or a new field before its migration runs) and retry,
  // so a patch never hard-fails on an unknown column.
  const upd: Record<string, unknown> = { ...body, updated_at: new Date().toISOString() }
  delete upd.send_notifications; delete upd.notify   // control flags, never columns
  // Never from the browser: identity / ownership columns. Only corporate may move a job between companies.
  for (const k of ['id', 'created_at', 'created_by', 'wo_number']) delete upd[k]
  const me = await getCurrentUser()
  if (!me.isCorporate) delete upd.org_id
  // A job can only be moved to a site the caller can see.
  if (body.site_id && !(await guardSite(req, String(body.site_id)))) return NextResponse.json({ error: 'That site isn’t one of yours.' }, { status: 400 })
  // A tech can only be assigned from the caller's own team.
  if (body.assignee_id && !me.isCorporate && me.id !== 'anonymous') {
    const scope = await resolveOrgScope(me)
    const { data: tech } = await supabase.from('technicians').select('id, org_id').eq('id', String(body.assignee_id)).maybeSingle()
    if (!tech || !isInScope(scope, (tech as { org_id: string | null }).org_id)) return NextResponse.json({ error: 'That technician isn’t on your team.' }, { status: 400 })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any = null; let error: { code?: string; message: string } | null = null
  for (let i = 0; i < 8; i++) {
    const res = await supabase.from('work_orders').update(upd).eq('id', params.id).select().single()
    data = res.data; error = res.error
    if (!error) break
    if (error.code === '42703' || error.code === 'PGRST204') {
      const m = /Could not find the '([a-z_]+)' column/i.exec(error.message) || /column "?([a-z_]+)"?/i.exec(error.message)
      const col = m?.[1]
      if (col && col in upd) { delete upd[col]; continue }
    }
    break
  }

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

  // A cancelled job is nobody's current job any more.
  if (body.status === 'cancelled') {
    const { error: tErr } = await supabase.from('technicians').update({ current_job_id: null }).eq('current_job_id', params.id)
    if (tErr) console.error('[maintenance] free tech on cancel failed:', tErr.message)
  }

  // When the job is completed, free the assigned tech back to "available"
  if (body.status === 'completed') {
    const freedTechId = (data as Record<string, unknown>).assignee_id ?? (current as Record<string, unknown> | null)?.assignee_id
    if (freedTechId) {
      await supabase
        .from('technicians')
        .update({ current_job_id: null, status: 'available' })
        .eq('id', freedTechId as string)
    }
  }

  // ── Email notification ────────────────────────────────────────────
  // Only fire when status actually changed, the new status has an event,
  // and the caller has not explicitly opted out (send_notifications defaults to true)
  const sendNotifications = body.send_notifications !== false   // default: true
  const statusChanged     = body.status && current && body.status !== current.status
  const emailEvent        = statusChanged ? STATUS_EVENT[body.status] : null
  // Try to get PM email from the linked site for email notifications
  let recipientEmail: string | null = null
  const currentSiteId = (current as Record<string, unknown> | null)?.site_id as string | null
  if (currentSiteId) {
    try {
      const { data: siteRow } = await supabase
        .from('sites')
        .select('pm_email, primary_contact_email')
        .eq('id', currentSiteId)
        .single()
      if (siteRow) {
        const sr = siteRow as { pm_email?: string; primary_contact_email?: string }
        recipientEmail = sr.pm_email ?? sr.primary_contact_email ?? null
      }
    } catch (_) { /* non-fatal */ }
  }

  // Every notification is awaited before we answer — a detached send is dropped
  // when the serverless function returns. Failures are logged, never block the save.
  const bg: Promise<unknown>[] = []
  if (sendNotifications && emailEvent && recipientEmail) {
    bg.push(notifyWOEvent({
      work_order_id:   params.id,
      wo_number:       data.wo_number,
      title:           data.title,
      customer_name:   data.customer_name,
      event:           emailEvent,
      recipient_email: recipientEmail,
      assignee_name:   data.assignee_name ?? undefined,
      scheduled_date:  data.scheduled_date ?? undefined,
      tech_eta:        data.tech_eta ?? undefined,
    }).catch(console.error))
  }

  // Also notify the assigned TECH — on a status change, or when they were just
  // assigned. Honors the same send_notifications opt-out.
  const justAssigned = body.assignee_id !== undefined && !!body.assignee_id
  if (sendNotifications && (emailEvent || justAssigned) && data.assignee_id) {
    bg.push((async () => {
      try {
        const { data: tech } = await supabase.from('technicians').select('email').eq('id', data.assignee_id).maybeSingle()
        const techEmail = (tech as { email?: string } | null)?.email
        if (techEmail) {
          await notifyWOEvent({
            work_order_id:   params.id,
            wo_number:       data.wo_number,
            title:           data.title,
            customer_name:   data.customer_name,
            event:           (emailEvent ?? 'scheduled') as WOEvent,
            recipient_email: techEmail,
            assignee_name:   data.assignee_name ?? undefined,
            scheduled_date:  data.scheduled_date ?? undefined,
            tech_eta:        data.tech_eta ?? undefined,
          })
        }
      } catch (e) { console.error('[maintenance PATCH] tech notify failed:', (e as Error).message) }
    })())
  }

  // ── SMS notification ──────────────────────────────────────────────────────
  // Pull PM phone from site — fire SMS in parallel with email
  const smsEvent = statusChanged ? SMS_EVENT[body.status] : null
  if (sendNotifications && smsEvent && currentSiteId) {
    bg.push((async () => {
      try {
        const { data: siteRow } = await supabase
          .from('sites')
          .select('pm_phone, primary_contact_phone, pm_name, name')
          .eq('id', currentSiteId)
          .single()
        const sr = siteRow as Record<string, unknown> | null
        const phone = (sr?.pm_phone ?? sr?.primary_contact_phone) as string | null
        if (phone) {
          await notifyWOSMS({
            event:          smsEvent,
            to:             phone,
            wo_number:      data.wo_number,
            title:          data.title,
            customer_name:  data.customer_name,
            tech_name:      data.assignee_name ?? undefined,
            scheduled_date: data.scheduled_date ?? undefined,
            tech_eta:       data.tech_eta ?? undefined,
            property_name:  sr?.name as string | undefined,
            // The review request goes out once, through /api/reviews/send below.
            review_url:     undefined,
          })
        }
      } catch (e) { console.error('[maintenance PATCH] SMS failed:', (e as Error).message) }
    })())
  }

  // ── Post-WO review trigger ────────────────────────────────────────────────
  // Fire review request SMS when WO is marked completed (non-blocking)
  if (sendNotifications && body.status === 'completed' && statusChanged) {
    bg.push((async () => {
      try {
        // Get PM phone from linked site if not already fetched
        let contactPhone: string | null = null
        let contactName:  string | null = null
        if (currentSiteId) {
          const { data: siteRow } = await supabase
            .from('sites')
            .select('pm_phone, primary_contact_phone, pm_name')
            .eq('id', currentSiteId)
            .single()
          const sr = siteRow as Record<string, unknown> | null
          contactPhone = (sr?.pm_phone ?? sr?.primary_contact_phone) as string | null
          contactName  = sr?.pm_name as string | null
        }

        await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/reviews/send`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            work_order_id:  params.id,
            org_id:         (current as Record<string, unknown> | null)?.org_id ?? null,
            technician_id:  data.assignee_id ?? null,
            reviewer_name:  contactName,
            reviewer_phone: contactPhone,
            wo_number:      data.wo_number,
            property_name:  data.customer_name,
          }),
        })
      } catch (e) { console.error('[maintenance PATCH] review request failed:', (e as Error).message) }
    })())
  }

  await Promise.allSettled(bg)
  return NextResponse.json({ work_order: data })
}

// DELETE /api/maintenance/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await guardWorkOrder(req, params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
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
