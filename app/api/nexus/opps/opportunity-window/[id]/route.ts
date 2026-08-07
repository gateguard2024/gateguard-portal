import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope, getProfileId, applyAssignedScope } from '@/lib/org-scope'

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

  // Fetch opportunity scoped by dealer_org_id.
  // select('*') — naming a not-yet-migrated column makes the SELECT 500 and the
  // window silently never opens. '*' returns whatever columns exist and can't break.
  let oppQuery = supabase
    .from('opportunities')
    .select('*')
    .eq('id', oppId)
  oppQuery = applyOrgScope(oppQuery, scope, 'dealer_org_id')
  // Axis 2 — a plain "user" (rep) may only open opportunities assigned to them.
  // Admin/supervisor/corporate are unrestricted. Fails closed if no profile id.
  const getProfile = await getProfileId(user.id)
  oppQuery = applyAssignedScope(oppQuery, user.role, { clerkUserId: user.id, profileId: getProfile }, 'opportunities')

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
            .is('deleted_at', null)              // hide soft-deleted (in Deleted Items)
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
        .select(// email_status is required: without it the UI cannot tell a delivered email from
// a failed one, so a bounced send rendered identically to a sent one.
'id, type, subject, body, outcome, due_at, completed_at, created_at, email_status')
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

    // Attachments (flat list + category; the UI groups into the five buckets)
    safe(
      supabase
        .from('attachments')
        .select('id, file_name, url, file_type, size_bytes, type, category, created_at')
        .eq('opportunity_id', oppId)
        .order('created_at', { ascending: false })
        .limit(200),
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
    canReassign: user.role === 'admin' || user.isCorporate,
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
    // Which of the five buckets this file belongs to. Anything unexpected falls
    // back to 'document' so a bad value can never reject the upload.
    const ATTACH_CATEGORIES = ['quote_survey', 'survey_photo', 'document', 'install_photo', 'service_photo']
    const category = ATTACH_CATEGORIES.includes(String(body.category)) ? String(body.category) : 'document'
    const insertRow: Record<string, unknown> = {
      dealer_org_id: (opp as Record<string, unknown>).dealer_org_id,
      uploaded_by: profileId,
      file_name: fileName,
      url,
      file_type: clean(body.file_type) || null,
      size_bytes: typeof body.size_bytes === 'number' ? body.size_bytes : null,
      opportunity_id: oppId,
      category,
    }
    let { data, error: insErr } = await supabase
      .from('attachments')
      .insert(insertRow)
      .select('id, file_name, url, file_type, size_bytes, category, created_at')
      .single()
    // Drift-safe: if the category column isn't deployed yet, retry without it.
    if (insErr && (insErr.code === '42703' || insErr.code === 'PGRST204')) {
      delete insertRow.category
      ;({ data, error: insErr } = await supabase
        .from('attachments')
        .insert(insertRow)
        .select('id, file_name, url, file_type, size_bytes, created_at')
        .single())
    }
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

  // ── rename_attachment ───────────────────────────────────────────────────────
  if (action === 'rename_attachment') {
    const attachmentId = clean(body.attachment_id)
    const newName = clean(body.file_name)
    if (!attachmentId || !newName) return NextResponse.json({ success: false, message: 'Missing id or name.' }, { status: 400 })
    const { data, error: renErr } = await supabase
      .from('attachments')
      .update({ file_name: newName })
      .eq('id', attachmentId)
      .eq('opportunity_id', oppId)   // scope: only this opportunity's files
      .select('id, file_name')
      .single()
    if (renErr) return NextResponse.json({ success: false, message: renErr.message }, { status: 500 })
    return NextResponse.json({ success: true, message: 'Renamed.', attachment: data })
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
    if (body.close_date !== undefined) map.close_date = clean(body.close_date) || null
    if (body.units !== undefined && body.units !== '') { const n = parseInt(String(body.units), 10); if (!isNaN(n)) map.units = n }
    if (body.amount !== undefined && body.amount !== '') { const n = Number(body.amount); if (!isNaN(n)) map.amount = n }
    if (body.est_mrr !== undefined && body.est_mrr !== '') { const n = Number(body.est_mrr); if (!isNaN(n)) map.est_mrr = n }
    // Deal-value fields for TCV forecasting (drift-safe: stripped if not migrated).
    if (body.install_fee !== undefined && body.install_fee !== '') { const n = Number(body.install_fee); if (!isNaN(n)) map.install_fee = n }
    if (body.contract_term !== undefined && body.contract_term !== '') { const n = parseInt(String(body.contract_term), 10); if (!isNaN(n)) map.contract_term = n }
    // Managing admin (oversees the rep on this deal). Person, not property mgmt co.
    if (body.manager_id !== undefined) map.manager_id = clean(body.manager_id) || null
    if (body.manager_name !== undefined) map.manager_name = clean(body.manager_name) || null
    // Manually-attached quote (stopgap until the quote builder is locked in).
    if (body.quote_url !== undefined) map.quote_url = clean(body.quote_url) || null
    if (body.quote_status !== undefined) map.quote_status = clean(body.quote_status) || null
    if (body.quote_total !== undefined && body.quote_total !== '') { const n = Number(body.quote_total); if (!isNaN(n)) map.quote_total = n }
    if (Array.isArray(body.interests)) map.interests = (body.interests as unknown[]).map(v => String(v)).filter(Boolean)

    if (Object.keys(map).length === 0) return NextResponse.json({ success: false, message: 'No fields provided to update.' }, { status: 400 })
    map.updated_at = new Date().toISOString()

    // Drift-resilient: strip a not-yet-migrated column and retry rather than
    // failing. Track what we drop so the caller can tell the user the truth
    // instead of a blanket "saved ✓".
    const dropped: string[] = []
    let updated: Record<string, unknown> | null = null
    let updErr: { message?: string; code?: string } | null = null
    for (let attempt = 0; attempt < 8; attempt++) {
      const res = await supabase.from('opportunities').update(map).eq('id', oppId).select('id, updated_at').single()
      if (!res.error) { updated = res.data as Record<string, unknown>; updErr = null; break }
      updErr = res.error
      const m = res.error.message ?? ''
      const missing = (res.error.code === '42703' || res.error.code === 'PGRST204') ? (m.match(/column "?([a-z_]+)"?/i)?.[1] || m.match(/'([a-z_]+)'/)?.[1]) : null
      if (missing && (missing in map)) { delete map[missing]; dropped.push(missing); continue }
      break
    }
    if (updErr && !updated) return NextResponse.json({ success: false, message: updErr.message }, { status: 500 })

    await supabase.from('crm_activities').insert({ dealer_org_id: (opp as Record<string, unknown>).dealer_org_id, created_by: profileId, type: 'note', subject: 'Opportunity details updated', body: `Updated: ${Object.keys(map).filter(k => k !== 'updated_at').join(', ')}.`, opportunity_id: oppId })
    return NextResponse.json({
      success: true,
      message: dropped.length ? `Saved — but ${dropped.length} field(s) couldn't be stored yet.` : 'Opportunity details saved.',
      dropped,
    })
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
    await supabase.from('crm_activities').insert({ dealer_org_id: (opp as Record<string, unknown>).dealer_org_id, created_by: profileId, type: 'note', subject: `Opportunity ${stage}`, body: `Stage changed to ${stage}.`, opportunity_id: oppId })
    return NextResponse.json({ success: true, message: `Opportunity marked ${stage}.`, stage })
  }

  // ── schedule_followup — add a to-do tied to this opportunity ─────────────────
  if (action === 'schedule_followup') {
    const title = clean(body.title) || 'Follow up on opportunity'
    const dueDate = clean(body.due_date)
    // `todos` has `org_id` — NOT `dealer_org_id` — and has no `type` column at
    // all (migrations 023 + 024). Both were being inserted, so this route
    // returned 500 on every call with no drift-retry to save it.
    const todoRow: Record<string, unknown> = {
      org_id: (opp as Record<string, unknown>).dealer_org_id,
      created_by: user.id,
      title,
      body: [clean(body.notes), dueDate ? `Due: ${dueDate}` : null].filter(Boolean).join('\n') || null,
      status: 'open',
      due_date: dueDate || null,
      linked_type: 'opportunity',
      linked_id: oppId,
    }
    // Assign the task to a teammate to assist (defaults to unassigned = creator).
    if (clean(body.assigned_to)) todoRow.assigned_to = clean(body.assigned_to)
    if (clean(body.assigned_to_name)) todoRow.assigned_to_name = clean(body.assigned_to_name)
    // Drift-safe insert — strip a not-yet-migrated column and retry.
    let todo: Record<string, unknown> | null = null
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await supabase.from('todos').insert(todoRow).select('id, title, due_date').single()
      if (!res.error) { todo = res.data as Record<string, unknown>; break }
      const m = res.error.message ?? ''
      const missing = (res.error.code === '42703' || res.error.code === 'PGRST204') ? (m.match(/column "?([a-z_]+)"?/i)?.[1] || m.match(/'([a-z_]+)'/)?.[1]) : null
      if (missing && (missing in todoRow)) { delete todoRow[missing]; continue }
      return NextResponse.json({ success: false, message: res.error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, message: 'Follow-up scheduled.', todo })
  }

  if (action === 'reassign_opp') {
    if (!(user.role === 'admin' || user.isCorporate)) {
      return NextResponse.json({ success: false, message: 'Only an administrator can reassign opportunities.' }, { status: 403 })
    }
    const assigneeId = clean(body.assignee_id)
    const assigneeName = clean(body.assignee_name)
    if (!assigneeId) return NextResponse.json({ success: false, message: 'Choose someone to assign this deal to.' }, { status: 400 })
    // Subtree guard: a non-corporate admin may only reassign to a user inside
    // their own org scope. (Defense in depth — the assignee picker is already
    // org-scoped.) Only rejects when the target's org is known and out of scope.
    if (!scope.all) {
      const { data: ap } = await supabase.from('profiles').select('org_id').eq('clerk_user_id', assigneeId).maybeSingle()
      const targetOrg = ap?.org_id ? String(ap.org_id) : null
      if (targetOrg && !scope.ids.includes(targetOrg)) {
        return NextResponse.json({ success: false, message: 'That user is outside your organization.' }, { status: 403 })
      }
    }
    const assigneeProfileId = await getProfileId(assigneeId)
    const initials = (assigneeName || '').split(/\s+/).map((w: string) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
    const { error } = await supabase.from('opportunities').update({
      rep_id: assigneeProfileId || null,
      owner_name: assigneeName || null,
      owner_initials: initials || null,
      updated_at: new Date().toISOString(),
    }).eq('id', oppId)
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 })
    await supabase.from('crm_activities').insert({ dealer_org_id: (opp as Record<string, unknown>).dealer_org_id, created_by: profileId, type: 'note', subject: 'Opportunity reassigned', body: `Assigned to ${assigneeName || assigneeId}.`, opportunity_id: oppId })
    return NextResponse.json({ success: true, message: `Opportunity assigned to ${assigneeName || 'the selected user'}.` })
  }

  // ── log_activity — add a call / email / note / meeting to the timeline ───────
  if (action === 'log_activity') {
    const type = ['call', 'email', 'meeting', 'note'].includes(String(body.type)) ? String(body.type) : 'note'
    const subject = clean(body.subject)
    if (!subject) return NextResponse.json({ success: false, message: 'Add a short summary.' }, { status: 400 })
    const row: Record<string, unknown> = {
      dealer_org_id: (opp as Record<string, unknown>).dealer_org_id,
      created_by: profileId,
      type, subject,
      body: clean(body.body) || null,
      opportunity_id: oppId,
    }
    if (clean(body.outcome)) row.outcome = clean(body.outcome)
    if (clean(body.due_at)) row.due_at = clean(body.due_at)
    if (typeof body.duration_mins === 'number') row.duration_mins = body.duration_mins
    // Drift-resilient insert (some deployments lack outcome/due_at/duration cols).
    let inserted: Record<string, unknown> | null = null
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await supabase.from('crm_activities').insert(row).select('*').single()
      if (!res.error) { inserted = res.data as Record<string, unknown>; break }
      const m = res.error.message ?? ''
      const missing = (res.error.code === '42703' || res.error.code === 'PGRST204') ? (m.match(/column "?([a-z_]+)"?/i)?.[1] || m.match(/'([a-z_]+)'/)?.[1]) : null
      if (missing && (missing in row)) { delete row[missing]; continue }
      return NextResponse.json({ success: false, message: res.error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, message: 'Activity logged.', activity: inserted })
  }

  return NextResponse.json({ success: false, message: 'Unknown opportunity action.' }, { status: 400 })
}
