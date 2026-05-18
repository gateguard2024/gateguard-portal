/**
 * GET  /api/permits  — list permits with computed status (org-scoped)
 * POST /api/permits  — create a permit
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const caller = await getCurrentUser()
  if (!caller.org_id && !caller.isCorporate) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const siteId = searchParams.get('site_id')
  const status = searchParams.get('status')

  let query = supabase
    .from('permits_with_status')
    .select('*')
    .order('expiry_date', { ascending: true, nullsFirst: false })

  if (!caller.isCorporate && caller.org_id) {
    query = query.eq('org_id', caller.org_id)
  }
  if (siteId) query = query.eq('site_id', siteId)
  if (status && status !== 'all') query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ permits: data ?? [] })
}

export async function POST(req: NextRequest) {
  const caller = await getCurrentUser()
  if (!caller.org_id && !caller.isCorporate) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { type, label, permit_number, issued_by, issue_date, expiry_date, site_id, notes } = body

  if (!type) {
    return NextResponse.json({ error: 'type is required' }, { status: 400 })
  }

  const org_id = caller.isCorporate ? (body.org_id ?? null) : caller.org_id

  const { data, error } = await supabase
    .from('permits')
    .insert({
      org_id,
      site_id:       site_id       ?? null,
      type,
      label:         label         ?? null,
      permit_number: permit_number ?? null,
      issued_by:     issued_by     ?? null,
      issue_date:    issue_date    || null,
      expiry_date:   expiry_date   || null,
      notes:         notes         ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ permit: data }, { status: 201 })
}
