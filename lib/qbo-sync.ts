/**
 * QuickBooks two-way sync — Gate Guard's ONE QuickBooks company (corporate only).
 *
 * Who owns what:
 *   Nexus owns   → sites/customers it creates, invoices made in Nexus, payments
 *                  collected in Nexus (Stripe / mark paid), dealer commission payouts.
 *   QuickBooks   → the books: chart of accounts, items, bank, payments recorded
 *                  there, invoices made there.
 *
 *   To QuickBooks : customers (find or create) · catalog items · invoices (create,
 *                   update while unpaid, void) · payments (the new amount only) ·
 *                   approved dealer commissions as vendor bills.
 *   From QuickBooks: invoice balances/paid state, QuickBooks-made invoices for linked
 *                   customers, deleted/voided invoices, commission bills paid.
 *
 * Safety:
 *   - Nothing is sent until auto-sync is on (or someone presses "Sync now"), and
 *     only records dated on/after the sync start date — history is never dumped
 *     into the books.
 *   - Every create looks first for an existing record (DocNumber / name), so a
 *     retry after a crash never makes a duplicate.
 *   - Payments send only the difference (amount_paid − qb_paid_amount).
 *   - One sync at a time (qbo_claim_sync); every record logged in qbo_sync_log.
 */
import { createClient } from '@supabase/supabase-js'
import { getQboAuth, qboJson, qboQuery, type QboAuth } from '@/lib/qbo'
import { todayET } from '@/lib/tz'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>
type Auth = Extract<QboAuth, { ok: true }>

export const qdb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
const money = (n: unknown) => Math.round((Number(n) || 0) * 100) / 100
const SENDABLE = ['sent', 'viewed', 'overdue', 'paid', 'partial']

export interface QboSettings {
  auto_sync: boolean
  sync_start_date: string | null
  default_item_id: string | null
  item_map: Record<string, string>
  income_account_id: string | null
  deposit_account_id: string | null
  commission_account_id: string | null
  sync_commissions: boolean
  auto_create_customers: boolean
}
const DEFAULTS: QboSettings = { auto_sync: false, sync_start_date: null, default_item_id: null, item_map: {}, income_account_id: null, deposit_account_id: null, commission_account_id: null, sync_commissions: false, auto_create_customers: true }

export async function getSettings(): Promise<QboSettings> {
  const { data, error } = await qdb().from('qbo_settings').select('*').eq('id', 1).maybeSingle()
  if (error || !data) return { ...DEFAULTS }
  return { ...DEFAULTS, ...(data as Partial<QboSettings>), item_map: (data.item_map as Record<string, string>) ?? {} }
}

export async function logSync(direction: 'to_qb' | 'from_qb', entity: string, status: 'ok' | 'error' | 'skipped', message: string, nexusId?: string | null, qboId?: string | null) {
  const { error } = await qdb().from('qbo_sync_log').insert({ direction, entity, status, message: message.slice(0, 1000), nexus_id: nexusId ?? null, qbo_id: qboId ?? null })
  if (error) console.error('[qbo-sync] log failed', error.message)
}

// ── Customers ────────────────────────────────────────────────────────────────
/** QuickBooks DisplayName is unique across customers, vendors and employees, ≤100 chars, no colon. */
const displayName = (n: string) => n.replace(/:/g, '-').replace(/\s+/g, ' ').trim().slice(0, 100) || 'Unnamed'

async function findCustomerByName(auth: Auth, name: string): Promise<{ id: string | null } | { error: string }> {
  const q = await qboQuery<Row>(auth, `select Id, DisplayName from Customer where DisplayName = '${esc(displayName(name))}'`)
  if (!q.ok) return { error: q.error }
  return { id: q.rows[0]?.Id ? String(q.rows[0].Id) : null }
}

