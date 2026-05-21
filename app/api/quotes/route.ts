import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// GET /api/quotes — list quotes scoped to the caller's org hierarchy
export async function GET(req: NextRequest) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  const { searchParams } = new URL(req.url)
  const status        = searchParams.get('status')
  const q             = searchParams.get('q')
  const site_id       = searchParams.get('site_id')
  const client_org_id  = searchParams.get('client_org_id')
  const opportunity_id = searchParams.get('opportunity_id')

  let query = supabase
    .from('quotes')
    .select(`
      id, quote_number, org_id, client_org_id, site_id,
      opportunity_id, client_name, client_email, client_phone,
      title, status, property_name, units,
      total_one_time, total_mrr, dealer_mrr,
      valid_until, accepted_at, sent_at, declined_at,
      notes, pdf_url, share_token, work_order_id,
      created_at, updated_at
    `)
    .order('created_at', { ascending: false })

  // Org isolation
  query = applyOrgScope(query, scope, 'org_id')

  if (status)         query = query.eq('status', status)
  if (site_id)        query = query.eq('site_id', site_id)
  if (client_org_id)  query = query.eq('client_org_id', client_org_id)
  if (opportunity_id) query = query.eq('opportunity_id', opportunity_id)
  if (q) {
    query = query.or(
      `quote_number.ilike.%${q}%,property_name.ilike.%${q}%,title.ilike.%${q}%`
    )
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ records: data ?? [], total: (data ?? []).length })
}

// POST /api/quotes — create a quote with auto-generated quote_number
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  const body = await req.json()

  const {
    title,
    client_org_id,
    opportunity_id,
    client_name,
    client_email,
    client_phone,
    site_id,
    property_name,
    units,
    notes,
    valid_until,
    line_items,
  } = body

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const org_id = user.isCorporate ? (body.org_id ?? null) : (user.org_id ?? null)

  // Auto-generate quote_number: GG-YYYY-NNNN
  const year = new Date().getFullYear()
  const { data: maxRow } = await supabase
    .from('quotes')
    .select('quote_number')
    .like('quote_number', `GG-${year}-%`)
    .order('quote_number', { ascending: false })
    .limit(1)
    .single()

  let nextSeq = 1
  if (maxRow?.quote_number) {
    const parts = (maxRow.quote_number as string).split('-')
    const last = parseInt(parts[parts.length - 1], 10)
    if (!isNaN(last)) nextSeq = last + 1
  }
  const quote_number = `GG-${year}-${String(nextSeq).padStart(4, '0')}`

  // Create the quote
  const { data: quote, error: quoteErr } = await supabase
    .from('quotes')
    .insert({
      quote_number,
      org_id,
      client_org_id:  client_org_id  ?? null,
      opportunity_id: opportunity_id ?? null,
      client_name:    client_name    ?? null,
      client_email:   client_email   ?? null,
      client_phone:   client_phone   ?? null,
      site_id:        site_id        ?? null,
      title,
      property_name:  property_name ?? null,
      units:          units ?? null,
      status:         'draft',
      notes:          notes ?? null,
      valid_until:    valid_until ?? null,
      total_one_time: 0,
      total_mrr:      0,
      dealer_mrr:     0,
    })
    .select()
    .single()

  if (quoteErr) return NextResponse.json({ error: quoteErr.message }, { status: 500 })

  // Insert line items if provided
  if (line_items && Array.isArray(line_items) && line_items.length > 0) {
    const rows = line_items.map((item: any, idx: number) => ({
      quote_id:    quote.id,
      sort_order:  idx,
      category:    item.category ?? 'General',
      description: item.description ?? '',
      qty:         item.qty ?? 1,
      unit_price:  item.unit_price ?? 0,
      is_recurring: item.is_recurring ?? false,
    }))

    const { error: itemsErr } = await supabase
      .from('quote_line_items')
      .insert(rows)

    if (!itemsErr) {
      // Recalculate totals
      const oneTime = rows.filter(r => !r.is_recurring).reduce((s, r) => s + r.qty * r.unit_price, 0)
      const mrr     = rows.filter(r =>  r.is_recurring).reduce((s, r) => s + r.qty * r.unit_price, 0)
      await supabase
        .from('quotes')
        .update({ total_one_time: oneTime, total_mrr: mrr })
        .eq('id', quote.id)
      quote.total_one_time = oneTime
      quote.total_mrr = mrr
    }
  }

  return NextResponse.json({ quote }, { status: 201 })
}
