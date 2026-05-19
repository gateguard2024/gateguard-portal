import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// GET /api/quotes/[id] — return quote with line_items, client org name, site name
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  const { data: quote, error } = await supabase
    .from('quotes')
    .select(`
      id, quote_number, org_id, client_org_id, site_id,
      title, status, property_name, units,
      total_one_time, total_mrr, dealer_mrr,
      valid_until, accepted_at, sent_at, declined_at,
      notes, pdf_url, share_token, work_order_id,
      created_at, updated_at,
      quote_line_items (
        id, sort_order, category, description, qty, unit_price, is_recurring, created_at
      )
    `)
    .eq('id', params.id)
    .single()
  if (error || !quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

  // Org scope check
  if (!scope.all && !scope.ids.includes(quote.org_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch client org name (optional join)
  let client_org_name: string | null = null
  if (quote.client_org_id) {
    const { data: clientOrg } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', quote.client_org_id)
      .single()
    client_org_name = clientOrg?.name ?? null
  }

  // Fetch site name (optional join)
  let site_name: string | null = null
  if (quote.site_id) {
    const { data: site } = await supabase
      .from('sites')
      .select('name')
      .eq('id', quote.site_id)
      .single()
    site_name = site?.name ?? null
  }

  // Sort line items by sort_order (can't order nested relations via .select())
  const sortedItems = (quote.quote_line_items ?? []).sort(
    (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
  )

  return NextResponse.json({ quote: { ...quote, quote_line_items: sortedItems, client_org_name, site_name } })
}

// PATCH /api/quotes/[id] — update fields + handle status transitions
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)
  const body  = await req.json()

  // Verify ownership
  const { data: existing, error: fetchErr } = await supabase
    .from('quotes')
    .select('id, org_id, status')
    .eq('id', params.id)
    .single()

  if (fetchErr || !existing) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  if (!scope.all && !scope.ids.includes(existing.org_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const allowedFields = [
    'title', 'status', 'client_org_id', 'site_id', 'property_name', 'units',
    'total_one_time', 'total_mrr', 'dealer_mrr',
    'valid_until', 'notes', 'pdf_url', 'work_order_id',
  ]

  const updates: Record<string, unknown> = {}
  for (const key of allowedFields) {
    if (key in body) updates[key] = body[key]
  }

  // Status transition side effects
  const newStatus = body.status as string | undefined
  if (newStatus === 'sent'     && !body.sent_at)     updates.sent_at     = new Date().toISOString()
  if (newStatus === 'accepted' && !body.accepted_at) updates.accepted_at = new Date().toISOString()
  if (newStatus === 'declined' && !body.declined_at) updates.declined_at = new Date().toISOString()

  updates.updated_at = new Date().toISOString()

  const { data: updated, error: updateErr } = await supabase
    .from('quotes')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
  return NextResponse.json({ quote: updated })
}

// DELETE /api/quotes/[id] — delete quote (cascades to line_items)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  const { data: existing } = await supabase
    .from('quotes')
    .select('id, org_id')
    .eq('id', params.id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  if (!scope.all && !scope.ids.includes(existing.org_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Delete line items first (in case no cascade FK)
  await supabase.from('quote_line_items').delete().eq('quote_id', params.id)

  const { error } = await supabase.from('quotes').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
