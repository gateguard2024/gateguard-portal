/**
 * GET  /api/permits          — list permits via permits_with_status view
 * POST /api/permits          — create a permit
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
  const status = searchParams.get('status')  // compliant | expiring_soon | expired | no_expiry
  const siteId = searchParams.get('site_id')

  let query = supabase
    .from('permits_with_status')
    .select('*')
    .order('expiry_date', { ascending: true, nullsFirst: false })

  if (!caller.isCorporate && caller.org_id) {
    query = query.eq('org_id', caller.org_id)
  }
  if (status) query = query.eq('status', status)
  if (siteId) query = query.eq('site_id', siteId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ permits: data ?? [] })
}

export async function POST(req: NextRequest) {
  const caller = await getCurrentUser()
  const allowed = caller.isCorporate ||
    caller.org_tier === 'master_dealer' ||
    caller.org_tier === 'full_dealer'

  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden — dealer admin only' }, { status: 403 })
  }

  const body = await req.json()
  const {
    type, label, permit_number, issued_by,
    issue_date, expiry_date, site_id, document_url, notes,
  } = body

  const validTypes = [
    'gate_permit', 'fire_marshal', 'hoa_certificate',
    'city_license', 'electrical_permit', 'low_voltage_license', 'other',
  ]
  if (!type || !validTypes.includes(type)) {
    return NextResponse.json({ error: `Invalid permit type: ${type}` }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('permits')
    .insert({
      org_id:        caller.org_id ?? null,
      site_id:       site_id ?? null,
      type,
      label:         label ?? null,
      permit_number: permit_number ?? null,
      issued_by:     issued_by ?? null,
      issue_date:    issue_date ?? null,
      expiry_date:   expiry_date ?? null,
      document_url:  document_url ?? null,
      notes:         notes ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ permit: data }, { status: 201 })
}