/** Find or create the QuickBooks customer for a site (or, failing that, the client company). Saves the link. */
export async function ensureCustomer(auth: Auth, ref: { siteId?: string | null; orgId?: string | null }, settings: QboSettings): Promise<{ id: string } | { error: string }> {
  const db = qdb()
  let site: Row | null = null, org: Row | null = null
  if (ref.siteId) {
    const { data, error } = await db.from('sites').select('id, name, address, city, state, zip, primary_contact_email, pm_email, primary_contact_phone, qbo_customer_id').eq('id', ref.siteId).maybeSingle()
    if (error) return { error: error.message }
    site = data
    if (site?.qbo_customer_id) return { id: String(site.qbo_customer_id) }
  }
  if (ref.orgId) {
    const { data, error } = await db.from('organizations').select('id, name, qbo_customer_id').eq('id', ref.orgId).maybeSingle()
    if (error) return { error: error.message }
    org = data
    if (!site && org?.qbo_customer_id) return { id: String(org.qbo_customer_id) }
  }
  const subject = site ?? org
  if (!subject?.name) return { error: 'This invoice has no property or client to bill.' }
  // Same name already in QuickBooks → link it.
  // A failed lookup must stop here — creating anyway would make a duplicate customer.
  const found = await findCustomerByName(auth, subject.name)
  if ('error' in found) return { error: `Couldn’t look up the customer in QuickBooks: ${found.error}` }
  let id = found.id
  if (!id) {
    if (!settings.auto_create_customers) return { error: `“${subject.name}” isn’t linked to a QuickBooks customer. Link it on the QuickBooks page.` }
    const body: Row = { DisplayName: displayName(subject.name), CompanyName: String(subject.name).slice(0, 100) }
    const email = site?.pm_email || site?.primary_contact_email
    if (email) body.PrimaryEmailAddr = { Address: String(email) }
    if (site?.primary_contact_phone) body.PrimaryPhone = { FreeFormNumber: String(site.primary_contact_phone) }
    if (site?.address) body.BillAddr = { Line1: site.address, City: site.city ?? undefined, CountrySubDivisionCode: site.state ?? undefined, PostalCode: site.zip ?? undefined }
    let r = await qboJson<Row>(auth, '/customer', { method: 'POST', body })
    // 6240 = name already used. Check customers again (another run may have just
    // made it); only if it's a vendor/employee name, make the customer name distinct.
    if (!r.ok && r.code === '6240') {
      const again = await findCustomerByName(auth, subject.name)
      if ('id' in again && again.id) r = { ok: true, data: { Customer: { Id: again.id } } }
      else r = await qboJson<Row>(auth, '/customer', { method: 'POST', body: { ...body, DisplayName: displayName(`${subject.name} (Customer)`) } })
    }
    if (!r.ok) { await logSync('to_qb', 'customer', 'error', `${subject.name}: ${r.error}`, subject.id); return { error: `Couldn’t create the customer in QuickBooks: ${r.error}` } }
    id = String(r.data.Customer.Id)
    await logSync('to_qb', 'customer', 'ok', `Created customer “${subject.name}”`, subject.id, id)
  }
  const table = site ? 'sites' : 'organizations'
  const patch: Row = site ? { qbo_customer_id: id, qbo_customer_name: subject.name } : { qbo_customer_id: id }
  const { error } = await db.from(table).update(patch).eq('id', subject.id)
  if (error) return { error: `Linked in QuickBooks but couldn’t save the link: ${error.message}` }
  return { id }
}

// ── Vendors (dealers, for commission bills) ─────────────────────────────────
async function ensureVendor(auth: Auth, orgId: string): Promise<{ id: string } | { error: string }> {
  const db = qdb()
  const { data: org, error } = await db.from('organizations').select('id, name, qbo_vendor_id').eq('id', orgId).maybeSingle()
  if (error || !org) return { error: error?.message ?? 'Dealer not found' }
  if (org.qbo_vendor_id) return { id: String(org.qbo_vendor_id) }
  const q = await qboQuery<Row>(auth, `select Id from Vendor where DisplayName = '${esc(displayName(org.name))}'`)
  let id = q.ok && q.rows[0]?.Id ? String(q.rows[0].Id) : null
  if (!id) {
    let r = await qboJson<Row>(auth, '/vendor', { method: 'POST', body: { DisplayName: displayName(org.name), CompanyName: String(org.name).slice(0, 100) } })
    if (!r.ok && r.code === '6240') r = await qboJson<Row>(auth, '/vendor', { method: 'POST', body: { DisplayName: displayName(`${org.name} (Dealer)`), CompanyName: String(org.name).slice(0, 100) } })
    if (!r.ok) return { error: `Couldn’t create the dealer as a QuickBooks vendor: ${r.error}` }
    id = String(r.data.Vendor.Id)
    await logSync('to_qb', 'vendor', 'ok', `Created vendor “${org.name}”`, org.id, id)
  }
  const { error: uErr } = await db.from('organizations').update({ qbo_vendor_id: id }).eq('id', org.id)
  if (uErr) return { error: uErr.message }
  return { id }
}

