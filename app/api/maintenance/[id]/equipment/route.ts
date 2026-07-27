import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { guardWorkOrder } from '@/lib/ops-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// Products are the single source of truth — equipment rows store only product_id;
// the photo is read live from the products catalog at display time.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function withCatalogImages(rows: any[]): Promise<any[]> {
  const ids = Array.from(new Set(rows.map(r => r.product_id).filter(Boolean)))
  if (ids.length === 0) return rows.map(r => ({ ...r, image_url: null }))
  const { data: prods } = await supabase.from('products').select('id, image_url').in('id', ids)
  const imgById = new Map((prods ?? []).map(p => [p.id, p.image_url]))
  return rows.map(r => ({ ...r, image_url: r.product_id ? (imgById.get(r.product_id) ?? null) : null }))
}

// GET — list equipment for a work order
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await guardWorkOrder(req, params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data, error } = await supabase
    .from('wo_installed_equipment')
    .select('*')
    .eq('work_order_id', params.id)
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ equipment: await withCatalogImages(data ?? []) })
}

// POST — add equipment (management pre-loads or tech adds on-site)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await guardWorkOrder(req, params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await req.json()
  const { name, make, model, sku, serial_number, location, qty = 1, condition, notes, added_by = 'management' } = body
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const { count } = await supabase
    .from('wo_installed_equipment')
    .select('*', { count: 'exact', head: true })
    .eq('work_order_id', params.id)

  const insertRow: Record<string, unknown> = {
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
    sort_order:    count ?? 0,
    // Catalog link only — the photo lives in products and is read live via
    // product_id (single source of truth). No image copied here.
    product_id:    body.product_id ? String(body.product_id) : null,
  }

  // Drift-resilient: strip any column this DB doesn't have yet (e.g. product_id
  // before migration 147) and retry, so adding equipment never fails.
  let data: Record<string, unknown> | null = null
  let error: { code?: string; message: string } | null = null
  for (let i = 0; i < 6; i++) {
    const res = await supabase.from('wo_installed_equipment').insert(insertRow).select().single()
    data = res.data; error = res.error
    if (!error) break
    if (error.code === '42703' || error.code === 'PGRST204') {
      const m = /Could not find the '([a-z_]+)' column/i.exec(error.message) || /column "?([a-z_]+)"?/i.exec(error.message)
      const col = m?.[1]
      if (col && col in insertRow) { delete insertRow[col]; continue }
    }
    break
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const [enriched] = await withCatalogImages(data ? [data] : [])
  return NextResponse.json({ item: enriched ?? data }, { status: 201 })
}
