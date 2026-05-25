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
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  const { searchParams } = new URL(req.url)
  const severityParam = searchParams.get('severity')   // e.g. "high,critical"
  const limitParam    = searchParams.get('limit')
  const limit         = Math.min(parseInt(limitParam ?? '50', 10), 200)

  let query = supabase
    .from('incidents')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  query = applyOrgScope(query, scope, 'org_id')

  if (severityParam) {
    const severities = severityParam.split(',').map(s => s.trim()).filter(Boolean)
    if (severities.length === 1) {
      query = query.eq('severity', severities[0])
    } else if (severities.length > 1) {
      query = query.in('severity', severities)
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