// ── Items (catalog) ──────────────────────────────────────────────────────────
/** Find (by name) or create a QuickBooks Service item for a catalog product; saves the link. */
export async function ensureItemForProduct(auth: Auth, productId: string, settings: QboSettings): Promise<{ id: string } | { error: string }> {
  const db = qdb()
  const { data: p, error } = await db.from('products').select('id, name, sku, description, sell_price, dealer_cost, qbo_item_id').eq('id', productId).maybeSingle()
  if (error || !p) return { error: error?.message ?? 'Product not found' }
  if (p.qbo_item_id) return { id: String(p.qbo_item_id) }
  const name = String(p.name).replace(/:/g, '-').trim().slice(0, 100)
  const q = await qboQuery<Row>(auth, `select Id from Item where Name = '${esc(name)}'`)
  let id = q.ok && q.rows[0]?.Id ? String(q.rows[0].Id) : null
  if (!id) {
    if (!settings.income_account_id) return { error: 'Pick the income account for new items on the QuickBooks page first.' }
    const body: Row = { Name: name, Type: 'Service', IncomeAccountRef: { value: settings.income_account_id }, ...(p.sku ? { Sku: String(p.sku).slice(0, 100) } : {}), ...(p.description ? { Description: String(p.description).slice(0, 4000) } : {}), ...(p.sell_price != null ? { UnitPrice: money(p.sell_price) } : {}) }
    const r = await qboJson<Row>(auth, '/item', { method: 'POST', body })
    if (!r.ok) { await logSync('to_qb', 'item', 'error', `${p.name}: ${r.error}`, p.id); return { error: r.error } }
    id = String(r.data.Item.Id)
    await logSync('to_qb', 'item', 'ok', `Created item “${p.name}”`, p.id, id)
  }
  const { error: uErr } = await db.from('products').update({ qbo_item_id: id, qbo_synced_at: new Date().toISOString() }).eq('id', p.id)
  if (uErr) return { error: uErr.message }
  return { id }
}

// ── Invoices ─────────────────────────────────────────────────────────────────
async function loadInvoice(id: string) {
  const db = qdb()
  const { data, error } = await db.from('invoices').select('*, invoice_line_items(*)').eq('id', id).maybeSingle()
  return { inv: data as Row | null, error }
}

async function itemFor(auth: Auth, li: Row, settings: QboSettings): Promise<string | null> {
  if (li.product_id) {
    const r = await ensureItemForProduct(auth, String(li.product_id), settings)
    if ('id' in r) return r.id
  }
  return settings.item_map?.[String(li.service_type ?? '')] || settings.default_item_id || null
}

async function buildLines(auth: Auth, inv: Row, settings: QboSettings): Promise<{ lines: Row[] } | { error: string }> {
  const items = ((inv.invoice_line_items ?? []) as Row[]).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const lines: Row[] = []
  for (const li of items) {
    const itemId = await itemFor(auth, li, settings)
    if (!itemId) return { error: 'Pick a default QuickBooks item (QuickBooks page → Settings) so invoice lines have somewhere to post.' }
    const qty = Number(li.qty) || 1, price = money(li.unit_price)
    lines.push({ DetailType: 'SalesItemLineDetail', Amount: money(qty * price), Description: String(li.description ?? '').slice(0, 4000), SalesItemLineDetail: { ItemRef: { value: itemId }, Qty: qty, UnitPrice: price } })
  }
  if (!lines.length) {
    // Header-only invoice (e.g. field payment link): one line for the total.
    const itemId = settings.default_item_id
    if (!itemId) return { error: 'Pick a default QuickBooks item (QuickBooks page → Settings).' }
    lines.push({ DetailType: 'SalesItemLineDetail', Amount: money(inv.total), Description: String(inv.notes || inv.invoice_number || 'Service').slice(0, 4000), SalesItemLineDetail: { ItemRef: { value: itemId }, Qty: 1, UnitPrice: money(inv.total) } })
  }
  return { lines }
}

async function markInvoiceSync(id: string, patch: Row) {
  const { error } = await qdb().from('invoices').update(patch).eq('id', id)
  if (error) console.error('[qbo-sync] invoice mark failed', error.message)
}

