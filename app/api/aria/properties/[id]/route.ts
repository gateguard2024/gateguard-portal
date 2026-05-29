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

    const allowed: Record<string, unknown> = { updated_at: new Date().toISOString() }

    // ── Sales cycle fields ────────────────────────────────────────────────
    if (body.sales_stage !== undefined)          allowed.sales_stage = body.sales_stage
    if (body.sales_notes !== undefined)          allowed.sales_notes = body.sales_notes
    if (body.assigned_rep !== undefined)         allowed.assigned_rep = body.assigned_rep
    if (body.last_contacted_at !== undefined)    allowed.last_contacted_at = body.last_contacted_at
    if (body.crm_opportunity_id !== undefined)   allowed.crm_opportunity_id = body.crm_opportunity_id
    if (body.crm_lead_id !== undefined)          allowed.crm_lead_id = body.crm_lead_id
    if (body.contract_expiry_year !== undefined) allowed.contract_expiry_year = body.contract_expiry_year

    // ── User-verified intelligence fields (learning loop) ─────────────────
    // These corrections are preserved through future AI re-searches. Each
    // field has a corresponding _user_verified flag so the merge upsert knows
    // to protect it from being overwritten by a new AI search.
    if (body.isp_providers !== undefined) {
      allowed.isp_providers = body.isp_providers
      allowed.isp_providers_user_verified = true
    }
    if (body.video_providers !== undefined) {
      allowed.video_providers = body.video_providers
      allowed.video_providers_user_verified = true
    }
    if (body.roe_expiry_year !== undefined) {
      allowed.roe_expiry_year = body.roe_expiry_year
      allowed.roe_expiry_user_verified = true
    }
    if (body.roe_providers !== undefined) {
      allowed.roe_providers = body.roe_providers
    }
    if (body.roe_detected !== undefined) {
      allowed.roe_detected = body.roe_detected
    }
    if (body.bulk_agreements !== undefined) {
      allowed.bulk_agreements = body.bulk_agreements
    }
    // Decision maker corrections
    if (body.dm_name !== undefined) {
      allowed.dm_name = body.dm_name
      allowed.dm_name_user_verified = true
    }
    if (body.dm_email !== undefined) {
      allowed.dm_email = body.dm_email
      allowed.dm_email_user_verified = true
    }
    if (body.dm_phone !== undefined) {
      allowed.dm_phone = body.dm_phone
      allowed.dm_phone_user_verified = true
    }
    if (body.dm_title !== undefined)       allowed.dm_title = body.dm_title
    if (body.dm_linkedin_slug !== undefined) allowed.dm_linkedin_slug = body.dm_linkedin_slug
    // PropTech corrections
    if (body.gate_operators !== undefined) allowed.gate_operators = body.gate_operators
    if (body.access_control !== undefined) allowed.access_control = body.access_control
    if (body.intercoms !== undefined)      allowed.intercoms = body.intercoms
    // Core property facts
    if (body.units !== undefined)              allowed.units = body.units
    if (body.year_built !== undefined)         allowed.year_built = body.year_built
    if (body.management_company !== undefined) allowed.management_company = body.management_company
    if (body.owner_entity !== undefined)       allowed.owner_entity = body.owner_entity

    // ── Auto-Assists ──────────────────────────────────────────────────────
    if (body.sales_stage === 'contacted' && !body.last_contacted_at) {
      allowed.last_contacted_at = new Date().toISOString()
    }
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