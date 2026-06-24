import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope, getProfileId } from '@/lib/org-scope'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type RouteContext = { params: { id: string } }

async function safe<T>(
  promise: PromiseLike<{ data: T | null; error: unknown }>,
  fallback: T
): Promise<T> {
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

  if (!user.canViewCRM) {
    return NextResponse.json({ success: false, message: 'CRM access denied.' }, { status: 403 })
  }

  const scope = await resolveOrgScope(user)
  const oppId = params.id

  // Fetch opportunity scoped by dealer_org_id
  let oppQuery = supabase
    .from('opportunities')
    .select(`
      id, dealer_org_id, lead_id, contact_id, company_id, property_id,
      rep_id, quote_id, name, stage, est_setup, est_mrr, amount,
      close_date, lost_reason, notes, won_at, lost_at, created_at, updated_at,
      opp_type, probability, forecast_cat, next_step, description,
      owner_name, owner_initials, account_name, management_co, owner_entity,
      property_address, property_city, property_state, property_zip,
      site_contact_name, site_contact_title, site_contact_phone, site_contact_email,
      units, source, assigned_from_lead, site_id, site_counts, interests, property_type
    `)
    .eq('id', oppId)
  oppQuery = applyOrgScope(oppQuery, scope, 'dealer_org_id')

  const { data: opp, error: oppError } = await oppQuery.maybeSingle()

  if (oppError) {
    return NextResponse.json({ success: false, message: oppError.message }, { status: 500 })
  }

  if (!opp) {
    return NextResponse.json(
      { success: false, message: 'Opportunity not found or outside your access.' },
      { status: 404 }
    )
  }

  const opportunity = opp as Record<string, unknown>

  // Fetch all related data in parallel
  const [
    lead,
    company,
    contact,
    property,
    activities,
    todos,
    attachments,
    quote,
  ] = await Promise.all([
    // Lead
    opportunity.lead_id
      ? safe(
          supabase
            .from('leads')
            .select('id, contact_name, company_name, location, stage, source, notes, created_at, updated_at, email, phone, unit_count')
            .eq('id', opportunity.lead_id as string)
            .single(),
          null
        )
      : Promise.resolve(null),

    // Company — legacy companies table retired (June 2026 audit); accounts live in organizations.
    Promise.resolve(null),

    // Contact
    opportunity.contact_id
      ? safe(
          supabase
            .from('contacts')
            .select('id, first_name, last_name, email, phone, title, is_primary')
            .eq('id', opportunity.contact_id as string)
            .single(),
          null
        )
      : Promise.resolve(null),

    // Property — legacy properties table retired (June 2026 audit); properties live in sites.
    Promise.resolve(null),

    // Activities — single canonical table (crm_activities).
    safe(
      supabase
        .from('crm_activities')
        .select('id, type, subject, body, outcome, due_at, completed_at, created_at')
        .eq('opportunity_id', oppId)
        .order('created_at', { ascending: false })
        .limit(30),
      []
    ),

    // Todos
    safe(
      supabase
        .from('todos')
        .select('id, title, body, priority, status, due_date, linked_type, linked_id, linked_label, created_at, updated_at')
        .eq('linked_type', 'opportunity')
        .eq('linked_id', oppId)
        .order('due_date', { ascending: true })
        .limit(20),
      []
    ),

    // Attachments
    safe(
      supabase
        .from('attachments')
        .select('id, file_name, url, file_type, size_bytes, type, created_at')
        .eq('opportunity_id', oppId)
        .order('created_at', { ascending: false })
        .limit(20),
      []
    ),

    // Quote (if linked)
    opportunity.quote_id
      ? safe(
          supabase
            .from('quotes')
            .select('id, status, total, mrr_total, created_at, updated_at')
            .eq('id', opportunity.quote_id as string)
            .single(),
          null
        )
      : Promise.resolve(null),
  ])

  // Activity is now a single table (crm_activities) read above — no second source to merge.
  const crmActivities: unknown[] = []
  const mergedActivities = [...(activities as any[]), ...(crmActivities as any[])] // eslint-disable-line @typescript-eslint/no-explicit-any
    .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))

  return NextResponse.json({
    success: true,
    opportunity,
    lead,
    company,
    contact,
    property,
    activities: mergedActivities,
    todos,
    attachments,
    quote,
    nextBestActions: [
      { title: 'Edit Details',       subtitle: 'Fix contact, property, interests.',   action: 'update_details' },
      { title: 'Schedule Follow-Up', subtitle: 'Create the next touch.',              action: 'schedule_followup' },
      { title: 'Mark Won',          subtitle: 'Move this opportunity to won.',        action: 'mark_won' },
      { title: 'Mark Lost',         subtitle: 'Close this out with a reason.',        action: 'mark_lost' },
    ],
  })
}

