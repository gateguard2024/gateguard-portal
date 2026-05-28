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
    
    if (!params.id) {
      return NextResponse.json({ error: 'Property ID is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('aria_properties')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }
    
    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch property'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const caller = await getCurrentUser()
    
    if (!params.id) {
      return NextResponse.json({ error: 'Property ID is required' }, { status: 400 })
    }

    const body = await req.json()

    // ── Security Boundary ─────────────────────────────────────────────────
    // Only allow updating CRM/sales-cycle fields. We strictly prevent human
    // users (or bugs) from overwriting the AI-discovered OSINT intelligence.
    const allowed: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (body.sales_stage !== undefined)          allowed.sales_stage = body.sales_stage
    if (body.sales_notes !== undefined)          allowed.sales_notes = body.sales_notes
    if (body.assigned_rep !== undefined)         allowed.assigned_rep = body.assigned_rep
    if (body.last_contacted_at !== undefined)    allowed.last_contacted_at = body.last_contacted_at
    if (body.crm_opportunity_id !== undefined)   allowed.crm_opportunity_id = body.crm_opportunity_id
    if (body.crm_lead_id !== undefined)          allowed.crm_lead_id = body.crm_lead_id
    if (body.contract_expiry_year !== undefined) allowed.contract_expiry_year = body.contract_expiry_year

    // ── Auto-Assists ──────────────────────────────────────────────────────
    // If a rep marks this as contacted but forgot the timestamp, auto-set it.
    if (body.sales_stage === 'contacted' && !body.last_contacted_at) {
      allowed.last_contacted_at = new Date().toISOString()
    }
    
    // Auto-assign the caller if they move it out of the 'prospect' stage.
    // Fallback to email or 'System' if the user's display name is missing.
    if (!allowed.assigned_rep && body.sales_stage && body.sales_stage !== 'prospect') {
      allowed.assigned_rep = caller?.name || caller?.email || 'System'
    }

    const { data, error } = await supabase
      .from('aria_properties')
      .update(allowed)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update property'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}