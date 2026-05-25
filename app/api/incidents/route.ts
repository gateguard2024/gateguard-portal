import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  const { searchParams } = new URL(req.url)
  const severityParam = searchParams.get('severity')   // e.g. "high,critical"
  const statusParam   = searchParams.get('status')     // e.g. "open,investigating"
  const limitParam    = searchParams.get('limit')
  const limit         = Math.min(parseInt(limitParam ?? '50', 10), 200)

  let query = supabase
    .from('incidents')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  // ── Hierarchy-aware scoping ──────────────────────────────────────────────
  // A dealer sees incidents for any site where they are master_dealer,
  // install_dealer, OR service_dealer — not just incidents with their org_id.
  if (!scope.all && scope.ids.length > 0) {
    // Step 1: find all site IDs this org (or subtree) is responsible for
    const orClause = scope.ids.map(id =>
      `master_dealer_id.eq.${id},install_dealer_id.eq.${id},service_dealer_id.eq.${id}`
    ).join(',')

    const { data: scopedSites } = await supabase
      .from('sites')
      .select('id')
      .or(orClause)

    const siteIds = (scopedSites ?? []).map((s: { id: string }) => s.id)

    if (siteIds.length > 0) {
      // Incidents scoped by site ownership OR direct org_id match
      const orgList  = scope.ids.join(',')
      const siteList = siteIds.join(',')
      query = query.or(`site_id.in.(${siteList}),org_id.in.(${orgList})`)
    } else {
      // No matching sites — fall back to direct org_id scope only
      query = query.in('org_id', scope.ids)
    }
  }
  // scope.all (corporate) → no filter, sees everything

  if (severityParam) {
    const severities = severityParam.split(',').map(s => s.trim()).filter(Boolean)
    if (severities.length === 1) {
      query = query.eq('severity', severities[0])
    } else if (severities.length > 1) {
      query = query.in('severity', severities)
    }
  }

  if (statusParam) {
    const statuses = statusParam.split(',').map(s => s.trim()).filter(Boolean)
    if (statuses.length === 1) {
      query = query.eq('status', statuses[0])
    } else if (statuses.length > 1) {
      query = query.in('status', statuses)
    }
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ incidents: data ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  const body = await req.json()
  const { title, description, severity, status, reported_by, site_id } = body

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const org_id = user.isCorporate ? (body.org_id ?? null) : (user.org_id ?? null)

  const { data, error } = await supabase
    .from('incidents')
    .insert({
      org_id,
      site_id:     site_id ?? null,
      title,
      description: description ?? null,
      severity:    severity ?? 'medium',
      status:      status ?? 'open',
      reported_by: reported_by ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ incident: data }, { status: 201 })
}
