import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser, type PortalUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── Shared types ─────────────────────────────────────────────────────────────

type RouteContext = { params: { id: string } }

type LeadRecord = {
  id: string
  org_id: string | null
  assigned_to?: string | null
  contact_id?: string | null
  company_id?: string | null
  company_name?: string | null
  contact_name?: string | null
  location?: string | null
  stage?: string | null
  opportunity_id?: string | null
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

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

function leadLabel(lead: LeadRecord): string {
  return [lead.contact_name, lead.company_name || lead.location].filter(Boolean).join(' — ') || 'Lead'
}

// Resolve internal profiles.id UUID from Clerk user ID
// leads.assigned_to → profiles.id (UUID FK), NOT Clerk user ID
async function getProfileId(clerkUserId: string): Promise<string | null> {
  if (!clerkUserId || clerkUserId === 'system') return null
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', clerkUserId)
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

// Fetch lead with org-scope enforcement — uses resolveOrgScope + applyOrgScope
// Handles corporate (all), subtree (MSO/MA/SO), self-only (SP/SD)
// Auto-advancing lifecycle: reps' actions move the lead forward — no manual status change needed.
// New (created_at) → Contacted (contacted_at) → Info Sent (sent_info_at) → Visited (visited_at) → Converted (converted_at).
const LEAD_BUCKET_RANK: Record<string, number> = { identified: 0, contacted: 1, sent_info: 2, converted: 3 }
function leadBucket(stage: string | null | undefined): string {
  const v = String(stage ?? '').toLowerCase()
  if (/converted|won/.test(v)) return 'converted'
  if (/proposal|propose|sent|negoti/.test(v)) return 'sent_info'
  if (/contact|qualif/.test(v)) return 'contacted'
  return 'identified'
}
async function advanceLead(lead: { id: string; stage?: string | null; contacted_at?: string | null; sent_info_at?: string | null; lost_at?: string | null }, target: 'contacted' | 'sent_info') {
  if (lead.lost_at) return   // never auto-advance a lost/dead lead
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {}
  if (LEAD_BUCKET_RANK[target] > LEAD_BUCKET_RANK[leadBucket(lead.stage)]) patch.stage = target === 'contacted' ? 'contacted' : 'proposal'
  if (!lead.contacted_at) patch.contacted_at = now                       // contact is implied by reaching either milestone
  if (target === 'sent_info' && !lead.sent_info_at) patch.sent_info_at = now
  if (Object.keys(patch).length === 0) return
  patch.updated_at = now
  // Drift-resilient: skip timestamp cols an env may not have migrated yet.
  const { error } = await supabase.from('leads').update(patch).eq('id', lead.id)
  if (error && (String(error.code) === '42703' || /contacted_at|sent_info_at/.test(error.message ?? ''))) {
    delete patch.contacted_at; delete patch.sent_info_at
    if (Object.keys(patch).length > 1) await supabase.from('leads').update(patch).eq('id', lead.id)
  }
}

async function getScopedLead(
  leadId: string,
  user: PortalUser
): Promise<{ lead: LeadRecord | null; error?: string }> {
  const scope = await resolveOrgScope(user)

  // select('*') — NOT an explicit column list. Naming a column that isn't migrated
  // on an environment makes the whole SELECT fail (42703), which 500s the window and
  // it silently never opens. '*' returns whatever columns exist and can't break.
  let query = supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .is('deleted_at', null)              // soft-deleted leads live in Deleted Items — window returns 404

  query = applyOrgScope(query, scope)

  const { data, error } = await query.maybeSingle()
  if (error) return { lead: null, error: error.message }
  return { lead: data as LeadRecord | null }
}

// ─── GET — full lead glass data ───────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser()

  if (!user.canViewCRM) {
    return NextResponse.json({ success: false, message: 'CRM access denied.' }, { status: 403 })
  }

  const leadId = params.id
  const { lead, error } = await getScopedLead(leadId, user)

  if (error) {
    return NextResponse.json({ success: false, message: error }, { status: 500 })
  }

  if (!lead) {
    return NextResponse.json({ success: false, message: 'Lead not found or outside your access.' }, { status: 404 })
  }

  const leadRecord = lead

  const contact = leadRecord.contact_id
    ? await safe(
        supabase
          .from('contacts')
          .select('id, first_name, last_name, email, phone, title, is_primary, notes, company_id, type, created_at, updated_at')
          .eq('id', leadRecord.contact_id)
          .single(),
        null
      )
    : null

  // Legacy companies table retired (June 2026 audit); the lead's company is carried
  // on the lead itself (company_name). Accounts live in organizations.
  const company = null
  const companyRecord = company as { id?: string; name?: string | null } | null

  const contacts = companyRecord?.id
    ? await safe(
        supabase
          .from('contacts')
          .select('id, first_name, last_name, email, phone, title, is_primary, notes, company_id, type, created_at, updated_at')
          .eq('company_id', companyRecord.id)
          .order('is_primary', { ascending: false })
          .limit(12),
        []
      )
    : contact
      ? [contact]
      : []

  const companyName = companyRecord?.name || leadRecord.company_name || ''
  // Legacy company_properties + properties tables retired — properties live in sites.
  const properties: never[] = []

  // Sanitize for the .or() filter (addresses often contain commas, which break it).
  const propertySearch = String(leadRecord.location || companyName || '').replace(/[,()%*\\]/g, ' ').replace(/\s+/g, ' ').trim()
  const directProperties: never[] = []

  // Scope the related-site search to the caller's dealer orgs (it used to match
  // sites across every tenant by the lead's location string).
  const siteScope = await resolveOrgScope(user)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sites: any[] = []
  if (propertySearch) {
    let sitesQ = supabase
      .from('sites')
      .select('id, name, address, city, state, zip, property_type, units, status, primary_contact_name, primary_contact_email, primary_contact_phone, notes, created_at, updated_at')
      .or(`name.ilike.%${propertySearch}%,address.ilike.%${propertySearch}%`)
    if (!siteScope.all) {
      const ids = (siteScope.ids.length ? siteScope.ids : ['00000000-0000-0000-0000-000000000000']).join(',')
      sitesQ = sitesQ.or(`install_dealer_id.in.(${ids}),master_dealer_id.in.(${ids}),service_dealer_id.in.(${ids})`)
    }
    sites = await safe(sitesQ.limit(8), [])
  }

  // Activity is now a single table (crm_activities). `crmActivities` kept empty
  // for response-shape compatibility with the lead window UI.
  const activities = await safe(
    supabase
      .from('crm_activities')
      .select('id, type, subject, body, outcome, due_at, completed_at, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(20),
    []
  )
  const crmActivities: unknown[] = []

  const todos = await safe(
    supabase
      .from('todos')
      .select('id, title, body, priority, status, due_date, linked_type, linked_id, linked_label, created_at, updated_at')
      .eq('linked_type', 'lead')
      .eq('linked_id', leadId)
      .order('due_date', { ascending: true })
      .limit(20),
    []
  )

  const attachments = await safe(
    supabase
      .from('attachments')
      .select('id, file_name, url, file_type, size_bytes, type, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(20),
    []
  )

  const opportunities = await safe(
    supabase
      .from('opportunities')
      .select('id, name, stage, amount, est_mrr, account_name, management_co, property_address, property_city, property_state, next_step, created_at, updated_at')
      .or(`lead_id.eq.${leadId}${leadRecord.opportunity_id ? `,id.eq.${leadRecord.opportunity_id}` : ''}`)
      .order('updated_at', { ascending: false })
      .limit(12),
    []
  )

  const surveys = await safe(
    supabase
      .from('surveys')
      .select('id, survey_number, property_name, property_address, opportunity_id, surveyor_name, survey_date, ai_summary, ai_recommendations, photos, status, quote_id, created_at, updated_at')
      .or(`property_name.ilike.%${propertySearch || companyName}%,property_address.ilike.%${propertySearch || companyName}%`)
      .order('created_at', { ascending: false })
      .limit(10),
    []
  )

  return NextResponse.json({
    success: true,
    lead,
    people: { primaryContact: contact, contacts },
    company,
    properties: { linked: properties, possible: directProperties, sites },
    activity: { activities, crmActivities },
    todos,
    attachments,
    surveys,
    opportunities,
    nextBestActions: [
      { title: 'Log Call', subtitle: 'Capture what happened and update the timeline.', action: 'log_call' },
      { title: 'Schedule Follow-Up', subtitle: 'Create the next touch so the lead does not stall.', action: 'schedule_followup' },
      { title: 'Run ARIA', subtitle: 'Research the property or company before outreach.', action: 'run_aria' },
      { title: 'Create Opportunity', subtitle: 'Convert this lead into a real revenue opportunity.', action: 'create_opportunity' },
    ],
    canReassign: user.role === 'admin' || user.isCorporate,
  })
}

// ─── POST — lead workspace actions ───────────────────────────────────────────

export async function POST(req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser()

  if (!user.canViewCRM) {
    return NextResponse.json({ success: false, message: 'CRM access denied.' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const action = clean(body.action)

  const { lead, error } = await getScopedLead(params.id, user)

  if (error) {
    return NextResponse.json({ success: false, message: error }, { status: 500 })
  }

  if (!lead) {
    return NextResponse.json({ success: false, message: 'Lead not found or outside your access.' }, { status: 404 })
  }

  const profileId = await getProfileId(user.id)

  // ── add_note ────────────────────────────────────────────────────────────────
  if (action === 'add_note') {
    const note = clean(body.note ?? body.body ?? body.description)

    if (!note) {
      return NextResponse.json({ success: false, message: 'Tell Nexus what to remember.' }, { status: 400 })
    }

    const { data, error: insertError } = await supabase
      .from('crm_activities')
      .insert({
        dealer_org_id: lead.org_id,
        created_by: profileId,
        type: 'note',
        subject: 'Note added',
        body: note,
        lead_id: lead.id,
      })
      .select('id, type, subject, body, due_at, completed_at, created_at')
      .single()

    if (insertError) {
      return NextResponse.json({ success: false, message: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Note added.', activity: data })
  }

  // ── add_attachment ───────────────────────────────────────────────────────────
  if (action === 'add_attachment') {
    const fileName = clean(body.file_name)
    const url = clean(body.url)
    if (!fileName || !url) {
      return NextResponse.json({ success: false, message: 'Missing file.' }, { status: 400 })
    }
    const { data, error: insErr } = await supabase
      .from('attachments')
      .insert({
        dealer_org_id: lead.org_id,
        uploaded_by: profileId,
        file_name: fileName,
        url,
        file_type: clean(body.file_type) || null,
        size_bytes: typeof body.size_bytes === 'number' ? body.size_bytes : null,
        lead_id: lead.id,
      })
      .select('id, file_name, url, file_type, created_at')
      .single()
    if (insErr) {
      return NextResponse.json({ success: false, message: insErr.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, message: 'Attachment added.', attachment: data })
  }

  // ── log_call ────────────────────────────────────────────────────────────────
  if (action === 'log_call') {
    const summary = clean(body.summary ?? body.body ?? body.note)
    const outcome = clean(body.outcome)
    const duration = clean(body.duration)

    if (!summary) {
      return NextResponse.json({ success: false, message: 'What happened on the call?' }, { status: 400 })
    }

    const bodyText = [
      summary,
      outcome ? `Outcome: ${outcome}` : null,
      duration ? `Duration: ${duration}` : null,
    ].filter(Boolean).join('\n')

    const { data, error: insertError } = await supabase
      .from('crm_activities')
      .insert({
        dealer_org_id: lead.org_id,
        created_by: profileId,
        type: 'call',
        subject: 'Call logged',
        body: bodyText,
        lead_id: lead.id,
      })
      .select('id, type, subject, body, due_at, completed_at, created_at')
      .single()

    if (insertError) {
      return NextResponse.json({ success: false, message: insertError.message }, { status: 500 })
    }

    await advanceLead(lead as unknown as { id: string; stage?: string | null; contacted_at?: string | null; sent_info_at?: string | null }, 'contacted')
    return NextResponse.json({ success: true, message: 'Call logged.', activity: data })
  }

  // ── schedule_followup ───────────────────────────────────────────────────────
  if (action === 'log_visit') {
    const summary = clean(body.summary ?? body.body ?? body.note) || 'Site visit completed.'
    // Stamp the visit (drift-resilient: skip if column not migrated yet).
    const { error: stampErr } = await supabase.from('leads').update({ visited_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', lead.id)
    if (stampErr && !(String(stampErr.code) === '42703' || /visited_at/.test(stampErr.message ?? ''))) {
      return NextResponse.json({ success: false, message: stampErr.message }, { status: 500 })
    }
    const { error: logErr } = await supabase.from('crm_activities').insert({ dealer_org_id: lead.org_id, created_by: profileId, type: 'meeting', subject: 'Site visit', body: summary, lead_id: lead.id })
    if (logErr) return NextResponse.json({ success: false, message: logErr.message }, { status: 500 })
    return NextResponse.json({ success: true, message: 'Site visit logged.' })
  }

  if (action === 'schedule_followup') {
    const title = clean(body.title) || 'Follow up on lead'
    const notes = clean(body.body ?? body.notes)
    const dueDate = clean(body.due_date ?? body.dueDate)
    const priorityInput = clean(body.priority)
    const priority = ['high', 'normal', 'low'].includes(priorityInput) ? priorityInput : 'normal'

    const { data, error: todoError } = await supabase
      .from('todos')
      .insert({
        org_id: lead.org_id,
        title,
        body: notes || null,
        priority,
        status: 'open',
        due_date: dueDate || null,
        created_by: user.id,
        created_by_name: user.name,
        assigned_to: user.id,
        assigned_to_name: user.name,
        linked_type: 'lead',
        linked_id: lead.id,
        linked_label: leadLabel(lead),
      })
      .select('id, title, body, priority, status, due_date, linked_type, linked_id, linked_label, created_at, updated_at')
      .single()

    if (todoError) {
      return NextResponse.json({ success: false, message: todoError.message }, { status: 500 })
    }

    // Best-effort activity log for the follow-up
    await supabase.from('crm_activities').insert({
      dealer_org_id: lead.org_id,
      created_by: profileId,
      type: 'task',
      subject: 'Follow-up scheduled',
      body: [title, dueDate ? `Due: ${dueDate}` : null, notes].filter(Boolean).join('\n'),
      lead_id: lead.id,
      due_at: dueDate ? `${dueDate}T12:00:00.000Z` : null,
    })

    return NextResponse.json({ success: true, message: 'Follow-up scheduled.', todo: data })
  }

  // ── update_details ─────────────────────────────────────────────────────────
  if (action === 'update_details') {
    const fieldsMap: Record<string, unknown> = {}
    const contactName    = clean(body.contact_name)
    const companyName    = clean(body.company_name)
    const email          = clean(body.email)
    const phone          = clean(body.phone)
    const location       = clean(body.location)
    const propertyType   = clean(body.property_type)
    const notes          = clean(body.notes)
    const source         = clean(body.source)

    if (contactName)   fieldsMap.contact_name  = contactName
    if (companyName)   fieldsMap.company_name   = companyName
    if (email)         fieldsMap.email          = email
    if (phone)         fieldsMap.phone          = phone
    if (location)      fieldsMap.location       = location
    if (propertyType)  fieldsMap.property_type  = propertyType
    if (notes)         fieldsMap.notes          = notes
    if (source)        fieldsMap.source         = source

    const unitCountRaw = clean(body.unit_count)
    if (unitCountRaw) {
      const parsed = parseInt(unitCountRaw, 10)
      if (!isNaN(parsed)) fieldsMap.unit_count = parsed
    }

    // Structured interests — array of selected interest labels (replaces the set).
    if (Array.isArray(body.interests)) {
      fieldsMap.interests = (body.interests as unknown[]).map(v => String(v)).filter(Boolean)
    }

    // Lead sizing (Lead Analysis) — carries to the opportunity on convert.
    const asInt = (v: unknown) => { const n = parseInt(clean(v), 10); return isNaN(n) ? undefined : n }
    const asNum = (v: unknown) => { const n = parseFloat(clean(v)); return isNaN(n) ? undefined : n }
    const leadType = clean(body.lead_type); if (leadType) fieldsMap.lead_type = leadType
    const epv = asInt(body.entry_points); if (epv !== undefined) fieldsMap.entry_points = epv
    const camv = asInt(body.cameras);     if (camv !== undefined) fieldsMap.cameras = camv
    const mrrv = asNum(body.mrr);         if (mrrv !== undefined) fieldsMap.mrr = mrrv
    const pcrv = asNum(body.pcr);         if (pcrv !== undefined) fieldsMap.pcr = pcrv

    if (Object.keys(fieldsMap).length === 0) {
      return NextResponse.json({ success: false, message: 'No fields provided to update.' }, { status: 400 })
    }

    fieldsMap.updated_at = new Date().toISOString()

    // Drift-resilient: strip a not-yet-migrated column (e.g. interests) and retry.
    let updatedLead: Record<string, unknown> | null = null
    let updateError: { message?: string; code?: string } | null = null
    for (let attempt = 0; attempt < 6; attempt++) {
      const res = await supabase
        .from('leads')
        .update(fieldsMap)
        .eq('id', lead.id)
        .select('id, contact_name, company_name, contact_title, email, phone, location, property_type, unit_count, notes, source, stage, updated_at')
        .single()
      if (!res.error) { updatedLead = res.data as Record<string, unknown>; updateError = null; break }
      updateError = res.error
      const m = res.error.message ?? ''
      const missing = (res.error.code === '42703' || res.error.code === 'PGRST204') ? (m.match(/column "?([a-z_]+)"?/i)?.[1] || m.match(/'([a-z_]+)'/)?.[1]) : null
      if (missing && (missing in fieldsMap)) { delete fieldsMap[missing]; continue }
      break
    }

    if (updateError && !updatedLead) {
      return NextResponse.json({ success: false, message: updateError.message }, { status: 500 })
    }

    await supabase.from('crm_activities').insert({
      dealer_org_id: lead.org_id,
      created_by:    profileId,
      type:          'note',
      subject:       'Lead details updated',
      body:          `Details updated by ${user.name}: ${Object.keys(fieldsMap).filter(k => k !== 'updated_at').join(', ')}.`,
      lead_id:       lead.id,
    })

    return NextResponse.json({ success: true, message: 'Lead details saved.', lead: updatedLead })
  }

  // ── update_status ───────────────────────────────────────────────────────────
  if (action === 'send_info') {
    const note = clean(body.note ?? body.body) || 'Information sent to the prospect.'
    const { error } = await supabase.from('crm_activities').insert({ dealer_org_id: lead.org_id, created_by: profileId, type: 'email', subject: 'Information sent', body: note, lead_id: lead.id })
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 })
    await advanceLead(lead as unknown as { id: string; stage?: string | null; contacted_at?: string | null; sent_info_at?: string | null }, 'sent_info')
    return NextResponse.json({ success: true, message: 'Marked information sent — lead moved to Sent Info.' })
  }

  if (action === 'reassign_lead') {
    if (!(user.role === 'admin' || user.isCorporate)) {
      return NextResponse.json({ success: false, message: 'Only an administrator can reassign leads.' }, { status: 403 })
    }
    const assigneeId = clean(body.assignee_id)
    const assigneeName = clean(body.assignee_name)
    if (!assigneeId) return NextResponse.json({ success: false, message: 'Choose someone to assign this lead to.' }, { status: 400 })
    // assigneeId is a Clerk user id. assigned_to_user_id holds the Clerk id;
    // assigned_to holds profiles(id). Resolve the profile so both scoping paths
    // ("assigned to me" by Clerk id AND by profile id) find the lead.
    const { data: aprof } = await supabase.from('profiles').select('id').eq('clerk_user_id', assigneeId).maybeSingle()
    const assigneeProfileId = (aprof as { id?: string } | null)?.id ?? null
    const { error } = await supabase.from('leads').update({
      assigned_to: assigneeProfileId,
      assigned_to_user_id: assigneeId,
      assigned_to_name: assigneeName || null,
      updated_at: new Date().toISOString(),
    }).eq('id', lead.id)
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 })
    await supabase.from('crm_activities').insert({ dealer_org_id: lead.org_id, created_by: profileId, type: 'note', subject: 'Lead reassigned', body: `Assigned to ${assigneeName || assigneeId}.`, lead_id: lead.id })
    return NextResponse.json({ success: true, message: `Lead assigned to ${assigneeName || 'the selected user'}.` })
  }

  if (action === 'update_status') {
    const stage = clean(body.stage)

    const allowedStages = [
      'prospect', 'new', 'contacted', 'qualified', 'qualifying',
      'proposal', 'negotiation', 'converted', 'won', 'lost', 'dead',
    ]

    if (!allowedStages.includes(stage)) {
      return NextResponse.json({ success: false, message: 'Choose a valid lead status.' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {
      stage,
      updated_at: new Date().toISOString(),
    }

    if (stage === 'converted') updates.converted_at = new Date().toISOString()
    if (stage === 'won')       updates.won_at       = new Date().toISOString()
    if (stage === 'lost' || stage === 'dead') updates.lost_at = new Date().toISOString()

    // First-entry stage timestamps → time-in-stage reporting (never overwrite the first touch).
    const Lrec = lead as unknown as Record<string, unknown>
    const bucket = /proposal|propose|sent|negoti/.test(stage) ? 'sentInfo' : /contact|qualif/.test(stage) ? 'contacted' : 'identified'
    const nowIso = new Date().toISOString()
    if ((bucket === 'contacted' || bucket === 'sentInfo') && !Lrec.contacted_at) updates.contacted_at = nowIso
    if (bucket === 'sentInfo' && !Lrec.sent_info_at) updates.sent_info_at = nowIso

    // Moving BACKWARD must reset the milestone bar so it reflects the new stage
    // (the bar is timestamp-driven; without this, "contacted → new" looks stuck).
    const RANK: Record<string, number> = { prospect: 0, new: 0, contacted: 1, qualified: 1, qualifying: 1, proposal: 2, negotiation: 2, converted: 4, won: 5 }
    const curRank = RANK[String(Lrec.stage ?? '').toLowerCase()] ?? 0
    const tgtRank = RANK[stage] ?? 0
    if (tgtRank < curRank && stage !== 'lost' && stage !== 'dead') {
      if (tgtRank < 1) updates.contacted_at = null
      if (tgtRank < 2) updates.sent_info_at = null
      if (tgtRank < 3) updates.visited_at = null
      if (tgtRank < 4) updates.converted_at = null
    }

    const { data, error: updateError } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', lead.id)
      .select('id, stage, updated_at, converted_at, won_at, lost_at')
      .single()

    if (updateError) {
      return NextResponse.json({ success: false, message: updateError.message }, { status: 500 })
    }

    await supabase.from('crm_activities').insert({
      dealer_org_id: lead.org_id,
      created_by: profileId,
      type: 'note',
      subject: 'Status updated',
      body: `Lead moved to ${stage}.`,
      lead_id: lead.id,
    })

    return NextResponse.json({ success: true, message: 'Status updated.', lead: data })
  }

  // ── create_opportunity ─────────────────────────────────────────────────────
  if (action === 'create_opportunity') {
    // Prevent duplicate: check lead.opportunity_id + any open opp with this lead_id
    if (lead.opportunity_id) {
      const { data: existingOpp } = await supabase
        .from('opportunities')
        .select('id, name, stage, est_mrr, account_name, created_at, updated_at')
        .eq('id', lead.opportunity_id)
        .maybeSingle()
      if (existingOpp) {
        return NextResponse.json({
          success: true,
          message: 'Opportunity already exists for this lead.',
          opportunity: existingOpp,
          opportunityId: existingOpp.id,
          lead,
          existing: true,
        })
      }
    }

    // Also check by lead_id in case opportunity_id on lead was never set
    const { data: existingByLeadId } = await supabase
      .from('opportunities')
      .select('id, name, stage, est_mrr, account_name, created_at, updated_at')
      .eq('lead_id', lead.id)
      .is('lost_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingByLeadId) {
      // Backfill lead — awaited so the lifecycle transition is committed before response
      if (!lead.opportunity_id) {
        const { error: linkError } = await supabase
          .from('leads')
          .update({
            opportunity_id: existingByLeadId.id,
            converted_at:   new Date().toISOString(),
            stage:          'converted',
            updated_at:     new Date().toISOString(),
          })
          .eq('id', lead.id)
        if (linkError) {
          return NextResponse.json({ success: false, message: linkError.message }, { status: 500 })
        }
      }
      return NextResponse.json({
        success: true,
        message: 'Opportunity already exists for this lead.',
        opportunity: existingByLeadId,
        opportunityId: existingByLeadId.id,
        lead,
        existing: true,
      })
    }

    // Generate a meaningful opportunity name
    const oppName = lead.company_name
      ? `${lead.company_name} — GateGuard Opportunity`
      : lead.location
        ? `${lead.location} — GateGuard Opportunity`
        : lead.contact_name
          ? `${lead.contact_name} — GateGuard Opportunity`
          : 'New GateGuard Opportunity'

    const optionalName = clean(body.name)
    const optionalNextStep = clean(body.next_step)

    // Insert opportunity carrying ALL lead context forward.
    const L = lead as Record<string, unknown>
    const oppPayload: Record<string, unknown> = {
      dealer_org_id:       lead.org_id,
      lead_id:             lead.id,
      contact_id:          lead.contact_id ?? null,
      company_id:          lead.company_id ?? null,
      rep_id:              profileId,
      name:                optionalName || oppName,
      stage:               'inquiry',
      notes:               L.notes ?? null,
      source:              L.source ?? null,
      account_name:        lead.company_name ?? L.property_name ?? null,
      management_co:       lead.company_name ?? null,
      property_address:    L.property_name ? `${L.property_name}${lead.location ? ` — ${lead.location}` : ''}` : lead.location ?? null,
      property_city:       L.city ?? null,
      property_state:      L.state ?? null,
      site_contact_name:   lead.contact_name ?? null,
      site_contact_title:  L.contact_title ?? null,
      site_contact_phone:  L.phone ?? null,
      site_contact_email:  L.email ?? null,
      units:               L.unit_count ?? null,
      vehicle_gates:       L.entry_points ?? null,
      new_cameras:         L.cameras ?? null,
      est_mrr:             L.mrr ?? null,
      property_type:       L.property_type ?? null,
      interests:           L.interests ?? null,
      next_step:           optionalNextStep || 'Schedule discovery call',
      assigned_from_lead:  lead.id,
    }

    // Drift-resilient insert: if a column doesn't exist yet (pre-migration),
    // strip it and retry rather than failing the whole conversion.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let newOpp: any = null
    let oppError: { message?: string; code?: string } | null = null
    for (let attempt = 0; attempt < 8; attempt++) {
      const res = await supabase
        .from('opportunities')
        .insert(oppPayload)
        .select('id, name, stage, est_mrr, amount, account_name, next_step, created_at, updated_at')
        .single()
      if (!res.error) { newOpp = res.data; oppError = null; break }
      oppError = res.error
      const m = res.error.message ?? ''
      const missing = (res.error.code === '42703' || res.error.code === 'PGRST204') ? (m.match(/column "?([a-z_]+)"?/i)?.[1] || m.match(/'([a-z_]+)' column/i)?.[1]) : null
      if (missing && missing in oppPayload) { delete oppPayload[missing]; continue }
      break
    }

    if (oppError || !newOpp) {
      return NextResponse.json({ success: false, message: oppError?.message ?? 'Could not create opportunity.' }, { status: 500 })
    }

    // Update lead — awaited: lifecycle transition must commit before we respond
    const { data: updatedLead, error: leadUpdateError } = await supabase
      .from('leads')
      .update({
        stage:          'converted',
        converted_at:   new Date().toISOString(),
        opportunity_id: newOpp.id,
        updated_at:     new Date().toISOString(),
      })
      .eq('id', lead.id)
      .select('id, stage, converted_at, opportunity_id, updated_at')
      .single()

    if (leadUpdateError) {
      return NextResponse.json({ success: false, message: leadUpdateError.message }, { status: 500 })
    }

    // Log conversion activity — awaited: must be committed before response
    const { error: activityError } = await supabase
      .from('crm_activities')
      .insert({
        dealer_org_id:  lead.org_id,
        created_by:     profileId,
        type:           'note',
        subject:        'Opportunity created',
        body:           'Nexus converted this lead into an opportunity.',
        lead_id:        lead.id,
        opportunity_id: newOpp.id,
      })

    if (activityError) {
      return NextResponse.json({ success: false, message: activityError.message }, { status: 500 })
    }

    // ── Carry the lead's history forward ─────────────────────────────────────
    // Re-link (non-destructive: keep lead_id, add opportunity_id) so every note,
    // call, email and file the lead already had now shows on the opportunity too.
    // Best-effort: a relink failure must never block the conversion.
    let carried = { crm_activities: 0, attachments: 0 }
    try {
      const relink = async (table: string) => {
        const { data, error: relinkErr } = await supabase
          .from(table)
          .update({ opportunity_id: newOpp.id })
          .eq('lead_id', lead.id)
          .is('opportunity_id', null)
          .select('id')
        return relinkErr ? 0 : (data?.length ?? 0)
      }
      const [c, at] = await Promise.all([
        relink('crm_activities'),
        relink('attachments'),
      ])
      carried = { crm_activities: c, attachments: at }
    } catch { /* non-blocking */ }

    return NextResponse.json({
      success: true,
      message: 'Opportunity created.',
      opportunity: newOpp,
      opportunityId: newOpp.id,
      lead: updatedLead,
      carried,
    })
  }

  return NextResponse.json({ success: false, message: 'Unknown lead action.' }, { status: 400 })
}
