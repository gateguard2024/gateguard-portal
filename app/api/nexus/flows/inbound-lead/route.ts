import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const GATEGUARD_ORG_ID = '00000000-0000-0000-0000-000000000001'

type InboundLeadPayload = {
  source?: string
  contactName?: string
  propertyName?: string
  need?: string
  forceCreate?: boolean
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function escapeLike(value: string): string {
  return value.replace(/[%_]/g, match => `\\${match}`)
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const body = (await req.json()) as InboundLeadPayload

    const contactName = clean(body.contactName)
    const propertyName = clean(body.propertyName)
    const need = clean(body.need)
    const source = clean(body.source) || 'phone'
    const forceCreate = body.forceCreate === true
    const orgId = user.org_id || GATEGUARD_ORG_ID

    if (!contactName) {
      return NextResponse.json({ success: false, message: 'Contact name is required.' }, { status: 400 })
    }

    if (!forceCreate) {
      const nameTerm = escapeLike(contactName)
      const companyTerm = escapeLike(propertyName)
      const orFilters = [`contact_name.ilike.%${nameTerm}%`]
      if (companyTerm) {
        orFilters.push(`company_name.ilike.%${companyTerm}%`)
        orFilters.push(`location.ilike.%${companyTerm}%`)
      }

      const { data: matches, error: matchError } = await supabase
        .from('leads')
        .select('id, contact_name, company_name, location, stage, source, created_at, updated_at')
        .eq('org_id', orgId)
        .or(orFilters.join(','))
        .is('lost_at', null)
        .order('updated_at', { ascending: false })
        .limit(5)

      if (!matchError && matches && matches.length > 0) {
        return NextResponse.json({
          success: false,
          duplicateCheck: true,
          message: 'Possible existing lead found. Use an existing record or confirm this is new before creating another.',
          matches,
          nextCards: [
            { title: 'Use Existing Lead', subtitle: 'Open the closest matching lead and keep working there.', action: 'use_existing_lead' },
            { title: 'Create New Anyway', subtitle: 'This is a different person, property, or opportunity.', action: 'force_create_lead' },
            { title: 'Add More Info', subtitle: 'Add phone, email, address, or context to improve the match.', action: 'add_more_info' },
          ],
        }, { status: 409 })
      }
    }

    const notes = [
      `Inbound source: ${source}`,
      propertyName ? `Property/company: ${propertyName}` : null,
      need ? `Need: ${need}` : null,
      `Captured by Nexus flow for ${user.name}`,
    ].filter(Boolean).join('\n')

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        org_id: orgId,
        contact_name: contactName,
        company_name: propertyName || null,
        location: propertyName || null,
        stage: 'prospect',
        source: `nexus_${source}`,
        notes,
      })
      .select('id, contact_name, company_name, location, stage, source, created_at, updated_at')
      .single()

    if (leadError) {
      return NextResponse.json({ success: false, message: leadError.message }, { status: 500 })
    }

    try {
      await supabase.from('activity_log').insert({
        org_id: orgId,
        entity_type: 'lead',
        entity_id: lead.id,
        action: 'created',
        description: `Inbound lead captured: ${contactName}${propertyName ? ` at ${propertyName}` : ''}`,
      })
    } catch {
      // Best-effort activity log. Lead creation should not fail if activity logging is unavailable.
    }

    return NextResponse.json({
      success: true,
      message: `Lead created for ${contactName}.`,
      lead,
      nextCards: [
        { title: 'Run ARIA', subtitle: 'Research the property before outreach.', action: 'run_aria' },
        { title: 'Create Opportunity', subtitle: 'Turn this lead into a deal.', action: 'create_opportunity' },
        { title: 'Schedule Follow-Up', subtitle: 'Make sure the next touch is planned.', action: 'schedule_followup' },
      ],
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Inbound lead flow failed.',
    }, { status: 500 })
  }
}
