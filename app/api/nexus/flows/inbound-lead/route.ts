import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

    if (!contactName) {
      return NextResponse.json({ success: false, message: 'Contact name is required.' }, { status: 400 })
    }

    if (!forceCreate) {
      const nameTerm = escapeLike(contactName)
      const companyTerm = escapeLike(propertyName)
      const orFilters = [`name.ilike.%${nameTerm}%`]
      if (companyTerm) orFilters.push(`company.ilike.%${companyTerm}%`)

      const { data: matches, error: matchError } = await supabase
        .from('crm_leads')
        .select('id, name, company, stage, source, created_at')
        .or(orFilters.join(','))
        .not('stage', 'in', '(closed_lost,lost,won,converted)')
        .order('created_at', { ascending: false })
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
      .from('crm_leads')
      .insert({
        name: contactName,
        company: propertyName || null,
        stage: 'new',
        source: 'nexus_inbound_flow',
        notes,
        ...(user.org_id ? { org_id: user.org_id } : {}),
      })
      .select('id, name, company, stage')
      .single()

    if (leadError) {
      return NextResponse.json({ success: false, message: leadError.message }, { status: 500 })
    }

    await supabase.from('crm_activities').insert({
      lead_id: lead.id,
      type: 'call',
      subject: `Inbound call: ${contactName}`,
      body: notes,
      ...(user.org_id ? { org_id: user.org_id } : {}),
    }).throwOnError().catch(() => null)

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
