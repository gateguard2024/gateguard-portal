import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// ─── POST /api/invoices/[id]/qb-sync ─────────────────────────────────────────
// Pushes an invoice to QuickBooks Online (OUTBOUND ONLY).
//
// QuickBooks Online REST API v3:
//   POST https://quickbooks.api.intuit.com/v3/company/{realmId}/invoice
//   Headers: Authorization: Bearer {access_token}, Content-Type: application/json, Accept: application/json
//
// PRODUCTION NOTE: QB access tokens expire after 1 hour. A full OAuth2 refresh flow is needed
// for production. The QBO_ACCESS_TOKEN env var is a long-lived token for development/staging.
// Implement token refresh using QBO_REFRESH_TOKEN + QBO_CLIENT_ID + QBO_CLIENT_SECRET before
// going live.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  const { data: invoice, error: fetchErr } = await supabase
    .from('invoices')
    .select(`
      id, invoice_number, org_id, client_org_id, site_id,
      status, issue_date, due_date, subtotal, tax_amount, total,
      notes, qb_invoice_id,
      invoice_line_items ( service_type, description, qty, unit_price, amount, is_recurring )
    `)
    .eq('id', params.id)
    .single()

  if (fetchErr || !invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }
  if (!scope.all && invoice.org_id && !scope.ids.includes(invoice.org_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Check QB env vars — don't block invoice flow if not configured
  const { QBO_ACCESS_TOKEN, QBO_REALM_ID } = process.env
  if (!QBO_ACCESS_TOKEN || !QBO_REALM_ID) {
    console.warn('[qb-sync] QB not configured — skipping sync')
    return NextResponse.json({ skipped: true, reason: 'QB not configured' })
  }

  // Fetch client org name for QB CustomerRef
  let customerName = 'GateGuard Client'
  if (invoice.client_org_id) {
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', invoice.client_org_id)
      .single()
    customerName = org?.name ?? customerName
  }

  // Build QB invoice payload
  // Line items use SalesItemLineDetail (Income account lookup by name)
  const lineItems = (invoice.invoice_line_items ?? []).map((li: {
    description: string
    qty: number
    unit_price: number
    service_type: string
  }, idx: number) => ({
    Id:          String(idx + 1),
    LineNum:     idx + 1,
    Description: li.description,
    Amount:      parseFloat((li.qty * li.unit_price).toFixed(2)),
    DetailType:  'SalesItemLineDetail',
    SalesItemLineDetail: {
      Qty:       li.qty,
      UnitPrice: li.unit_price,
      // QB requires a valid ItemRef — using a default "Services" item
      // In production, map service_type → a configured QB item ID per org
      ItemRef: { name: 'Services', value: '1' },
    },
  }))

  const qbInvoice: Record<string, unknown> = {
    DocNumber:     invoice.invoice_number,
    TxnDate:       invoice.issue_date,
    DueDate:       invoice.due_date,
    CustomerRef:   { name: customerName },
    Line:          lineItems,
    CustomerMemo:  invoice.notes ? { value: invoice.notes } : undefined,
  }

  try {
    const qbUrl = `https://quickbooks.api.intuit.com/v3/company/${QBO_REALM_ID}/invoice`
    const method = invoice.qb_invoice_id ? 'POST' : 'POST' // QB uses POST for both create + update (with sparse update)

    const response = await fetch(qbUrl, {
      method,
      headers: {
        'Authorization': `Bearer ${QBO_ACCESS_TOKEN}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
      },
      body: JSON.stringify(qbInvoice),
    })

    if (!response.ok) {
      const errBody = await response.text()
      console.error('[qb-sync] QB API error:', response.status, errBody)
      return NextResponse.json({ error: `QB API error: ${response.status}`, detail: errBody }, { status: 502 })
    }

    const qbResult = await response.json()
    const qbId = qbResult?.Invoice?.Id ?? qbResult?.Id ?? null

    // Store QB ID and sync timestamp
    const { error: updateErr } = await supabase
      .from('invoices')
      .update({
        qb_invoice_id: qbId,
        qb_synced_at:  new Date().toISOString(),
        updated_at:    new Date().toISOString(),
      })
      .eq('id', params.id)

    if (updateErr) {
      console.error('[qb-sync] Failed to store QB ID:', updateErr.message)
    }

    return NextResponse.json({ ok: true, qb_invoice_id: qbId })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[qb-sync] Unexpected error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
