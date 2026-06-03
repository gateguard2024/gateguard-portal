import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function safe<T>(promise: PromiseLike<{ data: T | null; error: unknown }>, fallback: T): Promise<T> {
  try {
    const { data, error } = await promise
    if (error || !data) return fallback
    return data
  } catch {
    return fallback
  }
}

type RouteContext = {
  params: {
    id: string
  }
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser()
  const leadId = params.id

  const lead = await safe(
    supabase
      .from('leads')
      .select('id, org_id, assigned_to, company_name, contact_name, email, phone, property_type, unit_count, location, stage, source, notes, created_at, updated_at, contact_id, company_id, opportunity_id')
      .eq('id', leadId)
      .single(),
    null
  )

  if (!lead) {
    return NextResponse.json({ success: false, message: 'Lead not found.' }, { status: 404 })
  }

  const leadRecord = lead as {
    id: string
    org_id: string | null
    contact_id?: string | null
    company_id?: string | null
    company_name?: string | null
    location?: string | null
    opportunity_id?: string | null
  }

  if (!user.isCorporate && user.org_id && leadRecord.org_id && user.org_id !== leadRecord.org_id) {
    return NextResponse.json({ success: false, message: 'You do not have access to this lead.' }, { status: 403 })
  }

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

  const propertySearch = leadRecord.location || companyName
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
    people: {
      primaryContact: contact,
      contacts,
    },
    company,
    properties: {
      linked: properties,
      possible: directProperties,
      sites,
    },
    activity: {
      activities,
      crmActivities,
    },
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
