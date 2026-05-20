import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// POST /api/surveys/[id]/create-quote
// Creates a quote (mode=line_item) from the survey's ai_bom.
// Sets survey.quote_id and survey.status='quote_created'.
// Returns { quote_id, quote_number }.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  // Load survey
  const { data: survey, error: fetchErr } = await supabase
    .from('surveys')
    .select('*')
    .eq('id', params.id)
    .single()

  if (fetchErr || !survey) {
    return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
  }
  if (!user.isCorporate && !scope.ids.includes(survey.org_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const bom: Array<{
    description: string
    sku?: string | null
    qty?: number
    unit?: string
    unit_price?: number
    priority?: string
    category?: string
    notes?: string | null
  }> = Array.isArray(survey.ai_bom) ? survey.ai_bom : []

  if (bom.length === 0) {
    return NextResponse.json(
      { error: 'No BOM found. Run /generate first.' },
      { status: 400 }
    )
  }

  const org_id = user.isCorporate ? (survey.org_id ?? null) : (scope.own_id ?? null)

  // Optional overrides from request body
  const body = await req.json().catch(() => ({}))
  const {
    client_name    = survey.property_name ?? '',
    client_email   = '',
    client_phone   = '',
    cover_message  = survey.ai_summary ?? '',
    terms_text     = '',
    tax_rate       = 0,
    discount_percent = 0,
    deposit_percent  = 30,
    expiry_days      = 30,
  } = body

  const expiry_date = new Date(Date.now() + expiry_days * 86400_000)
    .toISOString()
    .slice(0, 10)

  // ------------------------------------------------------------------
  // 1. Create the quote
  // ------------------------------------------------------------------
  const { data: quote, error: quoteErr } = await supabase
    .from('quotes')
    .insert({
      org_id,
      site_id:          survey.site_id          ?? null,
      opportunity_id:   survey.opportunity_id   ?? null,
      survey_id:        survey.id,
      quote_mode:       'line_item',
      status:           'draft',
      title:            survey.property_name ?? 'Untitled Survey Quote',
      property_name:    survey.property_name ?? null,
      client_name,
      client_email:     client_email   || null,
      client_phone:     client_phone   || null,
      property_address: survey.property_address ?? null,
      cover_message:    cover_message  || null,
      terms_text:       terms_text     || null,
      notes:            survey.ai_sow ?? null,
      tax_rate,
      discount_percent,
      deposit_percent,
      expiry_date,
      created_by_name:  user.name ?? null,
    })
    .select('id, quote_number')
    .single()

  if (quoteErr || !quote) {
    return NextResponse.json({ error: quoteErr?.message ?? 'Quote creation failed' }, { status: 500 })
  }

  // ------------------------------------------------------------------
  // 2. Insert line items from BOM
  // ------------------------------------------------------------------
  const priorityToSection = (p: string) => {
    if (p === 'urgent')      return 'Urgent Repairs'
    if (p === 'recommended') return 'Recommended Work'
    return 'Optional Upgrades'
  }

  const itemTypeMap: Record<string, string> = {
    equipment: 'equipment',
    labor:     'labor',
    material:  'equipment',
    service:   'service',
  }

  const lineItems = bom.map((item, idx) => ({
    quote_id:     quote.id,
    description:  item.description ?? 'Item',
    sku:          item.sku         ?? null,
    qty:          item.qty         ?? 1,
    unit:         item.unit        ?? 'each',
    unit_price:   item.unit_price  ?? 0,
    sort_order:   idx,
    section_name: priorityToSection(item.priority ?? 'recommended'),
    item_type:    itemTypeMap[item.category ?? 'equipment'] ?? 'equipment',
    is_optional:  item.priority === 'optional',
    is_included:  item.priority !== 'optional',
    notes:        item.notes ?? null,
  }))

  // Try to match BOM items to products catalog
  const { data: products } = await supabase
    .from('products')
    .select('id, name, sku, list_price')

  const productMap = new Map<string, { id: string; list_price: number | null }>()
  if (products) {
    for (const p of products) {
      if (p.sku) productMap.set(p.sku.toLowerCase(), { id: p.id, list_price: p.list_price })
      productMap.set(p.name.toLowerCase(), { id: p.id, list_price: p.list_price })
    }
  }

  // Apply product_id to line items where we find a match
  const lineItemsWithProducts = lineItems.map(item => {
    // Try SKU match first
    if (item.sku) {
      const hit = productMap.get(item.sku.toLowerCase())
      if (hit) return { ...item, product_id: hit.id }
    }
    // Try name/description fuzzy match (contains)
    const descLower = item.description.toLowerCase()
    for (const [key, hit] of productMap.entries()) {
      if (descLower.includes(key) || key.includes(descLower.split(' ')[0])) {
        return { ...item, product_id: hit.id }
      }
    }
    return item
  })

  const { error: itemErr } = await supabase
    .from('quote_line_items')
    .insert(lineItemsWithProducts)

  if (itemErr) {
    // Roll back the quote so we don't leave orphaned records — non-blocking
    void (async () => {
      try { await supabase.from('quotes').delete().eq('id', quote.id) } catch (_) { /* ignore */ }
    })()
    return NextResponse.json({ error: itemErr.message }, { status: 500 })
  }

  // ------------------------------------------------------------------
  // 3. Update survey — set quote_id + status
  // ------------------------------------------------------------------
  await supabase
    .from('surveys')
    .update({
      quote_id:   quote.id,
      status:     'quote_created',
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)

  return NextResponse.json(
    { quote_id: quote.id, quote_number: quote.quote_number },
    { status: 201 }
  )
}
