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
async function getScopedLead(
  leadId: string,
  user: PortalUser
): Promise<{ lead: LeadRecord | null; error?: string }> {
  const scope = await resolveOrgScope(user)

  let query = supabase
    .from('leads')
    .select('id, org_id, assigned_to, company_name, contact_name, email, phone, property_type, unit_count, location, stage, source, notes, created_at, updated_at, contact_id, company_id, opportunity_id')
    .eq('id', leadId)

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

  const company = leadRecord.company_id
    ? await safe(
        supabase
          .from('companies')
          .select('id, name, type, primary_contact_id, website, billing_address, city, state, zip, notes, created_at, updated_at')
          .eq('id', leadRecord.company_id)
          .single(),
        null
      )
    : leadRecord.company_name
      ? await safe(
          supabase
            .from('companies')
            .select('id, name, type, primary_contact_id, website, billing_address, city, state, zip, notes, created_at, updated_at')
            .ilike('name', `%${leadRecord.company_name}%`)
            .limit(1)
            .maybeSingle(),
          null
        )
      : null

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
  const properties = companyRecord?.id
    ? await safe(
        supabase
          .from('company_properties')
          .select('property_id, properties(id, name, address, city, state, zip, property_type, unit_count, status, created_at, updated_at)')
          .eq('company_id', companyRecord.id)
          .limit(8),
        []
      )
    : []

  // Sanitize for the .or() filter (addresses often contain commas, which break it).
  const propertySearch = String(leadRecord.location || companyName || '').replace(/[,()%*\\]/g, ' ').replace(/\s+/g, ' ').trim()
  const directProperties = propertySearch
    ? await safe(
        supabase
          .from('properties')
          .select('id, name, address, city, state, zip, property_type, unit_count, status, created_at, updated_at')
          .or(`name.ilike.%${propertySearch}%,address.ilike.%${propertySearch}%`)
          .limit(8),
        []
      )
    : []

  const sites = propertySearch
    ? await safe(
        supabase
          .from('sites')
          .select('id, name, address, city, state, zip, property_type, units, status, primary_contact_name, primary_contact_email, primary_contact_phone, notes, created_at, updated_at')
          .or(`name.ilike.%${propertySearch}%,address.ilike.%${propertySearch}%`)
          .limit(8),
        []
      )
    : []

  const activities = await safe(
    supabase
      .from('activities')
      .select('id, type, subject, body, due_at, completed_at, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(20),
    []
  )

  const crmActivities = await safe(
    supabase
      .from('crm_activities')
      .select('id, type, subject, body, outcome, due_at, completed_at, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(20),
    []
  )

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
      .from('activities')
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
      .from('activities')
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

    return NextResponse.json({ success: true, message: 'Call logged.', activity: data })
  }

  // ── schedule_followup ───────────────────────────────────────────────────────
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
    void supabase.from('activities').insert({
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

    if (Object.keys(fieldsMap).length === 0) {
      return NextResponse.json({ success: false, message: 'No fields provided to update.' }, { status: 400 })
    }

    fieldsMap.updated_at = new Date().toISOString()

    const { data: updatedLead, error: updateError } = await supabase
      .from('leads')
      .update(fieldsMap)
      .eq('id', lead.id)
      .select('id, contact_name, company_name, email, phone, location, property_type, unit_count, notes, source, stage, updated_at')
      .single()

    if (updateError) {
      return NextResponse.json({ success: false, message: updateError.message }, { status: 500 })
    }

    void supabase.from('activities').insert({
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

    const { data, error: updateError } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', lead.id)
      .select('id, stage, updated_at, converted_at, won_at, lost_at')
      .single()

    if (updateError) {
      return NextResponse.json({ success: false, message: updateError.message }, { status: 500 })
    }

    void supabase.from('activities').insert({
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

    // Insert opportunity carrying all lead context forward
    const { data: newOpp, error: oppError } = await supabase
      .from('opportunities')
      .insert({
        dealer_org_id:       lead.org_id,
        lead_id:             lead.id,
        contact_id:          lead.contact_id ?? null,
        company_id:          lead.company_id ?? null,
        rep_id:              profileId,
        name:                optionalName || oppName,
        stage:               'inquiry',
        notes:               (lead as Record<string, unknown>).notes ?? null,
        source:              (lead as Record<string, unknown>).source ?? null,
        account_name:        lead.company_name ?? null,
        management_co:       lead.company_name ?? null,
        property_address:    lead.location ?? null,
        site_contact_name:   lead.contact_name ?? null,
        site_contact_phone:  (lead as Record<string, unknown>).phone ?? null,
        site_contact_email:  (lead as Record<string, unknown>).email ?? null,
        units:               (lead as Record<string, unknown>).unit_count ?? null,
        next_step:           optionalNextStep || 'Schedule discovery call',
        assigned_from_lead:  lead.id,
      })
      .select('id, name, stage, est_mrr, amount, account_name, next_step, created_at, updated_at')
      .single()

    if (oppError) {
      return NextResponse.json({ success: false, message: oppError.message }, { status: 500 })
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
      .from('activities')
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
    let carried = { activities: 0, crm_activities: 0, attachments: 0 }
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
      const [a, c, at] = await Promise.all([
        relink('activities'),
        relink('crm_activities'),
        relink('attachments'),
      ])
      carried = { activities: a, crm_activities: c, attachments: at }
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
