import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// GET /api/compliance/coi
export async function GET(_req: NextRequest) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  let query = supabase
    .from('coi_records')
    .select(`
      id, org_id, policy_number, insurer_name, coverage_type,
      coverage_amount, effective_date, expiry_date, document_url,
      status, notes, created_at, updated_at,
      organizations!coi_records_org_id_fkey (name)
    `)
    .order('expiry_date', { ascending: true })

  query = applyOrgScope(query, scope, 'org_id') as typeof query

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const cois = (data ?? []).map((row: any) => ({
    ...row,
    org_name: row.organizations?.name ?? null,
    organizations: undefined,
  }))

  return NextResponse.json({ cois })
}

// POST /api/compliance/coi
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  const body = await req.json()

  const {
    org_id, policy_number, insurer_name, coverage_type,
    coverage_amount, effective_date, expiry_date,
    document_url, notes,
  } = body

  if (!expiry_date) {
    return NextResponse.json({ error: 'expiry_date is required' }, { status: 400 })
  }

  const resolvedOrgId = user.isCorporate ? (org_id ?? user.org_id) : (user.org_id ?? org_id)

  const { data, error } = await supabase
    .from('coi_records')
    .insert({
      org_id:         resolvedOrgId ?? null,
      policy_number:  policy_number  ?? null,
      insurer_name:   insurer_name   ?? null,
      coverage_type:  coverage_type  ?? 'general_liability',
      coverage_amount: coverage_amount ?? null,
      effective_date: effective_date  ?? null,
      expiry_date,
      document_url:   document_url   ?? null,
      notes:          notes          ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ coi: data }, { status: 201 })
}
