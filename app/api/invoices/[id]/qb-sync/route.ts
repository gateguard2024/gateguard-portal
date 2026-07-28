import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'
import { getQboAuth, qboApi } from '@/lib/qbo'

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
// Token handling lives in lib/qbo.ts (getQboAuth) — it auto-refreshes the QBO
// access token from the stored connection, so this route never touches env tokens
// directly. CustomerRef.value comes from organizations.qbo_customer_id (mapping).
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

  // Resolve a valid access token (auto-refreshes) + realm. Falls back to the
  // legacy QBO_ACCESS_TOKEN/QBO_REALM_ID env inside getQboAuth if not connected.
  const auth = await getQboAuth()
  if (!auth.ok) {
    return NextResponse.json({ skipped: true, reason: auth.reason })
  }

  // QBO requires CustomerRef.value (the QBO Customer Id). Resolve it from the
  // client org's stored mapping — a name alone is not reliable.
  let customerId: string | null = null
  let customerName = 'GateGuard Client'
  if (invoice.client_org_id) {
    const { data: org } = await supabase
      .from('organizations')
      .select('name, qbo_customer_id')
      .eq('id', invoice.client_org_id)
      .single()
    customerName = org?.name ?? customerName
    customerId = org?.qbo_customer_id ?? null
  }
  if (!customerId) {
    return NextResponse.json({
      skipped: true,
      reason: 'This client is not linked to a QuickBooks customer yet. Link it in QuickBooks settings, then retry.',
    })
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
    CustomerRef:   { value: customerId, name: customerName },
    Line:          lineItems,
    CustomerMemo:  invoice.notes ? { value: invoice.notes } : undefined,
  }

  try {
    // POST /invoice handles both create and sparse update; token + realm come from auth.
    const response = await qboApi(auth, '/invoice', {
      method: 'POST',
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