/** Create (or update while unpaid, or void) one Nexus invoice in QuickBooks. */
export async function pushInvoice(auth: Auth, invoiceId: string, settings: QboSettings): Promise<{ ok: true; qboId: string; note?: string } | { ok: false; error: string }> {
  const { inv, error } = await loadInvoice(invoiceId)
  if (error || !inv) return { ok: false, error: error?.message ?? 'Invoice not found' }
  if (inv.source === 'quickbooks') return { ok: false, error: 'This invoice came from QuickBooks.' }
  const fail = async (msg: string) => { await markInvoiceSync(inv.id, { qb_sync_error: msg }); await logSync('to_qb', 'invoice', 'error', `${inv.invoice_number}: ${msg}`, inv.id, inv.qb_invoice_id); return { ok: false as const, error: msg } }

  // Voided in Nexus → void in QuickBooks.
  if (inv.status === 'void') {
    if (!inv.qb_invoice_id) return { ok: false, error: 'Voided before it reached QuickBooks — nothing to do.' }
    const cur = await qboJson<Row>(auth, `/invoice/${inv.qb_invoice_id}`)
    if (!cur.ok) return fail(cur.error)
    // qb_synced_at after voided_at → the run's "voids to send" check skips it from now on.
    const stamp = new Date().toISOString()
    const done = { qb_synced_at: stamp, voided_at: inv.voided_at ?? stamp, qb_sync_error: null }
    if (Number(cur.data.Invoice.TotalAmt) === 0) { await markInvoiceSync(inv.id, done); return { ok: true, qboId: inv.qb_invoice_id, note: 'already void' } }
    const r = await qboJson<Row>(auth, '/invoice?operation=void', { method: 'POST', body: { Id: inv.qb_invoice_id, SyncToken: cur.data.Invoice.SyncToken } })
    if (!r.ok) return fail(r.error)
    await markInvoiceSync(inv.id, done)
    await logSync('to_qb', 'invoice', 'ok', `Voided ${inv.invoice_number}`, inv.id, inv.qb_invoice_id)
    return { ok: true, qboId: inv.qb_invoice_id }
  }

  const cust = await ensureCustomer(auth, { siteId: inv.site_id, orgId: inv.client_org_id ?? inv.org_id }, settings)
  if ('error' in cust) return fail(cust.error)
  const built = await buildLines(auth, inv, settings)
  if ('error' in built) return fail(built.error)
  const docNumber = String(inv.invoice_number ?? '').slice(0, 21)
  const body: Row = {
    CustomerRef: { value: cust.id },
    Line: built.lines,
    ...(docNumber ? { DocNumber: docNumber } : {}),
    ...(inv.issue_date ? { TxnDate: inv.issue_date } : {}),
    ...(inv.due_date ? { DueDate: inv.due_date } : {}),
    ...(inv.notes ? { CustomerMemo: { value: String(inv.notes).slice(0, 1000) } } : {}),
    PrivateNote: `From Gate Guard Nexus (${inv.id})`,
  }

  let qboId: string | null = inv.qb_invoice_id ?? null
  // A crash after QuickBooks created it but before we saved the id → find it by number.
  if (!qboId && docNumber) {
    const q = await qboQuery<Row>(auth, `select Id from Invoice where DocNumber = '${esc(docNumber)}'`)
    if (q.ok && q.rows[0]?.Id) qboId = String(q.rows[0].Id)
  }

  let result: Row
  if (qboId) {
    const cur = await qboJson<Row>(auth, `/invoice/${qboId}`)
    if (!cur.ok) return fail(cur.error)
    const c = cur.data.Invoice
    // Only change an invoice in QuickBooks while nothing has been paid on it.
    if (Number(c.Balance) < Number(c.TotalAmt)) {
      await markInvoiceSync(inv.id, { qb_invoice_id: qboId, qb_synced_at: new Date().toISOString(), qb_sync_error: null })
      return { ok: true, qboId, note: 'has payments in QuickBooks — left as is' }
    }
    const r = await qboJson<Row>(auth, '/invoice', { method: 'POST', body: { ...body, Id: qboId, SyncToken: c.SyncToken, sparse: true } })
    if (!r.ok) return fail(r.error)
    result = r.data.Invoice
  } else {
    const r = await qboJson<Row>(auth, '/invoice', { method: 'POST', body })
    if (!r.ok) return fail(r.error)
    result = r.data.Invoice
    qboId = String(result.Id)
  }
  const note = Math.abs(Number(result.TotalAmt) - money(inv.total)) > 0.009
    ? `QuickBooks total $${Number(result.TotalAmt).toFixed(2)} ≠ Nexus $${money(inv.total).toFixed(2)} (QuickBooks may have added sales tax)`
    : undefined
  await markInvoiceSync(inv.id, { qb_invoice_id: qboId, qb_synced_at: new Date().toISOString(), qb_sync_error: note ?? null })
  await logSync('to_qb', 'invoice', note ? 'skipped' : 'ok', `${inv.invoice_number} → QuickBooks${note ? ` · ${note}` : ''}`, inv.id, qboId)
  return { ok: true, qboId, ...(note ? { note } : {}) }
}

