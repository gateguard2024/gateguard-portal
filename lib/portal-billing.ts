/**
 * Portal billing adapter. Returns what the property owes GateGuard (bulk service
 * + setup/install), the funding model, and — for resident-funded sites — the list
 * of residents behind on their own access fees.
 *
 * Real open balance comes from the invoices table (same source as /summary). The
 * funding model + unpaid-resident list are mock today with a single swap point
 * (TODO(billing)) — wire to the billing/subscription tables when they exist.
 */
import { createClient } from '@supabase/supabase-js'

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export type BillingModel = 'bulk' | 'resident'
export type UnpaidResident = { unit: string; name: string; amount: number; days_overdue: number }
export type BillingLine = { label: string; amount: number }
export type BillingData = {
  model: BillingModel
  balance: number
  lines: BillingLine[]
  unpaid: UnpaidResident[]
  source: 'live' | 'mock'
}

function mock(balanceFromInvoices: number | null): BillingData {
  const setup = 1500, base = 450
  const lines: BillingLine[] = [
    { label: 'Setup & install', amount: setup },
    { label: 'Platform base · this month', amount: base },
  ]
  const balance = balanceFromInvoices != null && balanceFromInvoices > 0 ? balanceFromInvoices : setup + base
  return {
    model: 'resident',
    balance,
    lines,
    unpaid: [
      { unit: '412', name: 'Marcus Bell', amount: 29, days_overdue: 12 },
      { unit: '118', name: 'Priya Shah', amount: 29, days_overdue: 6 },
      { unit: '905', name: 'Okafor Family', amount: 58, days_overdue: 3 },
      { unit: '233', name: 'Lena Córdova', amount: 29, days_overdue: 1 },
    ],
    source: 'mock',
  }
}

export async function getBillingData(siteId: string | null): Promise<BillingData> {
  let openBalance: number | null = null
  if (siteId) {
    try {
      const { data } = await db().from('invoices').select('balance_due, status').eq('site_id', siteId)
      const open = (data ?? []).filter(i => i.status !== 'void' && Number(i.balance_due) > 0)
      openBalance = open.reduce((s, i) => s + Number(i.balance_due || 0), 0)
    } catch { /* billing optional */ }
  }
  // TODO(billing): read funding model + unpaid residents from the billing tables.
  return mock(openBalance)
}