// ─── POST — opportunity workspace actions ────────────────────────────────────
const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export async function POST(req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser()
  if (!user.canViewCRM) {
    return NextResponse.json({ success: false, message: 'CRM access denied.' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const action = clean(body.action)
  const oppId = params.id

  // Confirm the opportunity is in the caller's scope before any write.
  const scope = await resolveOrgScope(user)
  let scopeQuery = supabase.from('opportunities').select('id, dealer_org_id').eq('id', oppId)
  scopeQuery = applyOrgScope(scopeQuery, scope, 'dealer_org_id')
  const { data: opp, error: scopeErr } = await scopeQuery.maybeSingle()
  if (scopeErr) return NextResponse.json({ success: false, message: scopeErr.message }, { status: 500 })
  if (!opp) {
    return NextResponse.json({ success: false, message: 'Opportunity not found or outside your access.' }, { status: 404 })
  }

  const profileId = await getProfileId(user.id)

  // ── add_attachment ──────────────────────────────────────────────────────────
  if (action === 'add_attachment') {
    const fileName = clean(body.file_name)
    const url = clean(body.url)
    if (!fileName || !url) {
      return NextResponse.json({ success: false, message: 'Missing file.' }, { status: 400 })
    }
    const { data, error: insErr } = await supabase
      .from('attachments')
      .insert({
        dealer_org_id: (opp as Record<string, unknown>).dealer_org_id,
        uploaded_by: profileId,
        file_name: fileName,
        url,
        file_type: clean(body.file_type) || null,
        size_bytes: typeof body.size_bytes === 'number' ? body.size_bytes : null,
        opportunity_id: oppId,
      })
      .select('id, file_name, url, file_type, size_bytes, created_at')
      .single()
    if (insErr) return NextResponse.json({ success: false, message: insErr.message }, { status: 500 })
    return NextResponse.json({ success: true, message: 'Attachment added.', attachment: data })
  }

  // ── remove_attachment ─────────────────────────────────────────────────────
  if (action === 'remove_attachment') {
    const attachmentId = clean(body.attachment_id)
    if (!attachmentId) return NextResponse.json({ success: false, message: 'Missing attachment id.' }, { status: 400 })
    const { error: delErr } = await supabase
      .from('attachments')
      .delete()
      .eq('id', attachmentId)
      .eq('opportunity_id', oppId)   // scope: only this opportunity's files
    if (delErr) return NextResponse.json({ success: false, message: delErr.message }, { status: 500 })
    return NextResponse.json({ success: true, message: 'Attachment removed.' })
  }

  // ── update_details — save contact / property / interests on the opportunity ──
  if (action === 'update_details') {
    const map: Record<string, unknown> = {}
    const set = (key: string, v: unknown) => { const s = typeof v === 'string' ? v.trim() : v; if (s !== undefined && s !== '') map[key] = s }
    // Contact (the reported save bug) — write the canonical denormalized fields.
    set('site_contact_name',  body.site_contact_name ?? body.contact_name)
    set('site_contact_title', body.site_contact_title ?? body.contact_title)
    set('site_contact_phone', body.site_contact_phone ?? body.phone)
    set('site_contact_email', body.site_contact_email ?? body.email)
    // Account / property
    set('account_name',    body.account_name)
    set('management_co',   body.management_co)
    set('property_address', body.property_address ?? body.location)
    set('property_city',   body.property_city)
    set('property_state',  body.property_state)
    set('property_type',   body.property_type)
    set('next_step',       body.next_step)
    set('notes',           body.notes)
    if (body.units !== undefined && body.units !== '') { const n = parseInt(String(body.units), 10); if (!isNaN(n)) map.units = n }
    if (body.amount !== undefined && body.amount !== '') { const n = Number(body.amount); if (!isNaN(n)) map.amount = n }
    if (body.est_mrr !== undefined && body.est_mrr !== '') { const n = Number(body.est_mrr); if (!isNaN(n)) map.est_mrr = n }
    if (Array.isArray(body.interests)) map.interests = (body.interests as unknown[]).map(v => String(v)).filter(Boolean)

    if (Object.keys(map).length === 0) return NextResponse.json({ success: false, message: 'No fields provided to update.' }, { status: 400 })
    map.updated_at = new Date().toISOString()

    // Drift-resilient: strip a not-yet-migrated column and retry rather than failing.
    let updated: Record<string, unknown> | null = null
    let updErr: { message?: string; code?: string } | null = null
    for (let attempt = 0; attempt < 8; attempt++) {
      const res = await supabase.from('opportunities').update(map).eq('id', oppId).select('id, updated_at').single()
      if (!res.error) { updated = res.data as Record<string, unknown>; updErr = null; break }
      updErr = res.error
      const m = res.error.message ?? ''
      const missing = (res.error.code === '42703' || res.error.code === 'PGRST204') ? (m.match(/column "?([a-z_]+)"?/i)?.[1] || m.match(/'([a-z_]+)'/)?.[1]) : null
      if (missing && (missing in map)) { delete map[missing]; continue }
      break
    }
    if (updErr && !updated) return NextResponse.json({ success: false, message: updErr.message }, { status: 500 })

    void supabase.from('crm_activities').insert({ dealer_org_id: (opp as Record<string, unknown>).dealer_org_id, created_by: profileId, type: 'note', subject: 'Opportunity details updated', body: `Updated: ${Object.keys(map).filter(k => k !== 'updated_at').join(', ')}.`, opportunity_id: oppId })
    return NextResponse.json({ success: true, message: 'Opportunity details saved.' })
  }

  // ── mark_won / mark_lost / update_status ────────────────────────────────────
  if (action === 'mark_won' || action === 'mark_lost' || action === 'update_status') {
    const stage = action === 'mark_won' ? 'won' : action === 'mark_lost' ? 'lost' : clean(body.stage)
    if (!stage) return NextResponse.json({ success: false, message: 'No stage provided.' }, { status: 400 })
    const patch: Record<string, unknown> = { stage, updated_at: new Date().toISOString() }
    if (action === 'mark_lost' && clean(body.reason)) patch.lost_reason = clean(body.reason)
    const { error: upErr } = await supabase.from('opportunities').update(patch).eq('id', oppId)
    if (upErr) {
      // lost_reason may not exist — retry without it.
      if (patch.lost_reason) { delete patch.lost_reason; const r2 = await supabase.from('opportunities').update(patch).eq('id', oppId); if (r2.error) return NextResponse.json({ success: false, message: r2.error.message }, { status: 500 }) }
      else return NextResponse.json({ success: false, message: upErr.message }, { status: 500 })
    }
    void supabase.from('crm_activities').insert({ dealer_org_id: (opp as Record<string, unknown>).dealer_org_id, created_by: profileId, type: 'note', subject: `Opportunity ${stage}`, body: `Stage changed to ${stage}.`, opportunity_id: oppId })
    return NextResponse.json({ success: true, message: `Opportunity marked ${stage}.`, stage })
  }

  // ── schedule_followup — add a to-do tied to this opportunity ─────────────────
  if (action === 'schedule_followup') {
    const title = clean(body.title) || 'Follow up on opportunity'
    const dueDate = clean(body.due_date)
    const { data, error: tErr } = await supabase.from('todos').insert({
      dealer_org_id: (opp as Record<string, unknown>).dealer_org_id,
      created_by: profileId,
      type: 'task',
      title,
      body: [clean(body.notes), dueDate ? `Due: ${dueDate}` : null].filter(Boolean).join('\n') || null,
      status: 'open',
      due_date: dueDate || null,
      linked_type: 'opportunity',
      linked_id: oppId,
    }).select('id, title, due_date').single()
    if (tErr) return NextResponse.json({ success: false, message: tErr.message }, { status: 500 })
    return NextResponse.json({ success: true, message: 'Follow-up scheduled.', todo: data })
  }

  return NextResponse.json({ success: false, message: 'Unknown opportunity action.' }, { status: 400 })
}