/** Send the not-yet-sent part of a Nexus payment to QuickBooks, applied to its invoice. */
export async function pushPayment(auth: Auth, invoiceId: string, settings: QboSettings): Promise<{ ok: true; amount: number } | { ok: false; error: string }> {
  const { inv, error } = await loadInvoice(invoiceId)
  if (error || !inv) return { ok: false, error: error?.message ?? 'Invoice not found' }
  if (!inv.qb_invoice_id) return { ok: false, error: 'Invoice isn’t in QuickBooks yet.' }
  let due = money(Number(inv.amount_paid) - Number(inv.qb_paid_amount))
  if (due <= 0) return { ok: true, amount: 0 }
  const cur = await qboJson<Row>(auth, `/invoice/${inv.qb_invoice_id}`)
  if (!cur.ok) return { ok: false, error: cur.error }
  const qInv = cur.data.Invoice
  const balance = money(qInv.Balance)
  if (balance <= 0) {
    // Already paid in QuickBooks (recorded there) — just catch our counter up.
    await markInvoiceSync(inv.id, { qb_paid_amount: money(inv.amount_paid) })
    return { ok: true, amount: 0 }
  }
  due = Math.min(due, balance)
  const body: Row = {
    CustomerRef: { value: qInv.CustomerRef.value },
    TotalAmt: due,
    TxnDate: (inv.paid_at ? String(inv.paid_at).slice(0, 10) : todayET()),
    ...(settings.deposit_account_id ? { DepositToAccountRef: { value: settings.deposit_account_id } } : {}),
    ...(inv.stripe_payment_intent_id ? { PaymentRefNum: String(inv.stripe_payment_intent_id).slice(0, 21) } : {}),
    PrivateNote: `Gate Guard Nexus payment for ${inv.invoice_number}${inv.stripe_payment_intent_id ? ` · Stripe ${inv.stripe_payment_intent_id}` : ''}`,
    Line: [{ Amount: due, LinkedTxn: [{ TxnId: inv.qb_invoice_id, TxnType: 'Invoice' }] }],
  }
  const r = await qboJson<Row>(auth, '/payment', { method: 'POST', body })
  if (!r.ok) { await logSync('to_qb', 'payment', 'error', `${inv.invoice_number}: ${r.error}`, inv.id, inv.qb_invoice_id); return { ok: false, error: r.error } }
  await markInvoiceSync(inv.id, { qb_paid_amount: money(Number(inv.qb_paid_amount) + due), qb_sync_error: null })
  await logSync('to_qb', 'payment', 'ok', `$${due.toFixed(2)} on ${inv.invoice_number}`, inv.id, String(r.data.Payment?.Id ?? ''))
  return { ok: true, amount: due }
}

/** Approved dealer commission → a vendor bill in QuickBooks (pay it there). */
export async function pushCommission(auth: Auth, payoutId: string, settings: QboSettings): Promise<{ ok: true; qboId: string } | { ok: false; error: string }> {
  const db = qdb()
  const { data: p, error } = await db.from('commission_payouts').select('*').eq('id', payoutId).maybeSingle()
  if (error || !p) return { ok: false, error: error?.message ?? 'Payout not found' }
  if (p.qb_bill_id) return { ok: true, qboId: String(p.qb_bill_id) }
  const fail = async (msg: string) => { await db.from('commission_payouts').update({ qb_sync_error: msg }).eq('id', p.id); await logSync('to_qb', 'bill', 'error', msg, p.id); return { ok: false as const, error: msg } }
  if (!settings.commission_account_id) return fail('Pick the commission expense account on the QuickBooks page.')
  if (!p.org_id) return fail('This payout has no dealer company.')
  const v = await ensureVendor(auth, p.org_id)
  if ('error' in v) return fail(v.error)
  const ref = `COMM-${String(p.id).slice(0, 8)}`
  // Already created on an earlier attempt?
  const q = await qboQuery<Row>(auth, `select Id from Bill where DocNumber = '${ref}'`)
  let id = q.ok && q.rows[0]?.Id ? String(q.rows[0].Id) : null
  if (!id) {
    const body = {
      VendorRef: { value: v.id }, DocNumber: ref, TxnDate: todayET(),
      PrivateNote: `Gate Guard Nexus commission ${p.pay_period ?? ''} (${p.id})`.trim(),
      Line: [{ DetailType: 'AccountBasedExpenseLineDetail', Amount: money(p.amount), Description: `Commission${p.pay_period ? ` ${p.pay_period}` : ''}${p.rate_percent ? ` @ ${p.rate_percent}%` : ''}`, AccountBasedExpenseLineDetail: { AccountRef: { value: settings.commission_account_id } } }],
    }
    const r = await qboJson<Row>(auth, '/bill', { method: 'POST', body })
    if (!r.ok) return fail(r.error)
    id = String(r.data.Bill.Id)
  }
  const { error: uErr } = await db.from('commission_payouts').update({ qb_bill_id: id, qb_synced_at: new Date().toISOString(), qb_sync_error: null }).eq('id', p.id)
  if (uErr) return { ok: false, error: uErr.message }
  await logSync('to_qb', 'bill', 'ok', `Commission bill $${money(p.amount).toFixed(2)}`, p.id, id)
  return { ok: true, qboId: id }
}

