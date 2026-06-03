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
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const body = (await req.json()) as InboundLeadPayload

    const contactName = clean(body.contactName)
    const propertyName = clean(body.propertyName)
    const need = clean(body.need)
    const source = clean(body.source) || 'phone'

    if (!contactName) {
      return NextResponse.json({ success: false, message: 'Contact name is required.' }, { status: 400 })
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

    // Best-effort activity log. Some environments may not have this table/shape yet,
    // so lead creation should not fail if activity logging is unavailable.
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
