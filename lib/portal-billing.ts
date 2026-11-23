/**
 * Portal billing — what this property owes Gate Guard, from the real `invoices`
 * table (Nexus invoices + QuickBooks invoices for linked customers, which the
 * QuickBooks sync copies in with the property's site_id). No sample data.
 *
 * An invoice belongs to the portal's property when invoices.site_id = the site,
 * or it has no site but is billed to the portal's company (client_org_id).
 * Drafts and voids are never shown. Pay link = Stripe payment link, else the
 * QuickBooks customer pay link (qbo_invoice_link).
 * (Replaced the mock funding model / "unpaid residents" list, Nov 23 2026 —
 *  resident-funded billing doesn't exist yet, so nothing about it is shown.)
 */
import { createClient } from '@supabase/supabase-js'

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export type PortalInvoice = {
  id: string
  number: string
  status: 'paid' | 'open' | 'overdue' | 'partial'
  issue_date: string | null
  due_date: string | null
  total: number
  paid: number
  balance: number
  days_late: number
  pay_url: string | null
  from_quickbooks: boolean
  notes: string | null
}
export type BillingData = {
  invoices: PortalInvoice[]
  balance: number          // everything still owed
  overdue: number          // owed and past due
  due_next: { date: string; amount: number } | null
  paid_90: number          // paid in the last 90 days
  error?: string
}

const COLS = 'id, invoice_number, status, issue_date, due_date, total, amount_paid, balance_due, notes, stripe_payment_link, qbo_invoice_link, qb_invoice_id, source, paid_at, site_id, client_org_id'

function todayET(): string { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) }
function daysBetween(a: string, b: string): number { return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5) }

export async function getBillingData(siteId: string | null, orgId: string | null): Promise<BillingData> {
  const empty: BillingData = { invoices: [], balance: 0, overdue: 0, due_next: null, paid_90: 0 }
  if (!siteId && !orgId) return empty
  const sb = db()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = new Map<string, any>()
  const [bySite, byOrg] = await Promise.all([
    siteId ? sb.from('invoices').select(COLS).eq('site_id', siteId).order('issue_date', { ascending: false }).limit(200) : Promise.resolve({ data: [], error: null }),
    orgId ? sb.from('invoices').select(COLS).is('site_id', null).eq('client_org_id', orgId).order('issue_date', { ascending: false }).limit(200) : Promise.resolve({ data: [], error: null }),
  ])
  if (bySite.error) return { ...empty, error: bySite.error.message }
  if (byOrg.error) return { ...empty, error: byOrg.error.message }
  for (const r of [...(bySite.data ?? []), ...(byOrg.data ?? [])]) rows.set(r.id, r)

  const today = todayET()
  const invoices: PortalInvoice[] = [...rows.values()]
    .filter(r => !['draft', 'void'].includes(String(r.status ?? '').toLowerCase()))
    .map(r => {
      const total = Number(r.total ?? 0)
      const paid = Number(r.amount_paid ?? 0)
      const balance = Math.max(0, Number(r.balance_due ?? total - paid))
      const due = r.due_date ? String(r.due_date).slice(0, 10) : null
      const late = balance > 0 && due && due < today ? daysBetween(due, today) : 0
      const status: PortalInvoice['status'] = balance <= 0.004 ? 'paid' : late > 0 ? 'overdue' : paid > 0 ? 'partial' : 'open'
      return {
        id: String(r.id), number: String(r.invoice_number ?? ''), status,
        issue_date: r.issue_date ? String(r.issue_date).slice(0, 10) : null, due_date: due,
        total, paid, balance, days_late: late,
        pay_url: balance > 0 ? (r.stripe_payment_link || r.qbo_invoice_link || null) : null,
        from_quickbooks: !!r.qb_invoice_id || r.source === 'quickbooks',
        notes: r.notes ?? null,
      }
    })
    .sort((a, b) => (Number(b.balance > 0) - Number(a.balance > 0)) || String(b.issue_date ?? '').localeCompare(String(a.issue_date ?? '')))

  const open = invoices.filter(i => i.balance > 0)
  const upcoming = open.filter(i => i.due_date && i.due_date >= today).sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))
  const since90 = new Date(Date.now() - 90 * 864e5).toISOString()
  const paid90 = [...rows.values()]
    .filter(r => r.paid_at && String(r.paid_at) >= since90 && String(r.status ?? '') !== 'void')
    .reduce((s, r) => s + Number(r.amount_paid ?? 0), 0)
  return {
    invoices,
    balance: round(open.reduce((s, i) => s + i.balance, 0)),
    overdue: round(open.filter(i => i.status === 'overdue').reduce((s, i) => s + i.balance, 0)),
    due_next: upcoming[0] ? { date: upcoming[0].due_date!, amount: upcoming[0].balance } : null,
    paid_90: round(paid90),
  }
}

/** One invoice's lines — only if that invoice belongs to the portal's property. */
export async function getInvoiceLines(invoiceId: string, siteId: string | null, orgId: string | null): Promise<{ lines: { description: string; qty: number; unit_price: number; amount: number }[] } | { error: string; status: number }> {
  const sb = db()
  const { data: inv, error } = await sb.from('invoices').select('id, site_id, client_org_id, status').eq('id', invoiceId).maybeSingle()
  if (error) return { error: error.message, status: 500 }
  const mine = inv && ((siteId && inv.site_id === siteId) || (!inv.site_id && orgId && inv.client_org_id === orgId))
  if (!inv || !mine || ['draft', 'void'].includes(String(inv.status ?? ''))) return { error: 'Invoice not found.', status: 404 }
  const { data, error: lErr } = await sb.from('invoice_line_items').select('*').eq('invoice_id', invoiceId).order('created_at', { ascending: true })
  if (lErr) return { error: lErr.message, status: 500 }
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lines: (data ?? []).map((l: any) => {
      const qty = Number(l.qty ?? l.quantity ?? 1); const unit = Number(l.unit_price ?? 0)
      return { description: String(l.description ?? 'Item'), qty, unit_price: unit, amount: Number(l.amount ?? l.total ?? qty * unit) }
    }),
  }
}

const round = (n: number) => Math.round(n * 100) / 100
