import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// POST /api/subcontractors/portal
// Public no-auth route — accepts an access_code, returns subcontractor + assigned WOs
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { access_code } = body as { access_code?: string }

  if (!access_code || typeof access_code !== 'string') {
    return NextResponse.json({ error: 'access_code is required' }, { status: 400 })
  }

  const { data: sub, error: subErr } = await supabase
    .from('subcontractors')
    .select('*')
    .eq('access_code', access_code.toUpperCase().trim())
    .single()

  if (subErr || !sub) {
    return NextResponse.json({ error: 'Invalid access code' }, { status: 404 })
  }

  if (sub.status === 'suspended') {
    return NextResponse.json({ error: 'Account suspended — contact your GateGuard dealer.' }, { status: 403 })
  }

  const { data: assignments } = await supabase
    .from('work_order_subcontractors')
    .select('*, work_orders(*)')
    .eq('subcontractor_id', sub.id)
    .order('assigned_at', { ascending: false })

  // Strip sensitive internal fields before returning to public client
  const publicSub = {
    id:               sub.id,
    name:             sub.name,
    company:          sub.company,
    email:            sub.email,
    trade:            sub.trade,
    license_expiry:   sub.license_expiry,
    insurance_expiry: sub.insurance_expiry,
    status:           sub.status,
  }

  return NextResponse.json({ subcontractor: publicSub, assignments: assignments ?? [] })
}
