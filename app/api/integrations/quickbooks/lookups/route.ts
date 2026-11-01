/**
 * GET /api/integrations/quickbooks/lookups — corporate only.
 * QuickBooks accounts, items and customers for the pickers on the QuickBooks page.
 */
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { getQboAuth, qboQuery } from '@/lib/qbo'

export const dynamic = 'force-dynamic'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

export async function GET() {
  const user = await getCurrentUser()
  if (!user.isCorporate) return NextResponse.json({ error: 'QuickBooks is Gate Guard corporate only.' }, { status: 403 })
  const auth = await getQboAuth()
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 400 })
  const [acc, items, cust] = await Promise.all([
    qboQuery<Row>(auth, 'select Id, Name, FullyQualifiedName, AccountType, AccountSubType, Active from Account maxresults 1000'),
    qboQuery<Row>(auth, "select Id, Name, Type, Sku, UnitPrice, Active from Item where Active = true maxresults 1000"),
    qboQuery<Row>(auth, 'select Id, DisplayName, Active from Customer where Active = true maxresults 1000'),
  ])
  for (const r of [acc, items, cust]) if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 })
  const accounts = (acc as { rows: Row[] }).rows.filter(a => a.Active !== false).map(a => ({ id: String(a.Id), name: String(a.FullyQualifiedName ?? a.Name), type: String(a.AccountType ?? ''), subType: String(a.AccountSubType ?? '') }))
  return NextResponse.json({
    income: accounts.filter(a => a.type === 'Income' || a.type === 'Other Income'),
    deposit: accounts.filter(a => a.type === 'Bank' || a.subType === 'UndepositedFunds' || a.type === 'Other Current Asset'),
    expense: accounts.filter(a => a.type === 'Expense' || a.type === 'Cost of Goods Sold' || a.type === 'Other Expense'),
    items: (items as { rows: Row[] }).rows.filter(i => i.Type !== 'Category').map(i => ({ id: String(i.Id), name: String(i.Name), type: String(i.Type ?? ''), sku: i.Sku ?? null, price: i.UnitPrice ?? null })),
    customers: (cust as { rows: Row[] }).rows.map(c => ({ id: String(c.Id), name: String(c.DisplayName) })),
  })
}
