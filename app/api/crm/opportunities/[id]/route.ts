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
  return NextResponse.json({
    ...opp.data,
    stage_history: history.data || [],
    contacts: contacts.data || [],
    activities: activities.data || [],
  })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { data, error } = await supabase
    .from('opportunities')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
