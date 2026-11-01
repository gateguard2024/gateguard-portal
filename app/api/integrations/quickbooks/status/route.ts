/**
 * /api/integrations/quickbooks/status — corporate only.
 *   GET    → connection, company, last sync, settings, what's waiting, problems
 *   PATCH  { settings… } → save settings
 *   DELETE → disconnect (keeps links and history; reconnect any time)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { getSettings, qdb } from '@/lib/qbo-sync'
import { qboEnvironment } from '@/lib/qbo'

export const dynamic = 'force-dynamic'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

async function corp() {
  const user = await getCurrentUser()
  if (!user.id || user.id === 'anonymous') return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (!user.isCorporate) return { error: NextResponse.json({ error: 'QuickBooks is Gate Guard corporate only.' }, { status: 403 }) }
  return { user }
}

export async function GET() {
  const c = await corp(); if (c.error) return c.error
  const db = qdb()
  const [{ data: conn }, settings] = await Promise.all([
    db.from('qbo_connection').select('realm_id, environment, company_name, last_sync_at, last_cdc_at, refresh_expires_at, updated_at').eq('is_active', true).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    getSettings(),
  ])
  const start = settings.sync_start_date ?? '9999-12-31'
  const count = async (q: PromiseLike<{ count: number | null; error: { message: string } | null }>) => { const r = await q; return r.error ? null : r.count ?? 0 }
  const [sitesTotal, sitesLinked, productsLinked, invWaiting, invErrors, comWaiting, paysRows] = await Promise.all([
    count(db.from('sites').select('id', { count: 'exact', head: true })),
    count(db.from('sites').select('id', { count: 'exact', head: true }).not('qbo_customer_id', 'is', null)),
    count(db.from('products').select('id', { count: 'exact', head: true }).not('qbo_item_id', 'is', null)),
    count(db.from('invoices').select('id', { count: 'exact', head: true }).neq('source', 'quickbooks').is('qb_invoice_id', null).in('status', ['sent', 'viewed', 'overdue', 'paid']).gte('issue_date', start)),
    count(db.from('invoices').select('id', { count: 'exact', head: true }).not('qb_sync_error', 'is', null)),
    count(db.from('commission_payouts').select('id', { count: 'exact', head: true }).is('qb_bill_id', null).eq('status', 'approved').eq('payout_type', 'dealer').gte('created_at', start)),
    db.from('invoices').select('amount_paid, qb_paid_amount').not('qb_invoice_id', 'is', null).gt('amount_paid', 0).limit(1000),
  ])
  const paymentsWaiting = ((paysRows.data ?? []) as Row[]).filter(r => Number(r.amount_paid) > Number(r.qb_paid_amount) + 0.009).length
  const keys = !!(process.env.QBO_CLIENT_ID && process.env.QBO_CLIENT_SECRET)
  return NextResponse.json({
    connected: !!conn, keysConfigured: keys, environment: conn?.environment ?? qboEnvironment(),
    company: conn?.company_name ?? null, realmId: conn?.realm_id ?? null,
    lastSyncAt: conn?.last_sync_at ?? null, reconnectBy: conn?.refresh_expires_at ?? null,
    webhookConfigured: !!process.env.QBO_WEBHOOK_VERIFIER,
    settings,
    counts: { sitesTotal, sitesLinked, productsLinked, invoicesWaiting: invWaiting, invoiceProblems: invErrors, paymentsWaiting, commissionsWaiting: comWaiting },
  })
}

const FIELDS = ['auto_sync', 'sync_start_date', 'default_item_id', 'item_map', 'income_account_id', 'deposit_account_id', 'commission_account_id', 'sync_commissions', 'auto_create_customers'] as const

export async function PATCH(req: NextRequest) {
  const c = await corp(); if (c.error) return c.error
  const body = await req.json().catch(() => ({} as Row))
  const patch: Row = {}
  for (const k of FIELDS) if (k in body) {
    const v = body[k]
    if (['auto_sync', 'sync_commissions', 'auto_create_customers'].includes(k)) patch[k] = !!v
    else if (k === 'sync_start_date') { if (v != null && v !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return NextResponse.json({ error: 'Start date must be YYYY-MM-DD' }, { status: 400 }); patch[k] = v || null }
    else if (k === 'item_map') { if (v && typeof v === 'object' && !Array.isArray(v)) patch[k] = Object.fromEntries(Object.entries(v as Row).filter(([, x]) => typeof x === 'string' && x).map(([a, x]) => [a, String(x)])); else return NextResponse.json({ error: 'item_map must be an object' }, { status: 400 }) }
    else patch[k] = v ? String(v) : null
  }
  if (patch.auto_sync === true) {
    const cur = { ...(await getSettings()), ...patch }
    if (!cur.sync_start_date) return NextResponse.json({ error: 'Pick a start date first — only invoices on or after it go to QuickBooks.' }, { status: 400 })
    if (!cur.default_item_id) return NextResponse.json({ error: 'Pick a default QuickBooks item first.' }, { status: 400 })
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to save' }, { status: 400 })
  const { data, error } = await qdb().from('qbo_settings').upsert({ id: 1, ...patch, updated_by: c.user.id, updated_at: new Date().toISOString() }, { onConflict: 'id' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: data })
}

export async function DELETE() {
  const c = await corp(); if (c.error) return c.error
  const { error } = await qdb().from('qbo_connection').update({ is_active: false, access_token: null, refresh_token: null, updated_at: new Date().toISOString() }).eq('is_active', true)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const { error: sErr } = await qdb().from('qbo_settings').update({ auto_sync: false }).eq('id', 1)
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
