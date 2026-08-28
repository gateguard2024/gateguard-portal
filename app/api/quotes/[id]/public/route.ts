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
      proposal_blocks, proposal_theme, site_vars, partnership,
      agreement_type, agreement_html, attachments,
      signed_at, signer_name, signer_email,
      accepted_by_rep, accepted_by_rep_name,
      quote_line_items (
        id, sort_order, category, description, qty, unit_price, unit, is_recurring,
        section_name, item_type, is_optional, is_included, product_id,
        package_tier, model_number, notes, sku
      )
    `)
    .eq('id', params.id)
    .single()

  if (error || !quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Sort line items
  const rawItems = (quote.quote_line_items ?? []).sort(
    (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
  )

  // Resolve each line's image live from the products catalog (single source of truth).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pids = Array.from(new Set(rawItems.map((i: any) => i.product_id).filter(Boolean)))
  let imgById = new Map<string, string | null>()
  if (pids.length > 0) {
    const { data: prods } = await supabase.from('products').select('id, image_url').in('id', pids)
    imgById = new Map((prods ?? []).map(p => [p.id, p.image_url]))
  }

  // Map to camelCase LineItem shape expected by the proposal page
  const lineItems = rawItems.map((i: {
    id: string; description: string; qty: number; unit_price: number;
    is_recurring: boolean; section_name?: string; is_optional?: boolean;
    is_included?: boolean; unit?: string; sku?: string; model_number?: string;
    package_tier?: string; item_type?: string; notes?: string; product_id?: string | null;
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
    notes:        i.notes,
    imageUrl:     i.product_id ? (imgById.get(i.product_id) ?? null) : null,
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

  // "Sent back to us" — notify the team when a proposal is accepted/signed.
  if (action === 'sign' || action === 'approve') {
    try {
      const { data: q } = await supabase
        .from('quotes')
        .select('quote_number, property_name, client_name, total_mrr, total_one_time, created_by_name')
        .eq('id', params.id).single()
      const key = process.env.RESEND_API_KEY
      const from = process.env.RESEND_DOCUMENTS_FROM_EMAIL || 'documents@nexus.gateguard.co'
      if (q && key) {
        const money = (n: unknown) => '$' + Math.round(Number(n) || 0).toLocaleString()
        const who = signer_name || 'the client'
        const subject = `✅ Proposal accepted — ${q.quote_number} · ${q.property_name || q.client_name || ''}`.trim()
        const bodyHtml = `<div style="font-family:system-ui,sans-serif;font-size:15px;color:#0f1722">
          <h2 style="margin:0 0 8px">Proposal accepted &amp; signed</h2>
          <p><b>${q.quote_number}</b> — ${q.property_name || q.client_name || ''}</p>
          <p>Signed by <b>${who}</b>${signer_email ? ` (${signer_email})` : ''} at ${new Date(ts).toLocaleString()}${ip && ip !== 'unknown' ? ` · IP ${ip}` : ''}.</p>
          <p>Monthly ${money(q.total_mrr)} · One-time ${money(q.total_one_time)}${q.created_by_name ? ` · Prepared by ${q.created_by_name}` : ''}.</p>
        </div>`
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: `Gate Guard <${from}>`, to: ['rfeldman@gateguard.co'], subject, html: bodyHtml }),
        })
      }
    } catch { /* notification is best-effort — never fail the acceptance */ }
  }

  return NextResponse.json({ quote: updated })
}
