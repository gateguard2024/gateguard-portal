import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

/**
 * GET /api/saved-line-items
 * Returns global items (user_id IS NULL) + caller's personal items (user_id = clerk_id)
 * Optional ?q= text search on name/description
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''

  let query = supabase
    .from('saved_line_items')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  // Scope: global OR user's own
  query = query.or(`user_id.is.null,user_id.eq.${user.id}`)

  if (q) {
    query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ items: data ?? [] })
}

/**
 * POST /api/saved-line-items
 * Creates a user-private saved line item (user_id = caller's Clerk ID)
 * Body: { name, description, service_type, unit_price, default_qty, is_recurring }
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  const body = await req.json() as Record<string, unknown>

  const { name, description, service_type, unit_price, default_qty, is_recurring } = body

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('saved_line_items')
    .insert({
      user_id:      user.id,                              // user-private
      org_id:       user.org_id ?? null,
      name:         String(name).trim(),
      description:  description ? String(description) : null,
      service_type: service_type ? String(service_type) : 'one_time',
      unit_price:   parseFloat(String(unit_price ?? '0')) || 0,
      default_qty:  parseFloat(String(default_qty ?? '1')) || 1,
      is_recurring: Boolean(is_recurring),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data }, { status: 201 })
}

/**
 * DELETE /api/saved-line-items?id=<uuid>
 * Only deletes the caller's own items (not global ones)
 */
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('saved_line_items')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)   // safety: only own items

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
