import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// GET — list equipment for a work order
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await supabase
    .from('wo_installed_equipment')
    .select('*')
    .eq('work_order_id', params.id)
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ equipment: data ?? [] })
}

// POST — add equipment (management pre-loads or tech adds on-site)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { name, make, model, sku, serial_number, location, qty = 1, condition, notes, added_by = 'management' } = body
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const { count } = await supabase
    .from('wo_installed_equipment')
    .select('*', { count: 'exact', head: true })
    .eq('work_order_id', params.id)

  const { data, error } = await supabase
    .from('wo_installed_equipment')
    .insert({
      work_order_id: params.id,
      name:          name.trim(),
      make:          make?.trim()          || null,
      model:         model?.trim()         || null,
      sku:           sku?.trim()           || null,
      serial_number: serial_number?.trim() || null,
      location:      location?.trim()      || null,
      qty:           qty || 1,
      condition:     condition             || null,
      notes:         notes?.trim()         || null,
      added_by,
      sort_order: count ?? 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data }, { status: 201 })
}
