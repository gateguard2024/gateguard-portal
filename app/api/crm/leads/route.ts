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

    // show_leads don't have org_id yet — GateGuard corporate can see all.
    // When leads are owned by a specific dealer org, filter by assigned_dealer_org_id.
    // For now: corporate sees all; others see only leads assigned to their org subtree.
    let query = supabase
      .from('show_leads')
      .select('*, source, city, state, property_type, contact_title, units, notes')
      .order('created_at', { ascending: false })

    // If there's an org filter needed and the table has assigned_dealer column,
    // scope to only leads where assigned_dealer is in the user's subtree.
    // Corporate sees everything.
    if (!scope.all && scope.ids.length > 0) {
      // Show leads assigned to this dealer OR unassigned (null — visible to all dealers)
      query = query.or(
        `assigned_dealer.is.null,assigned_dealer.in.(${scope.ids.join(',')})`
      )
    }

    const { data, error } = await query

    if (error) {
      console.error('[/api/crm/leads] Supabase error:', error)
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
    }

    const leads = (data || []).map((row: any) => ({
      id:             `show_${row.id}`,
      type:           'lead' as const,
      contact_name:   row.name,
      property_name:  row.property_name || '',
      created_at:     row.created_at,
      assigned_dealer: row.assigned_dealer ?? null,
      // Detail page fields
      name:          row.property_name || row.name,
      company:       '',
      contact:       row.name,
      propertyType:  row.property_type ?? 'Multifamily',
      location:      row.city && row.state
        ? `${row.city}, ${row.state}`
        : (row.city ?? 'Atlanta') + ', ' + (row.state ?? 'GA'),
      stage:        'new' as const,
      rep:          'R. Feldman',
      repInitials:  'RF',
      lastActivity: formatAge(row.created_at),
      source:       row.source ?? 'show',
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

function formatAge(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
