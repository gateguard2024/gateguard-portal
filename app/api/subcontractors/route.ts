import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// GET /api/subcontractors — list subcontractors scoped to caller's org
export async function GET(req: NextRequest) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const q      = searchParams.get('q')

  let query = supabase
    .from('subcontractors')
    .select('*')
    .order('created_at', { ascending: false })

  query = applyOrgScope(query, scope, 'org_id')

  if (status) query = query.eq('status', status)
  if (q)      query = query.or(`name.ilike.%${q}%,company.ilike.%${q}%,email.ilike.%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ subcontractors: data ?? [] })
}

// POST /api/subcontractors — create a new subcontractor
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  const body = await req.json()

  const {
    name, company, email, phone, trade,
    license_number, license_expiry, insurance_expiry,
    status = 'active',
  } = body

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('subcontractors')
    .insert({
      org_id: user.org_id,
      name,
      company: company || null,
      email:   email   || null,
      phone:   phone   || null,
      trade:   trade   || null,
      license_number:  license_number  || null,
      license_expiry:  license_expiry  || null,
      insurance_expiry: insurance_expiry || null,
      status,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ subcontractor: data }, { status: 201 })
}
