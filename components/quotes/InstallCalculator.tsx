'use client'

/**
 * InstallCalculator — the dealer's one-time install cost/retail/margin tool.
 *
 * Parts follow the corporate markup chain (base → +tax → +override → 2× retail)
 * from lib/install-model.ts. Labor is the dealer's own (cost rate + retail rate),
 * remembered in localStorage so they set it once. Generates itemized RETAIL line
 * items for the proposal, each carrying its dealer cost so the P&L is accurate.
 */
import { useEffect, useMemo, useState } from 'react'
import { INSTALL_PARTS, DEFAULT_LABOR, dealerCost, retailPrice } from '@/lib/install-model'
import type { GenLine } from './GateProgramCalc'

const money = (n: number) => '$' + Math.round(n || 0).toLocaleString()
const num = (v: string) => Math.max(0, Number(v) || 0)

const LS_COST = 'gg_labor_cost_rate'
const LS_RETAIL = 'gg_labor_retail_rate'
function loadRate(key: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback
  const v = Number(window.localStorage.getItem(key)); return Number.isFinite(v) && v > 0 ? v : fallback
}

export function InstallCalculator({ defaultWorkingGates, defaultNonWorkingGates, onClose, onGenerate }: {
  defaultWorkingGates?: number
  defaultNonWorkingGates?: number
  onClose: () => void
  onGenerate: (lines: GenLine[]) => void
}) {
  const totalGates = (defaultWorkingGates || 0) + (defaultNonWorkingGates || 0)
  const [qty, setQty] = useState<Record<string, number>>(() => ({
    controller: totalGates || 1,
    keypad: 0, cellular: 0, unifi: 0,
    board: defaultNonWorkingGates || 0,
    entrapment: defaultNonWorkingGates || 0,
    welding: 0,
  }))
  const [hours, setHours] = useState((defaultWorkingGates || 0) * 3 + (defaultNonWorkingGates || 0) * 6 || 3)
  const [costRate, setCostRate] = useState(() => loadRate(LS_COST, DEFAULT_LABOR.costRate))
  const [retailRate, setRetailRate] = useState(() => loadRate(LS_RETAIL, DEFAULT_LABOR.retailRate))
  const set = (k: string, v: number) => setQty(p => ({ ...p, [k]: v }))

  useEffect(() => { if (typeof window !== 'undefined') window.localStorage.setItem(LS_COST, String(costRate)) }, [costRate])
  useEffect(() => { if (typeof window !== 'undefined') window.localStorage.setItem(LS_RETAIL, String(retailRate)) }, [retailRate])

  const calc = useMemo(() => {
    const rows = INSTALL_PARTS.map(p => {
      const q = qty[p.key] || 0
      return { ...p, q, costEa: dealerCost(p.baseCost), retailEa: retailPrice(p.baseCost), cost: q * dealerCost(p.baseCost), retail: q * retailPrice(p.baseCost) }
    })
    const laborCost = hours * costRate, laborRetail = hours * retailRate
    const totalCost = rows.reduce((s, r) => s + r.cost, 0) + laborCost
    const totalRetail = rows.reduce((s, r) => s + r.retail, 0) + laborRetail
    const profit = totalRetail - totalCost
    const margin = totalRetail > 0 ? profit / totalRetail : 0

    const lines: GenLine[] = []
    for (const r of rows) if (r.q > 0) lines.push({ description: r.name, qty: r.q, unit_price: r.retailEa, is_recurring: false, is_optional: false, unit_cost: r.costEa, labor_hours: 0 })
    if (hours > 0) lines.push({ description: 'Install labor', qty: hours, unit_price: retailRate, is_recurring: false, is_optional: false, unit_cost: costRate, labor_hours: 0 })
    return { rows, laborCost, laborRetail, totalCost, totalRetail, profit, margin, lines }
  }, [qty, hours, costRate, retailRate])

  const marginColor = calc.margin >= 0.4 ? '#12b886' : calc.margin >= 0.25 ? '#f0a020' : '#f0556a'

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(6,12,20,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(640px,100%)', maxHeight: '92vh', overflowY: 'auto', borderRadius: 18, padding: 20, color: '#eef4fb', background: 'repeating-linear-gradient(90deg,rgba(255,255,255,0.04) 0 1px,transparent 1px 4px), linear-gradient(180deg,#33465e,#243141)', border: '1px solid rgba(170,198,222,0.3)', boxShadow: '0 30px 80px rgba(0,0,0,0.55)' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>🔧 Install calculator</div>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)', color: '#cfe0f0', borderRadius: 9, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>Close</button>
        </div>
        <div style={{ fontSize: 11.5, color: '#9fb4c9', marginBottom: 12 }}>Parts use the corporate markup chain (＋6% tax, ＋10% override, 2× retail). Labor is yours — set your rates once, they’re remembered.</div>

        {/* Part quantities */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {INSTALL_PARTS.map(p => (
            <label key={p.key} style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase', color: '#9fb4c9' }}>
              {p.name}{p.verify ? ' *' : ''}
              <input type="number" min={0} value={qty[p.key] === 0 ? '' : qty[p.key]} placeholder="0" onFocus={e => e.target.select()} onChange={e => set(p.key, num(e.target.value))}
                style={{ display: 'block', width: '100%', marginTop: 4, padding: '9px 10px', borderRadius: 9, background: '#0c1420', border: '1px solid rgba(140,170,200,0.24)', color: '#eef4fb', fontSize: 15, fontWeight: 600 }} />
            </label>
          ))}
        </div>

        {/* Labor */}
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            { l: 'Labor hours', v: hours, set: setHours },
            { l: 'Your cost $/hr', v: costRate, set: setCostRate },
            { l: 'Your bill $/hr', v: retailRate, set: setRetailRate },
          ].map((f, i) => (
            <label key={i} style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase', color: '#9FD8EC' }}>{f.l}
              <input type="number" min={0} value={f.v === 0 ? '' : f.v} placeholder="0" onFocus={e => e.target.select()} onChange={e => f.set(num(e.target.value))}
                style={{ display: 'block', width: '100%', marginTop: 4, padding: '9px 10px', borderRadius: 9, background: '#0c1420', border: '1px solid rgba(95,184,224,0.34)', color: '#eef4fb', fontSize: 15, fontWeight: 600 }} />
            </label>
          ))}
        </div>

        {/* Breakdown */}
        <div style={{ marginTop: 14, borderRadius: 11, border: '1px solid rgba(140,170,200,0.2)', background: 'rgba(12,20,32,0.4)', padding: 10 }}>
          <div style={{ display: 'flex', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#8fa4b8', paddingBottom: 4, borderBottom: '1px solid rgba(140,170,200,0.2)' }}>
            <span style={{ flex: 1 }}>Component</span><span style={{ width: 90, textAlign: 'right' }}>Cost</span><span style={{ width: 90, textAlign: 'right' }}>Retail</span>
          </div>
          {calc.rows.filter(r => r.q > 0).map(r => (
            <div key={r.key} style={{ display: 'flex', fontSize: 12.5, padding: '4px 0', color: '#d6e3ef' }}>
              <span style={{ flex: 1 }}>{r.name} ×{r.q}</span><span style={{ width: 90, textAlign: 'right' }}>{money(r.cost)}</span><span style={{ width: 90, textAlign: 'right', fontWeight: 700 }}>{money(r.retail)}</span>
            </div>
          ))}
          {hours > 0 && (
            <div style={{ display: 'flex', fontSize: 12.5, padding: '4px 0', color: '#d6e3ef' }}>
              <span style={{ flex: 1 }}>Install labor ×{hours}h</span><span style={{ width: 90, textAlign: 'right' }}>{money(calc.laborCost)}</span><span style={{ width: 90, textAlign: 'right', fontWeight: 700 }}>{money(calc.laborRetail)}</span>
            </div>
          )}
        </div>

        {/* Totals */}
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div style={{ borderRadius: 10, padding: '8px 10px', background: 'rgba(0,0,0,0.24)', border: '1px solid rgba(140,170,200,0.2)' }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', color: '#8fa4b8' }}>Your cost</div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>{money(calc.totalCost)}</div>
          </div>
          <div style={{ borderRadius: 10, padding: '8px 10px', background: 'rgba(0,0,0,0.24)', border: '1px solid rgba(140,170,200,0.2)' }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', color: '#8fa4b8' }}>Recommended retail</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#5FB8E0' }}>{money(calc.totalRetail)}</div>
          </div>
          <div style={{ borderRadius: 10, padding: '8px 10px', background: `${marginColor}18`, border: `1px solid ${marginColor}` }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', color: marginColor }}>Profit · {Math.round(calc.margin * 100)}%</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: marginColor }}>{money(calc.profit)}</div>
          </div>
        </div>

        <button onClick={() => { if (calc.lines.length) onGenerate(calc.lines) }} disabled={!calc.lines.length}
          style={{ width: '100%', marginTop: 14, padding: '13px', borderRadius: 12, border: 0, fontWeight: 800, fontSize: 15, color: '#04231a', background: !calc.lines.length ? 'rgba(255,255,255,0.12)' : 'linear-gradient(135deg,#3ddc97,#12b886)', cursor: !calc.lines.length ? 'not-allowed' : 'pointer' }}>
          Add to proposal →
        </button>
        <div style={{ fontSize: 10.5, color: '#6f8299', marginTop: 8 }}>* placeholder part cost — confirm with corporate. Adds an itemized “Install &amp; Setup” section (retail shown to client; your cost stays internal).</div>
      </div>
    </div>
  )
}
