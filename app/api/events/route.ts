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
  const alerts = searchParams.get('alerts') === 'true'

  let query = supabase
    .from('site_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  query = applyOrgScope(query, scope, 'org_id')

  if (alerts) {
    query = query.in('severity', ['critical', 'warning'])
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ events: data ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  const body = await req.json()
  const { event_type, title, description, severity, resolved, site_id } = body

  if (!event_type || !title) {
    return NextResponse.json({ error: 'event_type and title are required' }, { status: 400 })
  }

  const org_id = user.isCorporate ? (body.org_id ?? null) : (user.org_id ?? null)

  const { data, error } = await supabase
    .from('site_events')
    .insert({
      org_id,
      site_id:     site_id ?? null,
      event_type,
      title,
      description: description ?? null,
      severity:    severity ?? 'info',
      resolved:    resolved ?? false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ event: data }, { status: 201 })
}
