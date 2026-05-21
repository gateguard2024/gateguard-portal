import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const [opp, history, contacts, activities] = await Promise.all([
    supabase.from('opportunities').select('*').eq('id', params.id).single(),
    supabase.from('opportunity_stage_history').select('*').eq('opportunity_id', params.id).order('changed_at', { ascending: false }),
    supabase.from('opportunity_contacts').select('*').eq('opportunity_id', params.id),
    supabase.from('crm_activities').select('*').eq('opportunity_id', params.id).order('created_at', { ascending: false }).limit(20),
  ])
  if (opp.error) return NextResponse.json({ error: opp.error.message }, { status: 404 })
  // Normalize DB field names to UI field names
  const data = opp.data as Record<string, unknown>
  return NextResponse.json({
    ...data,
    // opp_type → opportunity_type (UI field name)
    opportunity_type: data.opp_type ?? null,
    // forecast_cat → forecast_category (UI field name)
    forecast_category: data.forecast_cat ?? null,
    // Map dtv_* columns to the names the UI expects
    directv_package: data.dtv_package ?? null,
    isp_service: data.isp_service ?? null,
    mdu_contract_expiry: data.mdu_contract_expiry ?? null,
    stage_history: history.data || [],
    contacts: (contacts.data || []).map((c: Record<string, unknown>) => ({
      id: c.id,
      name: c.contact_name ?? c.name ?? null,
      title: c.contact_title ?? c.title ?? null,
      email: c.contact_email ?? c.email ?? null,
      phone: c.contact_phone ?? c.phone ?? null,
      role: c.role ?? null,
      is_primary: c.is_primary ?? false,
    })),
    activities: activities.data || [],
  })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  // Map UI field names back to DB column names
  const { opportunity_type, directv_package, forecast_category, ...rest } = body as Record<string, unknown>
  const dbPayload: Record<string, unknown> = {
    ...rest,
    updated_at: new Date().toISOString(),
  }
  if (opportunity_type !== undefined) dbPayload.opp_type = opportunity_type
  if (directv_package  !== undefined) dbPayload.dtv_package = directv_package
  if (forecast_category !== undefined) dbPayload.forecast_cat = forecast_category

  const { data, error } = await supabase
    .from('opportunities')
    .update(dbPayload)
    .eq('id', params.id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await supabase
    .from('opportunities')
    .delete()
    .eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
