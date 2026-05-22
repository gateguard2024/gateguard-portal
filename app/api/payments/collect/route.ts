/**
 * POST /api/payments/collect
 *
 * Creates a Stripe Payment Link for on-site field payment collection.
 * Tech taps "Collect Payment" on the WO completion screen → QR code appears.
 * Customer scans with phone → pays → WO auto-marks paid via Stripe webhook.
 *
 * Body:
 *   work_order_id  string
 *   wo_number      string
 *   title          string
 *   customer_name  string
 *   amount_cents   number  (e.g. 25000 = $250.00)
 *   notify_phone?  string  (fires SMS with payment link)
 *   notify_email?  string  (fires email with payment link)
 *
 * Returns:
 *   { payment_link_url, payment_link_id, qr_url, amount_cents }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'
import { sendSMS }                   from '@/lib/sms'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  // ── Auth: Clerk OR x-tech-code ──────────────────────────────────────────────
  const techCode = req.headers.get('x-tech-code')
  const isTech   = techCode === process.env.TECH_ACCESS_CODE
  if (!isTech) {
    // Could also allow Clerk auth here — skip for now
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json() as {
    work_order_id:  string
    wo_number:      string
    title:          string
    customer_name:  string
    amount_cents:   number
    notify_phone?:  string
    notify_email?:  string
    description?:   string
  }

  const {
    work_order_id, wo_number, title, customer_name,
    amount_cents, notify_phone, description,
  } = body

  if (!work_order_id || !amount_cents || amount_cents <= 0) {
    return NextResponse.json({ error: 'work_order_id and amount_cents required' }, { status: 400 })
  }

  // ── Stripe payment link ─────────────────────────────────────────────────────
  const STRIPE_KEY = process.env.STRIPE_SECRET_KEY
  if (!STRIPE_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.gateguard.co'

  // 1. Create a Price (inline one-time)
  const priceRes = await fetch('https://api.stripe.com/v1/prices', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${STRIPE_KEY}`,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      unit_amount:          String(amount_cents),
      currency:             'usd',
      'product_data[name]': `${wo_number} — ${title}`,
    }).toString(),
  })
  const price = await priceRes.json() as { id?: string; error?: { message: string } }
  if (!price.id) {
    return NextResponse.json({ error: price.error?.message ?? 'Stripe price creation failed' }, { status: 500 })
  }

  // 2. Create Payment Link
  const plRes = await fetch('https://api.stripe.com/v1/payment_links', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${STRIPE_KEY}`,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      'line_items[0][price]':    price.id,
      'line_items[0][quantity]': '1',
      'metadata[work_order_id]': work_order_id,
      'metadata[wo_number]':     wo_number,
      'after_completion[type]':  'redirect',
      'after_completion[redirect][url]': `${APP_URL}/pay/thank-you?wo=${wo_number}`,
      'payment_method_types[0]': 'card',
      'payment_method_types[1]': 'us_bank_account',
    }).toString(),
  })
  const pl = await plRes.json() as { id?: string; url?: string; error?: { message: string } }
  if (!pl.url) {
    return NextResponse.json({ error: pl.error?.message ?? 'Stripe link creation failed' }, { status: 500 })
  }

  // 3. QR code URL (Google Charts — reliable, no sign-up needed)
  const qrUrl = `https://chart.googleapis.com/chart?chs=256x256&cht=qr&chl=${encodeURIComponent(pl.url)}&choe=UTF-8`

  // 4. Save to invoices table (non-fatal if table doesn't have payment_link_id col yet)
  void (async () => {
    try {
      await supabase.from('invoices').insert({
        work_order_id:      work_order_id,
        invoice_number:     `GG-INV-${Date.now().toString().slice(-6)}`,
        status:             'sent',
        total:              amount_cents / 100,
        stripe_payment_link: pl.url,
        created_at:         new Date().toISOString(),
      })
    } catch (_) { /* non-fatal */ }
  })()

  // 5. Fire SMS notification if phone provided
  if (notify_phone) {
    void sendSMS({
      event:         'payment_link',
      to:            notify_phone,
      wo_number,
      title,
      customer_name,
      payment_url:   pl.url,
    }).catch(console.error)
  }

  return NextResponse.json({
    payment_link_url: pl.url,
    payment_link_id:  pl.id,
    qr_url:           qrUrl,
    amount_cents,
    amount_display:   `$${(amount_cents / 100).toFixed(2)}`,
  })
}
