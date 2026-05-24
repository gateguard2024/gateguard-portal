import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyWOEvent, type WOEvent } from '@/lib/email'
import { notifyWOSMS, type SMSEvent } from '@/lib/sms'

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
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
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
    supabase.from('wo_parts_used').select('*').eq('work_order_id', params.id).order('created_at'),
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

  // ── SMS notification ──────────────────────────────────────────────────────
  // Pull PM phone from site — fire SMS in parallel with email
  const smsEvent = statusChanged ? SMS_EVENT[body.status] : null
  if (sendNotifications && smsEvent && currentSiteId) {
    void (async () => {
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
            review_url:     smsEvent === 'completed'
              ? `https://g.page/r/gateguard/review`
              : undefined,
          })
        }
      } catch (_) { /* non-fatal */ }
    })()
  }

  // ── Post-WO review trigger ────────────────────────────────────────────────
  // Fire review request SMS when WO is marked completed (non-blocking)
  if (body.status === 'completed' && statusChanged) {
    void (async () => {
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
      } catch (_) { /* non-fatal */ }
    })()
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
