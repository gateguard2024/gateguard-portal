'use client'

/**
 * DealProfitability — the ONE place a dealer sees their money on a deal.
 *
 * Rolls up every line item already in the builder (all modules/sections), in plain
 * language: "they pay" vs "you keep", monthly and on setup, with a blended margin.
 * No hunting across calculators — this panel is the single source of truth; the
 * calculators just configure the lines that feed it. Steel-themed to match the app.
 */
import { useMemo } from 'react'
import type { PricedLine } from '@/lib/proposal-modules'

const money = (n: number) => '$' + Math.round(n || 0).toLocaleString()

interface Row { section: string; payMo: number; keepMo: number; paySet: number; keepSet: number }

export function DealProfitability({ lines, selected, laborRate }: {
  lines: PricedLine[]
  selected: Set<string>
  laborRate: number
}) {
  const roll = useMemo(() => {
    const included = (l: PricedLine) => !l.is_optional || selected.has(l.id)
    const sectionOf = (l: PricedLine) => (l.section_name && l.section_name.trim()) || 'Services'
    const map = new Map<string, Row>()
    for (const l of lines) {
      if (!included(l)) continue
      const s = sectionOf(l)
      const row = map.get(s) ?? { section: s, payMo: 0, keepMo: 0, paySet: 0, keepSet: 0 }
      const rev = (typeof l.total === 'number' ? l.total : l.qty * l.unitPrice) || 0
      const uc = l.unit_cost != null ? l.unit_cost : 0
      const lh = l.labor_hours != null ? l.labor_hours : 0
      if (l.recurring) {
        row.payMo += rev
        row.keepMo += rev - l.qty * uc
      } else {
        row.paySet += rev
        row.keepSet += rev - l.qty * (uc + lh * laborRate)
      }
      map.set(s, row)
    }
    const rows = Array.from(map.values())
    const t = rows.reduce((a, r) => ({
      payMo: a.payMo + r.payMo, keepMo: a.keepMo + r.keepMo, paySet: a.paySet + r.paySet, keepSet: a.keepSet + r.keepSet,
    }), { payMo: 0, keepMo: 0, paySet: 0, keepSet: 0 })
    const totalPay = t.payMo + t.paySet
    const totalKeep = t.keepMo + t.keepSet
    const margin = totalPay > 0 ? totalKeep / totalPay : 0
    return { rows, ...t, margin, empty: rows.length === 0 }
  }, [lines, selected, laborRate])

  const marginColor = roll.margin >= 0.4 ? '#3ddc97' : roll.margin >= 0.25 ? '#f0a020' : '#f0556a'
  const tile = { background: 'rgba(0,0,0,0.24)', border: '1px solid rgba(140,170,200,0.2)', borderRadius: 12, padding: '10px 12px' } as const
  const fmtPair = (mo: number, set: number, suffix = '') =>
    [mo ? `${money(mo)}/mo` : '', set ? money(set) : ''].filter(Boolean).join(' + ') + suffix || '—'

  return (
    <div className="rounded-xl p-3 mb-3" style={{ background: 'repeating-linear-gradient(90deg,rgba(255,255,255,0.04) 0 1px,transparent 1px 4px), linear-gradient(180deg,#2b3c52,#1e2a3a)', border: '1px solid rgba(95,184,224,0.34)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)' }}>
      <div className="flex items-center gap-2 mb-2.5">
        <div className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: '#9FD8EC' }}>📊 Deal profitability</div>
        <span className="ml-auto text-[11px] font-bold rounded-md px-2 py-0.5" style={{ background: `${marginColor}22`, border: `1px solid ${marginColor}66`, color: marginColor }}>{Math.round(roll.margin * 100)}% margin</span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2.5">
        <div style={tile}>
          <div className="text-[10.5px]" style={{ color: '#9fb4c9' }}>You keep, every month</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#3ddc97', lineHeight: 1.15 }}>{money(roll.keepMo)}<span style={{ fontSize: 12, color: '#8fa4b8', fontWeight: 600 }}> /mo</span></div>
          <div className="text-[10px]" style={{ color: '#6f8299' }}>they pay {money(roll.payMo)}/mo</div>
        </div>
        <div style={tile}>
          <div className="text-[10.5px]" style={{ color: '#9fb4c9' }}>You keep, on setup</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#3ddc97', lineHeight: 1.15 }}>{money(roll.keepSet)}</div>
          <div className="text-[10px]" style={{ color: '#6f8299' }}>one-time · they pay {money(roll.paySet)}</div>
        </div>
      </div>

      {roll.empty ? (
        <div className="text-[11px] px-1 py-2" style={{ color: '#6f8299' }}>Add offerings or run a calculator — your profit shows up here.</div>
      ) : (
        <div className="space-y-1.5">
          {roll.rows.map(r => {
            const pay = r.payMo + r.paySet, keep = r.keepMo + r.keepSet
            const pct = pay > 0 ? Math.max(4, Math.min(100, Math.round((keep / pay) * 100))) : 0
            return (
              <div key={r.section} className="rounded-lg px-2.5 py-2" style={{ background: 'rgba(12,20,32,0.4)', border: '1px solid rgba(140,170,200,0.16)' }}>
                <div className="flex items-baseline gap-2">
                  <span className="flex-1 text-[12px] font-semibold" style={{ color: '#dbe7f2' }}>{r.section}</span>
                  <span className="text-[12px] font-bold" style={{ color: '#3ddc97' }}>keep {fmtPair(r.keepMo, r.keepSet)}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: '#3ddc97' }} />
                  </div>
                  <span className="text-[10px]" style={{ color: '#6f8299' }}>they pay {fmtPair(r.payMo, r.paySet)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
