/**
 * /api/products — server-side product catalog CRUD (service role).
 *
 * Products used to be read AND written directly from the browser with the anon
 * key (RLS was off, so anything was allowed). Enabling RLS to close the Supabase
 * "Policy Exists RLS Disabled" advisor would have blocked those anon writes
 * (the policies target the `authenticated` role, but this app uses Clerk, so the
 * browser client is `anon`). Moving every write here — behind a real Clerk auth
 * gate + the service-role key — lets us turn RLS on without breaking the admin
 * page, and is strictly more secure than an open anon table.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function requireUser() {
  const user = await getCurrentUser()
  if (!user?.id || user.id === 'system') return null
  return user
}

// Read the JSON body robustly. req.json() throws on an empty/edge-buffered
// stream (which silently became {} before and surfaced as "Missing id or
// fields"); fall back to req.text() + manual parse so a valid body is never lost.
async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) ?? {}
  } catch {
    try {
      const t = await req.text()
      return t ? JSON.parse(t) : {}
    } catch {
      return {}
    }
  }
}

// GET — list all products (ordered by category, then name)
export async function GET() {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('category')
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ products: data ?? [] })
}

// POST — insert a single product { row } (default),
//        or bulk upsert on SKU { action: 'upsert', rows } (import + first-run seed)
export async function POST(req: NextRequest) {
  const body = await readBody(req)
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (body.action === 'upsert') {
    const rows = Array.isArray(body.rows) ? body.rows : []
    if (rows.length === 0) return NextResponse.json({ error: 'No rows provided.' }, { status: 400 })
    const { data, error } = await supabase
      .from('products')
      .upsert(rows, { onConflict: 'sku' })
      .select()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ products: data ?? [] })
  }

  const row = body.row
  if (!row || typeof row !== 'object') return NextResponse.json({ error: 'No product provided.' }, { status: 400 })
  const { data, error } = await supabase
    .from('products')
    .insert(row)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ product: data })
}

// PATCH — update a single product by id { id, row } (full edit or partial field)
export async function PATCH(req: NextRequest) {
  const body = await readBody(req)
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // Accept string OR number ids (products.id is uuid today, but never reject on type).
  const id = body.id != null && body.id !== '' ? String(body.id) : ''
  const row = body.row
  if (!id || !row || typeof row !== 'object') {
    const keys = Object.keys(body).join(', ') || 'nothing'
    return NextResponse.json(
      { error: `Missing id or fields (server received: ${keys}).`, received: Object.keys(body) },
      { status: 400 }
    )
  }
  const { data, error } = await supabase
    .from('products')
    .update(row)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ product: data })
}

// DELETE — delete one or many { ids: [...] } (or { id })
export async function DELETE(req: NextRequest) {
  const body = await readBody(req)
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const raw = Array.isArray(body.ids) ? body.ids : (body.id != null ? [body.id] : [])
  const ids = raw.map(x => String(x)).filter(Boolean)
  if (ids.length === 0) return NextResponse.json({ error: 'No ids provided.' }, { status: 400 })
  const { error } = await supabase.from('products').delete().in('id', ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, deleted: ids.length })
}
