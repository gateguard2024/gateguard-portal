/**
 * Finance settings — senior admins with Finance unlocked.
 *   GET                                   → settings + vendor tiers
 *   PUT { cash_floor?, idle_minutes?, payroll_amount?, payroll_frequency?, payroll_next_date?,
 *         recurring_costs?, collect_lag_days? }       → save (every change is logged)
 *   PUT { vendor: { id, name, tier } }    → set one QuickBooks vendor's pay-plan tier
 */
import { NextRequest, NextResponse } from 'next/server'
import { audit, clientIp, fdb, requireFinance, setSessionCookie } from '@/lib/finance-auth'
import { getFinanceSettings } from '@/lib/finance-outlook'

export const dynamic = 'force-dynamic'

const TIERS = ['must_pay', 'keeps_running', 'flexible'] as const
const FREQS = ['weekly', 'biweekly', 'semimonthly', 'monthly'] as const
const money = (v: unknown) => { const n = Number(v); return isFinite(n) && n >= 0 && n < 1e10 ? Math.round(n * 100) / 100 : null }

export async function GET(req: NextRequest) {
  const gate = await requireFinance(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error, state: gate.state }, { status: gate.status })
  try {
    const [settings, tiers] = await Promise.all([
      getFinanceSettings(),
      fdb().from('finance_vendor_tiers').select('qbo_vendor_id, vendor_name, tier').order('vendor_name'),
    ])
    if (tiers.error) throw new Error(tiers.error.message)
    const res = NextResponse.json({ settings, vendor_tiers: tiers.data ?? [], owner: gate.owner })
    setSessionCookie(res, gate.token, gate.idle)
    return res
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Couldn’t load settings.' }, { status: 500 }) }
}

export async function PUT(req: NextRequest) {
  const gate = await requireFinance(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error, state: gate.state }, { status: gate.status })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = (await req.json().catch(() => ({}))) as Record<string, any>
  const db = fdb()
  const ok = () => { const res = NextResponse.json({ ok: true }); setSessionCookie(res, gate.token, gate.idle); return res }
  const bad = (error: string) => NextResponse.json({ error }, { status: 400 })

  // One vendor's tier
  if (body.vendor) {
    const id = String(body.vendor.id ?? '').trim()
    const tier = String(body.vendor.tier ?? '')
    if (!id || !(TIERS as readonly string[]).includes(tier)) return bad('Pick a vendor and a tier.')
    const { error } = await db.from('finance_vendor_tiers').upsert({ qbo_vendor_id: id, vendor_name: String(body.vendor.name ?? '').slice(0, 200) || null, tier, updated_by: gate.user.id, updated_at: new Date().toISOString() }, { onConflict: 'qbo_vendor_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await audit({ user: gate.user, action: 'vendor_tier', target: id, detail: { name: body.vendor.name, tier }, ip: clientIp(req) })
    return ok()
  }

  // Settings
  const patch: Record<string, unknown> = {}
  if ('cash_floor' in body) { const v = money(body.cash_floor); if (v == null) return bad('Cash floor must be a dollar amount.'); patch.cash_floor = v }
  if ('payroll_amount' in body) { const v = money(body.payroll_amount); if (v == null) return bad('Payroll must be a dollar amount.'); patch.payroll_amount = v }
  if ('idle_minutes' in body) { const v = Math.round(Number(body.idle_minutes)); if (!(v >= 5 && v <= 60)) return bad('Idle lock must be 5–60 minutes.'); patch.idle_minutes = v }
  if ('collect_lag_days' in body) { const v = Math.round(Number(body.collect_lag_days)); if (!(v >= 0 && v <= 120)) return bad('Days to collect must be 0–120.'); patch.collect_lag_days = v }
  if ('payroll_frequency' in body) { if (!(FREQS as readonly string[]).includes(body.payroll_frequency)) return bad('Pick how often payroll runs.'); patch.payroll_frequency = body.payroll_frequency }
  if ('payroll_next_date' in body) {
    const d = body.payroll_next_date
    if (d !== null && !(typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))) return bad('Next pay date must be a date.')
    patch.payroll_next_date = d
  }
  if ('recurring_costs' in body) {
    if (!Array.isArray(body.recurring_costs) || body.recurring_costs.length > 100) return bad('Recurring costs must be a list (up to 100).')
    const list = []
    for (const c of body.recurring_costs) {
      const name = String(c?.name ?? '').trim().slice(0, 120)
      const amount = money(c?.amount)
      const day = Math.round(Number(c?.day))
      const tier = String(c?.tier ?? 'flexible')
      if (!name || amount == null || amount <= 0 || !(day >= 1 && day <= 31) || !(TIERS as readonly string[]).includes(tier)) return bad('Each recurring cost needs a name, an amount, a day of the month (1–31) and a tier.')
      list.push({ name, amount, day, tier })
    }
    patch.recurring_costs = list
  }
  if (Object.keys(patch).length === 0) return bad('Nothing to save.')
  const { error } = await db.from('finance_settings').update({ ...patch, updated_by: gate.user.id, updated_at: new Date().toISOString() }).eq('id', 1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await audit({ user: gate.user, action: 'settings', detail: Object.keys(patch), ip: clientIp(req) })
  return ok()
}
