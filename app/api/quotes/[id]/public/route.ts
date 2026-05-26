import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// GET /api/quotes/[id]/public — public fetch (no Clerk auth required)
// Used by client-facing proposal + approve pages
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { data: quote, error } = await supabase
    .from('quotes')
    .select(`
      id, quote_number, title, status, property_name, units,
      total_one_time, total_mrr, valid_until, accepted_at, sent_at, declined_at,
      notes, share_token, org_id, opportunity_id, created_at,
      quote_mode, client_name, client_email, client_phone, property_address,
      cover_message, terms_text, tax_rate, discount_percent, deposit_percent,
      package_mode, selected_package, created_by_name, expiry_date,
      payment_plan, ramp_up_start_pct, ramp_up_step_pct, ramp_up_full_month,
      whats_included, payment_schedule_json, sow_text,
      agreement_type, agreement_html, attachments,
      signed_at, signer_name, signer_email,
      accepted_by_rep, accepted_by_rep_name,
      quote_line_items (
        id, sort_order, category, description, qty, unit_price, unit, is_recurring,
        section_name, item_type, is_optional, is_included,
        package_tier, image_url, model_number, notes, sku
      )
    `)
    .eq('id', params.id)
    .single()

  if (error || !quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Sort line items
  const rawItems = (quote.quote_line_items ?? []).sort(
    (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
  )

  // Map to camelCase LineItem shape expected by the proposal page
  const lineItems = rawItems.map((i: {
    id: string; description: string; qty: number; unit_price: number;
    is_recurring: boolean; section_name?: string; is_optional?: boolean;
    is_included?: boolean; unit?: string; sku?: string; model_number?: string;
    package_tier?: string; item_type?: string; notes?: string;
  }) => ({
    id:           i.id,
    description:  i.description,
    qty:          i.qty,
    unitPrice:    i.unit_price,
    total:        i.qty * i.unit_price,
    recurring:    i.is_recurring,
    section_name: i.section_name,
    is_optional:  i.is_optional,
    is_included:  i.is_included,
    unit:         i.unit,
    sku:          i.sku,
    model_number: i.model_number,
    package_tier: i.package_tier,
    item_type:    i.item_type,
  }))

  // Fetch org info for "Prepared by"
  let org_name: string | null = null
  if (quote.org_id) {
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', quote.org_id)
      .single()
    org_name = org?.name ?? null
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { quote_line_items: _raw, ...quoteRest } = quote as typeof quote & { quote_line_items: unknown[] }

  return NextResponse.json({
    quote:     { ...quoteRest, org_name },
    lineItems,
    org_name,
  })
}

// POST /api/quotes/[id]/public — approve, decline, or sign (no auth required)
// Body:
//   action: 'approve' | 'decline' | 'sign'
//   For sign: { signer_name, signer_email, signature_data (base64 PNG) }
//   For approve: { selected_option?, item_selections? }
//   For decline: { decline_note? }
//   rep_accept: true — dealer accepting on behalf of client (sets accepted_by_rep)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json()
  const { action, selected_option, item_selections, decline_note,
          signer_name, signer_email, signature_data, rep_accept } = body

  if (!['approve', 'decline', 'sign'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  // Grab client IP (best-effort for audit trail)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
           ?? req.headers.get('x-real-ip')
           ?? 'unknown'

  const ts = new Date().toISOString()
  const updates: Record<string, unknown> = { updated_at: ts }

  if (action === 'sign') {
    // Capture signature — sets signed_at but does NOT change status yet
    if (!signer_name) return NextResponse.json({ error: 'signer_name required' }, { status: 400 })
    updates.signed_at      = ts
    updates.signer_name    = signer_name
    updates.signer_email   = signer_email ?? null
    updates.signer_ip      = ip
    updates.signature_data = signature_data ?? null
    // Also approve when signing
    updates.status         = 'accepted'
    updates.accepted_at    = ts
    if (rep_accept) {
      updates.accepted_by_rep      = true
      updates.accepted_by_rep_name = signer_name
    }
  } else if (action === 'approve') {
    updates.status      = 'accepted'
    updates.accepted_at = ts
    if (selected_option) updates.selected_package = selected_option
    if (rep_accept) {
      updates.accepted_by_rep      = true
      updates.accepted_by_rep_name = signer_name ?? 'Rep'
    }
  } else {
    updates.status      = 'declined'
    updates.declined_at = ts
    if (decline_note) updates.notes = decline_note
  }

  // Update client-selected optional items
  if (item_selections && Array.isArray(item_selections)) {
    for (const sel of item_selections) {
      await supabase
        .from('quote_line_items')
        .update({ is_included: sel.is_included })
        .eq('id', sel.id)
        .eq('quote_id', params.id)
    }
  }

  const { data: updated, error } = await supabase
    .from('quotes')
    .update(updates)
    .eq('id', params.id)
    .select('id, status, accepted_at, declined_at, signed_at, signer_name, accepted_by_rep')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ quote: updated })
}
