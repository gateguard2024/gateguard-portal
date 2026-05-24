import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// POST /api/dispatch/technicians/[id]/location — store a GPS ping
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const { lat, lng, accuracy_m, event_type, work_order_id } = body

    if (lat === undefined || lng === undefined) {
      return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 })
    }

    // Look up the technician to get org_id
    const { data: tech } = await supabase
      .from('technicians')
      .select('id, org_id')
      .eq('id', params.id)
      .single()

    const { data, error } = await supabase
      .from('tech_location_pings')
      .insert({
        technician_id: params.id,
        org_id:        tech?.org_id ?? null,
        lat,
        lng,
        accuracy_m:    accuracy_m ?? null,
        event_type:    event_type ?? 'ping',
        work_order_id: work_order_id ?? null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ping: data }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// GET /api/dispatch/technicians/[id]/location — last 8 hours of pings for a tech
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cutoff = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('tech_location_pings')
    .select('id, lat, lng, accuracy_m, event_type, work_order_id, created_at')
    .eq('technician_id', params.id)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ pings: data ?? [] })
}
