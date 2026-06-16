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
      units, source, assigned_from_lead, site_id
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

    // Company
    opportunity.company_id
      ? safe(
          supabase
            .from('companies')
            .select('id, name, type, website, billing_address, city, state, zip, notes')
            .eq('id', opportunity.company_id as string)
            .single(),
          null
        )
      : Promise.resolve(null),

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

    // Property
    opportunity.property_id
      ? safe(
          supabase
            .from('properties')
            .select('id, name, address, city, state, zip, property_type, unit_count, status')
            .eq('id', opportunity.property_id as string)
            .single(),
          null
        )
      : Promise.resolve(null),

    // Activities (uses dealer_org_id — service role bypasses RLS after opp scope confirmed)
    safe(
      supabase
        .from('activities')
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

  return NextResponse.json({
    success: true,
    opportunity,
    lead,
    company,
    contact,
    property,
    activities,
    todos,
    attachments,
    quote,
    nextBestActions: [
      { title: 'Run ARIA',          subtitle: 'Research this property or company.',   action: 'run_aria' },
      { title: 'Generate Quote',    subtitle: 'Start a quote from this opportunity.', action: 'generate_quote' },
      { title: 'Schedule Follow-Up', subtitle: 'Create the next touch.',              action: 'schedule_followup' },
      { title: 'Create Project',    subtitle: 'Turn this into a delivery project.',   action: 'create_project' },
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

  return NextResponse.json({ success: false, message: 'Unknown opportunity action.' }, { status: 400 })
}
