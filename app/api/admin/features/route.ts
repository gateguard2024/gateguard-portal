/**
 * GET  /api/admin/features        — list full feature catalog
 * PATCH /api/admin/features        — bulk update tier_defaults, paid/beta flags, Stripe ID
 *
 * GateGuard corporate admin only.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function GET() {
  const caller = await getCurrentUser()
  if (!caller.isCorporate) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('feature_catalog')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ features: data ?? [] })
}

export async function PATCH(req: NextRequest) {
  const caller = await getCurrentUser()
  if (!caller.isCorporate || caller.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Body: array of { key, tier_defaults?, is_paid?, is_beta?, stripe_product_id?, notes? }
  const { updates }: { updates: Array<Record<string, any>> } = await req.json()
  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: 'updates array required' }, { status: 400 })
  }

  const results = []
  for (const u of updates) {
    const { key, ...fields } = u
    if (!key) continue
    const { data, error } = await supabase
      .from('feature_catalog')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('key', key)
      .select()
      .single()
    results.push({ key, ok: !error, error: error?.message })
  }

  return NextResponse.json({ results })
}
