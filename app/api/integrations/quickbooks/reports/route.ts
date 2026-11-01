/**
 * GET /api/integrations/quickbooks/reports — corporate only.
 *   ?view=overview (default)           → cash, A/R aging + late customers, A/P, P&L month/last/YTD
 *   ?view=pnl&start=YYYY-MM-DD&end=…   → full profit & loss
 *   ?view=ar | ap | balance            → aging / balance sheet
 *   &refresh=1                          → skip the 30-minute cache
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { getReport, overview } from '@/lib/qbo-reports'
import { todayET } from '@/lib/tz'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user.isCorporate) return NextResponse.json({ error: 'QuickBooks is Gate Guard corporate only.' }, { status: 403 })
  const sp = req.nextUrl.searchParams
  const refresh = sp.get('refresh') === '1'
  const view = sp.get('view') ?? 'overview'
  const d = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
  const today = todayET()
  if (view === 'overview') {
    const r = await overview(refresh)
    return r.ok ? NextResponse.json(r.data) : NextResponse.json({ error: r.error }, { status: 502 })
  }
  const r = view === 'pnl' ? await getReport('ProfitAndLoss', { start_date: d(sp.get('start')) ?? `${today.slice(0, 7)}-01`, end_date: d(sp.get('end')) ?? today }, refresh)
    : view === 'ar' ? await getReport('AgedReceivables', { report_date: today }, refresh)
    : view === 'ap' ? await getReport('AgedPayables', { report_date: today }, refresh)
    : view === 'balance' ? await getReport('BalanceSheet', { end_date: d(sp.get('end')) ?? today }, refresh)
    : null
  if (!r) return NextResponse.json({ error: 'Unknown view' }, { status: 400 })
  return r.ok ? NextResponse.json(r.report) : NextResponse.json({ error: r.error }, { status: 502 })
}
