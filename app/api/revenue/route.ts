import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const caller = await getCurrentUser()

  // ── MRR from active contracts ─────────────────────────────────────────────
  let contractQuery = supabase
    .from('contracts')
    .select('mrr')
    .eq('status', 'active')
    .eq('is_active', true)

  if (!caller.isCorporate && caller.org_id) {
    contractQuery = contractQuery.eq('org_id', caller.org_id)
  }

  const { data: activeContracts } = await contractQuery
  const total_mrr = (activeContracts ?? []).reduce(
    (sum: number, c: { mrr: number }) => sum + (c.mrr ?? 0),
    0
  )
  const total_arr = total_mrr * 12

  // ── Active properties (sites) ──────────────────────────────────────────────
  let siteQuery = supabase
    .from('sites')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')

  if (!caller.isCorporate && caller.org_id) {
    siteQuery = siteQuery.eq('org_id', caller.org_id)
  }

  const { count: active_properties } = await siteQuery

  // ── Invoices this month ────────────────────────────────────────────────────
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  let invoiceQuery = supabase
    .from('invoices')
    .select('amount, status, paid_at')
    .gte('created_at', firstOfMonth)

  if (!caller.isCorporate && caller.org_id) {
    invoiceQuery = invoiceQuery.eq('org_id', caller.org_id)
  }

  const { data: monthInvoices } = await invoiceQuery
  const invoices_this_month = (monthInvoices ?? []).reduce(
    (sum: number, i: { amount: number }) => sum + (i.amount ?? 0),
    0
  )
  const invoices_paid_this_month = (monthInvoices ?? [])
    .filter((i: { status: string; paid_at: string | null }) =>
      i.status === 'paid' && i.paid_at && i.paid_at >= firstOfMonth
    )
    .reduce((sum: number, i: { amount: number }) => sum + (i.amount ?? 0), 0)

  // ── By month (last 6 months) ───────────────────────────────────────────────
  const months: { month: string; value: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const start = d.toISOString()
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString()
    const label = d.toLocaleString('en-US', { month: 'short' })

    let mq = supabase
      .from('invoices')
      .select('amount')
      .gte('created_at', start)
      .lt('created_at', end)

    if (!caller.isCorporate && caller.org_id) {
      mq = mq.eq('org_id', caller.org_id)
    }

    const { data: mData } = await mq
    const value = (mData ?? []).reduce(
      (s: number, inv: { amount: number }) => s + (inv.amount ?? 0),
      0
    )
    months.push({ month: label, value: Math.round(value / 1000 * 10) / 10 }) // in $K
  }

  return NextResponse.json({
    metrics: {
      total_mrr,
      total_arr,
      active_properties: active_properties ?? 0,
      invoices_this_month,
      invoices_paid_this_month,
    },
    by_month: months,
  })
}