// ── From QuickBooks ──────────────────────────────────────────────────────────
/** Apply one QuickBooks invoice to Nexus: update a linked invoice, or bring in a new one for a linked customer. */
export async function applyQboInvoice(qi: Row): Promise<'updated' | 'created' | 'skipped' | 'error'> {
  const db = qdb()
  const today = todayET()
  const id = String(qi.Id)
  const { data: existing } = await db.from('invoices').select('id, total, amount_paid, status, paid_at, source').eq('qb_invoice_id', id).maybeSingle()
  if (qi.status === 'Deleted') {
    if (!existing) return 'skipped'
    const { error } = await db.from('invoices').update((() => { const t = new Date().toISOString(); return { status: 'void', voided_at: t, qb_synced_at: t } })()).eq('id', existing.id)
    if (error) return 'error'
    await logSync('from_qb', 'invoice', 'ok', 'Deleted in QuickBooks → voided', existing.id, id)
    return 'updated'
  }
  const total = money(qi.TotalAmt), balance = money(qi.Balance)
  const paidInQb = money(total - balance)
  const due = qi.DueDate || qi.TxnDate || today
  if (existing) {
    // Voided in QuickBooks (total 0) → void here.
    if (total === 0 && Number(existing.total) > 0) {
      const { error } = await db.from('invoices').update((() => { const t = new Date().toISOString(); return { status: 'void', voided_at: t, qb_synced_at: t } })()).eq('id', existing.id)
      return error ? 'error' : 'updated'
    }
    const paid = Math.max(money(existing.amount_paid), paidInQb)
    const fully = paid >= money(existing.total) - 0.009 && money(existing.total) > 0
    // qb_paid_amount = what QuickBooks actually has. A Nexus payment not yet sent
    // stays ahead of it, so the push step still sends it.
    const patch: Row = { amount_paid: paid, qb_paid_amount: paidInQb, qb_synced_at: new Date().toISOString() }
    if (fully && existing.status !== 'paid') { patch.status = 'paid'; patch.paid_at = existing.paid_at ?? new Date().toISOString() }
    else if (!fully && existing.status !== 'void' && existing.status !== 'draft') patch.status = due < today ? 'overdue' : (existing.status === 'overdue' ? 'sent' : existing.status)
    const { error } = await db.from('invoices').update(patch).eq('id', existing.id)
    if (error) return 'error'
    if (fully && existing.status !== 'paid') {
      await releaseHeldCommissions(existing.id)
      await logSync('from_qb', 'payment', 'ok', 'Paid in QuickBooks', existing.id, id)
    }
    return 'updated'
  }
  // New in QuickBooks: bring it in only for a linked customer.
  const custId = qi.CustomerRef?.value ? String(qi.CustomerRef.value) : null
  if (!custId || total === 0) return 'skipped'
  const [{ data: site }, { data: org }] = await Promise.all([
    db.from('sites').select('id, org_id').eq('qbo_customer_id', custId).limit(1).maybeSingle(),
    db.from('organizations').select('id').eq('qbo_customer_id', custId).limit(1).maybeSingle(),
  ])
  const orgId = (site as Row | null)?.org_id ?? (org as Row | null)?.id ?? null
  if (!site && !orgId) return 'skipped'
  // Plain insert: we already checked it isn't here, and the partial unique index on
  // qb_invoice_id (migration 174) stops a duplicate if two runs race. (An upsert
  // can't target a partial index through the API — that's why the old importer failed.)
  const { error } = await db.from('invoices').insert({
    org_id: orgId, client_org_id: orgId, site_id: (site as Row | null)?.id ?? null,
    invoice_number: `QB-${qi.DocNumber || id}`.slice(0, 60),
    status: balance <= 0 ? 'paid' : due < today ? 'overdue' : 'sent',
    issue_date: qi.TxnDate || today, due_date: due,
    subtotal: total, tax_amount: 0, total, amount_paid: paidInQb, qb_paid_amount: paidInQb,
    notes: qi.CustomerMemo?.value || null, qb_invoice_id: id, qb_synced_at: new Date().toISOString(), source: 'quickbooks',
    ...(balance <= 0 ? { paid_at: new Date().toISOString() } : {}),
  })
  if (error?.code === '23505') return 'skipped'   // the other run got it first
  if (error) { await logSync('from_qb', 'invoice', 'error', error.message, null, id); return 'error' }
  await logSync('from_qb', 'invoice', 'ok', `New QuickBooks invoice ${qi.DocNumber || id} brought in`, null, id)
  return 'created'
}

