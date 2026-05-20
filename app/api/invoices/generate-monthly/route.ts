import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// ─── POST /api/invoices/generate-monthly ─────────────────────────────────────
// Auto-generates invoices for all active sites that have billing configured.
// Idempotent — skips sites that already have an invoice for the current month.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user.canViewFinancials) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const targetMonth: string = body.month ?? new Date().toISOString().slice(0, 7) // YYYY-MM

  // Fetch all active sites with billing configured
  const { data: sites, error: sitesErr } = await supabase
    .from('sites')
    .select(`
      id, name, address, city, state, zip,
      units, org_id, master_dealer_id, service_dealer_id,
      billing_video_fee, billing_unit_rate, billing_units, billing_notes
    `)
    .eq('status', 'active')
    .or('billing_video_fee.gt.0,billing_units.gt.0')

  if (sitesErr) return NextResponse.json({ error: sitesErr.message }, { status: 500 })

  const activeSites = sites ?? []
  if (activeSites.length === 0) {
    return NextResponse.json({ created: 0, skipped: 0, message: 'No billable sites found' })
  }

  // Find sites that already have an invoice for this month (avoid duplicates)
  const monthStart = `${targetMonth}-01`
  const monthEnd   = new Date(new Date(monthStart).setMonth(new Date(monthStart).getMonth() + 1))
    .toISOString().split('T')[0]

  const { data: existingInvoices } = await supabase
    .from('invoices')
    .select('site_id, issue_date')
    .gte('issue_date', monthStart)
    .lt('issue_date', monthEnd)
    .not('status', 'eq', 'void')

  const invoicedSiteIds = new Set((existingInvoices ?? []).map(i => i.site_id).filter(Boolean))

  let created = 0
  let skipped = 0
  const errors: string[] = []

  // Auto-increment invoice number
  const { data: lastInv } = await supabase
    .from('invoices')
    .select('invoice_number')
    .order('created_at', { ascending: false })
    .limit(1)

  let nextNum = 120045
  if (lastInv && lastInv.length > 0) {
    const parsed = parseInt(lastInv[0].invoice_number.replace('GG-INV-', ''), 10)
    if (!isNaN(parsed)) nextNum = parsed + 1
  }

  for (const site of activeSites) {
    if (invoicedSiteIds.has(site.id)) {
      skipped++
      continue
    }

    // Build line items
    const lineItems: Array<{
      service_type: string
      description: string
      qty: number
      unit_price: number
      is_recurring: boolean
      sort_order: number
    }> = []

    // Video monitoring fee
    if (site.billing_video_fee && site.billing_video_fee > 0) {
      lineItems.push({
        service_type: 'video_monitoring',
        description:  'Video Monitoring Fee — Monthly',
        qty:          1,
        unit_price:   parseFloat(String(site.billing_video_fee)),
        is_recurring: true,
        sort_order:   0,
      })
    }

    // Access plan: $5.00/unit/month
    const billingUnits = site.billing_units ?? site.units ?? 0
    const unitRate     = site.billing_unit_rate ?? 5.00
    if (billingUnits > 0 && unitRate > 0) {
      lineItems.push({
        service_type: 'access_plan',
        description:  `GateGuard Access Plan — ${billingUnits} units × $${parseFloat(String(unitRate)).toFixed(2)}/unit/mo (includes gate service, Brivo, PMS integration, 36-month agreement)`,
        qty:          billingUnits,
        unit_price:   parseFloat(String(unitRate)),
        is_recurring: true,
        sort_order:   1,
      })
    }

    if (lineItems.length === 0) {
      skipped++
      continue
    }

    const subtotal = lineItems.reduce((s, li) => s + li.qty * li.unit_price, 0)
    const invoiceNum = `GG-INV-${String(nextNum).padStart(6, '0')}`
    nextNum++

    // Create invoice
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .insert({
        org_id:        site.org_id ?? site.master_dealer_id ?? null,
        site_id:       site.id,
        invoice_number: invoiceNum,
        status:        'draft',
        issue_date:    monthStart,
        due_date:      monthStart, // due on receipt
        subtotal,
        tax_amount:    0,
        total:         subtotal,
        amount_paid:   0,
        notes:         site.billing_notes ?? null,
      })
      .select('id')
      .single()

    if (invErr || !invoice) {
      errors.push(`${site.name}: ${invErr?.message ?? 'unknown error'}`)
      continue
    }

    // Insert line items
    const { error: liErr } = await supabase
      .from('invoice_line_items')
      .insert(lineItems.map(li => ({ ...li, invoice_id: invoice.id })))

    if (liErr) {
      errors.push(`${site.name} line items: ${liErr.message}`)
    } else {
      created++
    }
  }

  return NextResponse.json({
    created,
    skipped,
    month:  targetMonth,
    errors: errors.length > 0 ? errors : undefined,
  })
}
