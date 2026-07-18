/**
 * GET   /api/dealer/pricing — quotable, dealer-visible catalog lines + this
 *                             dealer org's margins (merged)
 * PATCH /api/dealer/pricing — upsert my org's margin per line
 *
 * Dealers add margin ON TOP of corporate pricing — percent or fixed $, never
 * negative. Corporate floors/targets are read-only here; the dealer sell price
 * is corporate target + margin. Any signed-in user with an org can view;
 * saving requires a dealer admin/supervisor.
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
  const user = await getCurrentUser()
  if (!user.org_id && !user.isCorporate) {
    return NextResponse.json({ error: 'No organization on this account' }, { status: 403 })
  }

  const [{ data: items, error: iErr }, { data: margins, error: mErr }] = await Promise.all([
    supabase
      .from('service_catalog')
      .select('id, item_code, name, category, billing_type, unit_label, base_price, target_price, bucket, status, quotable, is_gateguard_program, notes, sort_order')
      .eq('is_active', true)
      .eq('dealer_visible', true)
      .order('is_gateguard_program', { ascending: false })
      .order('sort_order', { ascending: true }),
    user.org_id
      ? supabase.from('dealer_service_margins').select('*').eq('org_id', user.org_id)
      : Promise.resolve({ data: [], error: null } as any),
  ])
  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 })
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })

  const marginByService: Record<string, any> = {}
  for (const m of margins ?? []) marginByService[m.service_id] = m

  return NextResponse.json({
    items: (items ?? []).map((i) => ({
      ...i,
      margin_type: marginByService[i.id]?.margin_type ?? 'percent',
      margin_value: marginByService[i.id]?.margin_value ?? 0,
    })),
  })
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user.org_id) return NextResponse.json({ error: 'No organization on this account' }, { status: 403 })
  if (!['admin', 'supervisor'].includes(user.role)) {
    return NextResponse.json({ error: 'Only dealer admins can set margins' }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const updates: Array<{ service_id: string; margin_type: string; margin_value: number }> =
    Array.isArray(body?.updates) ? body.updates : []
  if (!updates.length) return NextResponse.json({ error: 'updates required' }, { status: 400 })

  for (const u of updates) {
    if (!u?.service_id) continue
    const type = u.margin_type === 'fixed' ? 'fixed' : 'percent'
    const value = Number(u.margin_value)
    if (!Number.isFinite(value) || value < 0) {
      return NextResponse.json({ error: 'Margin must be zero or positive — dealers can only mark up, never below corporate pricing.' }, { status: 400 })
    }
    const { error } = await supabase
      .from('dealer_service_margins')
      .upsert(
        {
          org_id: user.org_id,
          service_id: u.service_id,
          margin_type: type,
          margin_value: value,
          updated_by: user.name,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'org_id,service_id' },
      )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, updated: updates.length })
}
