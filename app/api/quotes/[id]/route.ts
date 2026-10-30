import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'
import { opportunityInScope } from '@/lib/crm-scope'
import { quoteEvent, syncDealFromQuote } from '@/lib/deal-sync'

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
      id, quote_number, org_id, client_org_id, site_id, created_by,
      title, status, property_name, units,
      total_one_time, total_mrr, dealer_mrr,
      valid_until, accepted_at, sent_at, declined_at,
      notes, pdf_url, share_token, work_order_id,
      created_at, updated_at,
      quote_mode, client_name, client_email, client_phone, property_address,
      cover_message, terms_text, tax_rate, discount_percent, deposit_percent,
      survey_id, package_mode, selected_package, created_by_name, expiry_date,
      payment_plan, ramp_up_start_pct, ramp_up_step_pct, ramp_up_full_month,
      whats_included, payment_schedule_json, sow_text,
      agreement_type, agreement_html, attachments,
      signed_at, signer_name, signer_email,
      accepted_by_rep, accepted_by_rep_name,
      quote_line_items (
        id, sort_order, category, description, qty, unit_price, unit, is_recurring,
        section_name, product_id, item_type, is_optional, is_included,
        package_tier, model_number, notes, sku, created_at,
        line_discount_percent
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

  // Resolve each line's image live from the products catalog (single source of truth).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pids = Array.from(new Set(sortedItems.map((i: any) => i.product_id).filter(Boolean)))
  let imgById = new Map<string, string | null>()
  if (pids.length > 0) {
    const { data: prods } = await supabase.from('products').select('id, image_url').in('id', pids)
    imgById = new Map((prods ?? []).map(p => [p.id, p.image_url]))
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itemsWithImages = sortedItems.map((i: any) => ({ ...i, image_url: i.product_id ? (imgById.get(i.product_id) ?? null) : null }))

  // Rep (creator) contact for the proposal signature: their dealer, phone, email.
  let created_by_phone: string | null = null
  let created_by_email: string | null = null
  let dealer_name: string | null = null
  if (quote.created_by) {
    const { data: rep } = await supabase
      .from('profiles')
      .select('phone, email, org_id')
      .eq('id', quote.created_by)
      .maybeSingle()
    if (rep) {
      created_by_phone = rep.phone ?? null
      created_by_email = rep.email ?? null
      if (rep.org_id) {
        const { data: repOrg } = await supabase.from('organizations').select('name').eq('id', rep.org_id).maybeSingle()
        dealer_name = repOrg?.name ?? null
      }
    }
  }

  return NextResponse.json({ quote: { ...quote, quote_line_items: itemsWithImages, client_org_name, site_name, created_by_phone, created_by_email, dealer_name } })
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
    // migration 042 enrichment fields
    'quote_mode', 'client_name', 'client_email', 'client_phone', 'property_address',
    'cover_image_url', 'cover_message', 'terms_text', 'tax_rate', 'discount_percent',
    'deposit_percent', 'survey_id', 'package_mode', 'selected_package',
    'created_by_name', 'expiry_date',
    // migration 055 payment plan fields
    'payment_plan', 'ramp_up_start_pct', 'ramp_up_step_pct', 'ramp_up_full_month',
    // migration 091 proposal v2 fields
    'whats_included', 'payment_schedule_json', 'sow_text',
    'agreement_type', 'agreement_html', 'attachments',
    'accepted_by_rep', 'accepted_by_rep_name',
    // migration 182 module-based proposal
    'proposal_blocks', 'proposal_theme',
    // migration 184 known site variables (intake counts)
    'site_vars',
    // migration 185 Property Partnership proposal config + mode
    'partnership', 'quote_mode',
  ]

  const updates: Record<string, unknown> = {}
  for (const key of allowedFields) {
    if (key in body) updates[key] = body[key]
  }

  // Status transition side effects
  const newStatus = body.status as string | undefined
  // Linking a quote to a deal: the deal must be one this user can see.
  if ('opportunity_id' in body) {
    if (body.opportunity_id && !(await opportunityInScope(String(body.opportunity_id)))) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }
    updates.opportunity_id = body.opportunity_id || null
  }
  if (newStatus === 'sent'     && !body.sent_at)     updates.sent_at     = new Date().toISOString()
  if (newStatus === 'accepted' && !body.accepted_at) updates.accepted_at = new Date().toISOString()
  if (newStatus === 'declined' && !body.declined_at) updates.declined_at = new Date().toISOString()

  // Review gate (migration 187): a dealer's partnership proposal enters/returns to
  // 'draft' on every save — so any edit must be re-submitted and re-approved before
  // it can be sent. Corporate saves are auto-approved. review_status is never
  // client-settable (not in allowedFields) — only derived here or via /review.
  const savingPartnership = body.quote_mode === 'partnership' || body.partnership != null
  if (savingPartnership) updates.review_status = user.isCorporate ? 'approved' : 'draft'

  updates.updated_at = new Date().toISOString()

  let { data: updated, error: updateErr } = await supabase
    .from('quotes')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  // Drift-safe: if review_status isn't migrated yet, don't block the save.
  if (updateErr && (updateErr.code === '42703' || updateErr.code === 'PGRST204') && 'review_status' in updates) {
    delete updates.review_status
    ;({ data: updated, error: updateErr } = await supabase
      .from('quotes').update(updates).eq('id', params.id).select().single())
  }

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // Deal side: status events move/annotate the deal; any other save keeps deal values in step.
  if (newStatus && newStatus !== existing.status && ['sent', 'accepted', 'declined'].includes(newStatus)) {
    await quoteEvent(params.id, newStatus as 'sent' | 'accepted' | 'declined', { id: user.id, name: user.name })
  } else {
    await syncDealFromQuote(params.id)
  }
  return NextResponse.json({ quote: updated })
}

// The quote builder's "Mark accepted / declined" buttons POST here (only "sent" uses
// /send). There was no POST handler, so those buttons failed with 405.
export const POST = PATCH

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
