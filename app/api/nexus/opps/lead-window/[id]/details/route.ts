import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type RouteContext = { params: { id: string } }

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function nullableText(value: unknown): string | null {
  const text = clean(value)
  return text || null
}

function nullableInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) ? parsed : null
}

async function getScopedLead(leadId: string, user: Awaited<ReturnType<typeof getCurrentUser>>) {
  const scope = await resolveOrgScope(user)

  let query = supabase
    .from('leads')
    .select('id, org_id, contact_name, company_name, email, phone, property_type, unit_count, location, notes')
    .eq('id', leadId)

  query = applyOrgScope(query, scope)

  const { data, error } = await query.maybeSingle()
  if (error) return { lead: null, error: error.message }
  return { lead: data as Record<string, unknown> | null }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser()

  if (!user.canViewCRM) {
    return NextResponse.json({ success: false, message: 'CRM access denied.' }, { status: 403 })
  }

  const { lead, error } = await getScopedLead(params.id, user)

  if (error) {
    return NextResponse.json({ success: false, message: error }, { status: 500 })
  }

  if (!lead) {
    return NextResponse.json({ success: false, message: 'Lead not found or outside your access.' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))

  const updates: Record<string, unknown> = {
    contact_name: nullableText(body.contact_name ?? body.contactName),
    company_name: nullableText(body.company_name ?? body.companyName),
    email: nullableText(body.email),
    phone: nullableText(body.phone),
    property_type: nullableText(body.property_type ?? body.propertyType),
    unit_count: nullableInteger(body.unit_count ?? body.unitCount),
    location: nullableText(body.location),
    notes: nullableText(body.notes),
    updated_at: new Date().toISOString(),
  }

  if (!updates.contact_name) {
    return NextResponse.json({ success: false, message: 'Lead needs a contact name.' }, { status: 400 })
  }

  const { data, error: updateError } = await supabase
    .from('leads')
    .update(updates)
    .eq('id', lead.id as string)
    .select('id, contact_name, company_name, email, phone, property_type, unit_count, location, notes, stage, source, updated_at')
    .single()

  if (updateError) {
    return NextResponse.json({ success: false, message: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: 'Lead details updated.', lead: data })
}
