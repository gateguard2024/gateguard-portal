/**
 * PATCH /api/aria/properties/[id] — update sales stage, notes, assigned rep, contact date
 * GET   /api/aria/properties/[id] — fetch single property record
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await getCurrentUser()
    const { data, error } = await supabase
      .from('aria_properties')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const caller = await getCurrentUser()
    const body   = await req.json()

    // Only allow updating sales-cycle fields (not ARIA-discovered intel fields)
    const allowed: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (body.sales_stage         !== undefined) allowed.sales_stage         = body.sales_stage
    if (body.sales_notes         !== undefined) allowed.sales_notes         = body.sales_notes
    if (body.assigned_rep        !== undefined) allowed.assigned_rep        = body.assigned_rep
    if (body.last_contacted_at   !== undefined) allowed.last_contacted_at   = body.last_contacted_at
    if (body.crm_opportunity_id  !== undefined) allowed.crm_opportunity_id  = body.crm_opportunity_id
    if (body.crm_lead_id         !== undefined) allowed.crm_lead_id         = body.crm_lead_id
    if (body.contract_expiry_year !== undefined) allowed.contract_expiry_year = body.contract_expiry_year

    // If marking as contacted and no timestamp provided, auto-set
    if (body.sales_stage === 'contacted' && !body.last_contacted_at) {
      allowed.last_contacted_at = new Date().toISOString()
    }
    if (!allowed.assigned_rep && body.sales_stage && body.sales_stage !== 'prospect') {
      allowed.assigned_rep = caller.name
    }

    const { data, error } = await supabase
      .from('aria_properties')
      .update(allowed)
      .eq('id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