export async function releaseHeldCommissions(invoiceId: string) {
  const { error } = await qdb().from('commission_payouts').update({ status: 'pending', updated_at: new Date().toISOString() }).eq('invoice_id', invoiceId).eq('status', 'held')
  if (error) console.error('[qbo-sync] commission release failed', error.message)
}

async function applyQboBill(b: Row): Promise<'updated' | 'skipped' | 'error'> {
  const db = qdb()
  const { data: p } = await db.from('commission_payouts').select('id, status').eq('qb_bill_id', String(b.Id)).maybeSingle()
  if (!p) return 'skipped'
  if (b.status !== 'Deleted' && money(b.Balance) <= 0 && p.status !== 'paid') {
    const { error } = await db.from('commission_payouts').update({ status: 'paid', paid_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', p.id)
    if (error) return 'error'
    await logSync('from_qb', 'bill', 'ok', 'Commission bill paid in QuickBooks', p.id, String(b.Id))
    return 'updated'
  }
  return 'skipped'
}

/** Pull everything that changed in QuickBooks since the last run (Change Data Capture, max 30 days). */
export async function pullChanges(auth: Auth, since: Date): Promise<{ invoices: number; created: number; bills: number; errors: number }> {
  const out = { invoices: 0, created: 0, bills: 0, errors: 0 }
  const floor = new Date(Date.now() - 29 * 86400000)
  const from = since < floor ? floor : since
  const r = await qboJson<Row>(auth, `/cdc?entities=Invoice,Payment,Bill&changedSince=${encodeURIComponent(from.toISOString().replace(/\.\d{3}Z$/, 'Z'))}`)
  if (!r.ok) { await logSync('from_qb', 'run', 'error', `Couldn’t read changes: ${r.error}`); out.errors++; return out }
  const groups = ((r.data?.CDCResponse?.[0]?.QueryResponse ?? []) as Row[])
  const invoices: Row[] = [], bills: Row[] = [], paymentInvoiceIds = new Set<string>()
  for (const g of groups) {
    for (const x of (g.Invoice ?? []) as Row[]) invoices.push(x)
    for (const x of (g.Bill ?? []) as Row[]) bills.push(x)
    for (const pay of (g.Payment ?? []) as Row[]) for (const l of (pay.Line ?? []) as Row[]) for (const t of (l.LinkedTxn ?? []) as Row[]) if (t.TxnType === 'Invoice' && t.TxnId) paymentInvoiceIds.add(String(t.TxnId))
  }
  // Invoices touched by a payment but not in the change list → fetch them.
  const seen = new Set(invoices.map(i => String(i.Id)))
  for (const id of [...paymentInvoiceIds].filter(i => !seen.has(i)).slice(0, 100)) {
    const one = await qboJson<Row>(auth, `/invoice/${id}`)
    if (one.ok) invoices.push(one.data.Invoice)
  }
  for (const qi of invoices) {
    const res = await applyQboInvoice(qi)
    if (res === 'updated') out.invoices++
    else if (res === 'created') out.created++
    else if (res === 'error') out.errors++
  }
  for (const b of bills) { const res = await applyQboBill(b); if (res === 'updated') out.bills++; else if (res === 'error') out.errors++ }
  return out
}

// ── One full run ─────────────────────────────────────────────────────────────
export interface SyncResult {
  ok: boolean; skipped?: string; error?: string
  pulled?: { invoices: number; created: number; bills: number; errors: number }
  pushed?: { invoices: number; payments: number; bills: number; errors: number }
  more?: boolean
}

/**
 * Pull changes from QuickBooks, then (when auto-sync is on, or force) send Nexus
 * invoices, payments and commission bills. Stops early at the time budget; the
 * next run carries on.
 */
export async function runSync(opts: { force?: boolean; budgetMs?: number } = {}): Promise<SyncResult> {
  const started = Date.now(), budget = opts.budgetMs ?? 45000
  const left = () => budget - (Date.now() - started)
  const auth = await getQboAuth()
  if (!auth.ok) return { ok: false, skipped: auth.reason }
  const db = qdb()
  const { data: conn, error: cErr } = await db.from('qbo_connection').select('id, last_cdc_at').eq('is_active', true).order('updated_at', { ascending: false }).limit(1).maybeSingle()
  if (cErr) return { ok: false, error: cErr.message }
  const settings = await getSettings()
  // One run at a time.
  if (conn) {
    const { data: claimed, error } = await db.rpc('qbo_claim_sync', { p_conn: conn.id, p_stale_seconds: 300 })
    if (error) return { ok: false, error: `Run migration 209: ${error.message}` }
    if (!claimed) return { ok: false, skipped: 'A sync is already running.' }
  }
  const pushed = { invoices: 0, payments: 0, bills: 0, errors: 0 }
  let more = false
  try {
    const runStart = new Date()
    const since = conn?.last_cdc_at ? new Date(new Date(conn.last_cdc_at).getTime() - 5 * 60000) : new Date(Date.now() - 86400000)
    const pulled = await pullChanges(auth, since)
    if (conn && !pulled.errors) {
      const { error } = await db.from('qbo_connection').update({ last_cdc_at: runStart.toISOString() }).eq('id', conn.id)
      if (error) console.error('[qbo-sync] cursor save failed', error.message)
    }

    if (settings.auto_sync || opts.force) {
      if (!settings.sync_start_date) {
        await logSync('to_qb', 'run', 'skipped', 'Set a sync start date before sending anything to QuickBooks.')
      } else {
        // Invoices not yet in QuickBooks, or changed since the last send (unpaid ones only get updated).
        const { data: invs, error } = await db.from('invoices').select('id, status, qb_invoice_id, qb_synced_at, updated_at')
          .neq('source', 'quickbooks').gte('issue_date', settings.sync_start_date)
          .is('qb_invoice_id', null).in('status', SENDABLE)
          .order('issue_date', { ascending: true }).limit(60)
        if (error) pushed.errors++
        // Voided in Nexus since they were last sent (voided_at after qb_synced_at).
        const { data: voids, error: vErr } = await db.from('invoices').select('id, status, qb_invoice_id, qb_synced_at, voided_at')
          .neq('source', 'quickbooks').not('qb_invoice_id', 'is', null).eq('status', 'void').limit(500)
        if (vErr) pushed.errors++
        const voidTodo = ((voids ?? []) as Row[]).filter(v => !v.voided_at || !v.qb_synced_at || Date.parse(v.qb_synced_at) < Date.parse(v.voided_at)).slice(0, 40)
        for (const i of [...((invs ?? []) as Row[]), ...voidTodo]) {
          if (left() < 6000) { more = true; break }
          const r = await pushInvoice(auth, i.id, settings)
          if (r.ok) pushed.invoices++; else pushed.errors++
        }
        // Payments: amount_paid moved ahead of what QuickBooks has.
        const { data: pays, error: pErr } = await db.from('invoices').select('id, amount_paid, qb_paid_amount')
          .not('qb_invoice_id', 'is', null).neq('status', 'void').gt('amount_paid', 0).limit(200)
        if (pErr) pushed.errors++
        for (const p of ((pays ?? []) as Row[]).filter(x => money(x.amount_paid) > money(x.qb_paid_amount))) {
          if (left() < 5000) { more = true; break }
          const r = await pushPayment(auth, p.id, settings)
          if (r.ok) { if (r.amount > 0) pushed.payments++ } else pushed.errors++
        }
        // Approved dealer commissions → bills.
        if (settings.sync_commissions) {
          const { data: cps, error: bErr } = await db.from('commission_payouts').select('id')
            .is('qb_bill_id', null).eq('status', 'approved').eq('payout_type', 'dealer').gte('created_at', settings.sync_start_date).limit(40)
          if (bErr) pushed.errors++
          for (const c of (cps ?? []) as Row[]) {
            if (left() < 4000) { more = true; break }
            const r = await pushCommission(auth, c.id, settings)
            if (r.ok) pushed.bills++; else pushed.errors++
          }
        }
      }
    }
    if (conn) {
      const { error } = await db.from('qbo_connection').update({ last_sync_at: new Date().toISOString() }).eq('id', conn.id)
      if (error) console.error('[qbo-sync] last_sync save failed', error.message)
    }
    const total = pulled.invoices + pulled.created + pulled.bills + pushed.invoices + pushed.payments + pushed.bills
    if (total || pulled.errors || pushed.errors) await logSync('to_qb', 'run', pulled.errors || pushed.errors ? 'error' : 'ok', `Sync: ${pushed.invoices} invoices, ${pushed.payments} payments, ${pushed.bills} bills sent · ${pulled.invoices + pulled.created} invoices, ${pulled.bills} bills updated from QuickBooks${pulled.errors + pushed.errors ? ` · ${pulled.errors + pushed.errors} problems` : ''}`)
    return { ok: true, pulled, pushed, more }
  } finally {
    if (conn) {
      const { error } = await db.from('qbo_connection').update({ sync_started_at: null }).eq('id', conn.id)
      if (error) console.error('[qbo-sync] unlock failed', error.message)
    }
  }
}
