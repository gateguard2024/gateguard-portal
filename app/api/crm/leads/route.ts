import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user  = await getCurrentUser()
    const scope = await resolveOrgScope(user)

    // Single bucket: read from `leads`. Corporate sees all; others see their
    // org's leads plus unassigned (null-org) leads (migrated legacy records).
    let query = supabase
      .from('leads')
      .select('id, contact_name, company_name, property_name, email, phone, property_type, contact_title, unit_count, location, city, state, stage, source, notes, assigned_dealer, opportunity_id, created_at')
      .is('opportunity_id', null)          // hide leads already converted to an opportunity
      .is('lost_at', null)
      .order('created_at', { ascending: false })

    if (!scope.all && scope.ids.length > 0) {
      query = query.or(`org_id.is.null,org_id.in.(${scope.ids.join(',')})`)
    }

    const { data, error } = await query

    if (error) {
      console.error('[/api/crm/leads] Supabase error:', error)
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
    }

    const leads = (data || []).map((row: any) => ({
      id:             row.id,
      type:           'lead' as const,
      contact_name:   row.contact_name,
      property_name:  row.property_name || '',
      created_at:     row.created_at,
      assigned_dealer: row.assigned_dealer ?? null,
      // Detail page fields
      name:          row.property_name || row.company_name || row.contact_name,
      company:       row.company_name ?? '',
      contact:       row.contact_name,
      propertyType:  row.property_type ?? 'Multifamily',
      location:      row.location
        || (row.city && row.state ? `${row.city}, ${row.state}` : (row.city ?? 'Atlanta') + ', ' + (row.state ?? 'GA')),
      stage:        row.stage ?? 'new',
      rep:          'R. Feldman',
      repInitials:  'RF',
      lastActivity: formatAge(row.created_at),
      source:       row.source ?? 'show',
      notes:        row.notes ?? null,
      // Phone/email: only show to users who can view sensitive fields
      phone: user.canViewSensitive ? row.phone : null,
      email: row.email,  // email is less sensitive — always included
    }))

    return NextResponse.json(leads)
  } catch (err) {
    console.error('[/api/crm/leads] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const body = await req.json()

    const {
      name, email, phone, property_name,
      source, city, state, property_type,
      contact_title, units, notes, company,
    } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('leads')
      .insert({
        org_id:        user.org_id ?? null,
        contact_name:  name.trim(),
        company_name:  company?.trim() ?? null,
        email:         email?.trim() ?? null,
        phone:         phone?.trim() ?? null,
        property_name: property_name?.trim() ?? company?.trim() ?? null,
        source:        source ?? 'manual',
        city:          city?.trim() ?? null,
        state:         state?.trim() ?? null,
        property_type: property_type ?? 'Multifamily',
        contact_title: contact_title?.trim() ?? null,
        unit_count:    units ? parseInt(units, 10) : null,
        notes:         notes?.trim() ?? null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ id: data.id, ...data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function formatAge(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
