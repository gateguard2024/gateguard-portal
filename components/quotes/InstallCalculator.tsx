'use client'

/**
 * InstallCalculator — the dealer's one-time install cost / retail / margin tool.
 *
 * Three ways to charge setup (dealer's choice):
 *   • standard       — flat recommended rate per gate/door ($500 working / $750 non-working)
 *   • standard_plus  — flat rate for the base install + itemized ADDITIONAL equipment
 *   • itemized       — every part + labor line, fully itemized
 *
 * Parts follow the corporate markup chain (base → +tax → +override → 2× retail) from
 * lib/install-model.ts. Labor rate and the standard setup rate are the DEALER's own,
 * remembered in localStorage under shared keys so they sync with the sales-tab
 * install calculator. Generated lines carry dealer cost internally for the P&L.
 */
import { useMemo, useState } from 'react'
import {
  INSTALL_PARTS, DEFAULT_LABOR, STANDARD_SETUP, BASE_PART_KEYS, LS,
  dealerCost, retailPrice, loadRate, saveRate,
} from '@/lib/install-model'
import type { GenLine } from './GateProgramCalc'

type Mode = 'standard' | 'standard_plus' | 'itemized'
const money = (n: number) => '$' + Math.round(n || 0).toLocaleString()
const num = (v: string) => Math.max(0, Number(v) || 0)
const isBase = (key: string) => BASE_PART_KEYS.includes(key)

export function InstallCalculator({ defaultWorkingGates, defaultNonWorkingGates, onClose, onGenerate }: {
  defaultWorkingGates?: number
  defaultNonWorkingGates?: number
  onClose: () => void
  onGenerate: (lines: GenLine[]) => void
}) {
  const [mode, setMode] = useState<Mode>('standard')
  const [workingGates, setWorkingGates] = useState(defaultWorkingGates || 0)
  const [nonWorkingGates, setNonWorkingGates] = useState(defaultNonWorkingGates || 0)
  const totalGates = workingGates + nonWorkingGates

  const [qty, setQty] = useState<Record<string, number>>(() => ({
    controller: totalGates || 1, keypad: 0, cellular: 0, unifi: 0,
    board: defaultNonWorkingGates || 0, entrapment: defaultNonWorkingGates || 0, welding: 0,
  }))
  const [hours, setHours] = useState((defaultWorkingGates || 0) * 3 + (defaultNonWorkingGates || 0) * 6 || 3)
  const [costRate, setCostRate] = useState(() => loadRate(LS.laborCost, DEFAULT_LABOR.costRate))
  const [retailRate, setRetailRate] = useState(() => loadRate(LS.laborRetail, DEFAULT_LABOR.retailRate))
  const [workRate, setWorkRate] = useState(() => loadRate(LS.setupWorking, STANDARD_SETUP.working))
  const [nonWorkRate, setNonWorkRate] = useState(() => loadRate(LS.setupNonWorking, STANDARD_SETUP.nonWorking))
  const set = (k: string, v: number) => setQty(p => ({ ...p, [k]: v }))

  // Persist the dealer's rates (shared keys → syncs with the sales-tab calculator).
  const persist = (setter: (n: number) => void, key: string) => (n: number) => { setter(n); saveRate(key, n) }

  const calc = useMemo(() => {
    const rows = INSTALL_PARTS.map(p => {
      const q = qty[p.key] || 0
      return { ...p, q, costEa: dealerCost(p.baseCost), retailEa: retailPrice(p.baseCost), cost: q * dealerCost(p.baseCost), retail: q * retailPrice(p.baseCost) }
    })
    const laborCost = hours * costRate, laborRetail = hours * retailRate
    // Full dealer cost is the same regardless of how we CHARGE it.
    const partsCost = rows.reduce((s, r) => s + r.cost, 0)
    const totalCost = partsCost + laborCost
    const baseCost = rows.filter(r => isBase(r.key)).reduce((s, r) => s + r.cost, 0) + laborCost   // controller + labor
    const extraRows = rows.filter(r => !isBase(r.key) && r.q > 0)
    const stdRetail = workingGates * workRate + nonWorkingGates * nonWorkRate

    let totalRetail = 0
    const lines: GenLine[] = []
    if (mode === 'itemized') {
      totalRetail = rows.reduce((s, r) => s + r.retail, 0) + laborRetail
      for (const r of rows) if (r.q > 0) lines.push({ description: r.name, qty: r.q, unit_price: r.retailEa, is_recurring: false, is_optional: false, unit_cost: r.costEa, labor_hours: 0 })
      if (hours > 0) lines.push({ description: 'Install labor', qty: hours, unit_price: retailRate, is_recurring: false, is_optional: false, unit_cost: costRate, labor_hours: 0 })
    } else {
      // standard + standard_plus both charge the flat setup rate for the base install.
      // Spread the covered cost across the gates so the P&L totals stay exact.
      const coveredCost = mode === 'standard' ? totalCost : baseCost
      const perGateCost = totalGates > 0 ? coveredCost / totalGates : coveredCost
      if (workingGates > 0) lines.push({ description: 'Gate setup — working', qty: workingGates, unit_price: workRate, is_recurring: false, is_optional: false, unit_cost: perGateCost, labor_hours: 0 })
      if (nonWorkingGates > 0) lines.push({ description: 'Gate setup — non-working / repair', qty: nonWorkingGates, unit_price: nonWorkRate, is_recurring: false, is_optional: false, unit_cost: perGateCost, labor_hours: 0 })
      if (totalGates === 0 && coveredCost > 0) lines.push({ description: 'Gate setup', qty: 1, unit_price: workRate, is_recurring: false, is_optional: false, unit_cost: coveredCost, labor_hours: 0 })
      totalRetail = stdRetail || (totalGates === 0 ? workRate : 0)
      if (mode === 'standard_plus') {
        for (const r of extraRows) lines.push({ description: r.name, qty: r.q, unit_price: r.retailEa, is_recurring: false, is_optional: false, unit_cost: r.costEa, labor_hours: 0 })
        totalRetail += extraRows.reduce((s, r) => s + r.retail, 0)
      }
    }
    const profit = totalRetail - totalCost
    const margin = totalRetail > 0 ? profit / totalRetail : 0
    return { rows, extraRows, laborCost, laborRetail, totalCost, totalRetail, profit, margin, stdRetail, lines }
  }, [mode, qty, hours, costRate, retailRate, workRate, nonWorkRate, workingGates, nonWorkingGates, totalGates])

  const marginColor = calc.margin >= 0.4 ? '#12b886' : calc.margin >= 0.25 ? '#f0a020' : '#f0556a'
  const showStd = mode !== 'itemized'

  const inputS = { display: 'block', width: '100%', marginTop: 4, padding: '9px 10px', borderRadius: 9, background: '#0c1420', border: '1px solid rgba(140,170,200,0.24)', color: '#eef4fb', fontSize: 15, fontWeight: 600 } as const
  const lblS = { fontSize: 10.5, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase', color: '#9fb4c9' } as const

  const modes: { v: Mode; l: string }[] = [
    { v: 'standard', l: 'Standard rate' },
    { v: 'standard_plus', l: 'Standard + extras' },
    { v: 'itemized', l: 'Fully itemized' },
  ]

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(6,12,20,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(660px,100%)', maxHeight: '92vh', overflowY: 'auto', borderRadius: 18, padding: 20, color: '#eef4fb', background: 'repeating-linear-gradient(90deg,rgba(255,255,255,0.04) 0 1px,transparent 1px 4px), linear-gradient(180deg,#33465e,#243141)', border: '1px solid rgba(170,198,222,0.3)', boxShadow: '0 30px 80px rgba(0,0,0,0.55)' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>🔧 Install calculator</div>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)', color: '#cfe0f0', borderRadius: 9, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>Close</button>
        </div>

        {/* Mode selector */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
          {modes.map(m => (
            <button key={m.v} onClick={() => setMode(m.v)} style={{ flex: 1, padding: '8px 6px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', ...(mode === m.v ? { background: '#5FB8E0', border: '1px solid #5FB8E0', color: '#04202e' } : { background: 'transparent', border: '1px solid rgba(255,255,255,0.18)', color: '#c3d3e2' }) }}>{m.l}</button>
          ))}
        </div>
        <div style={{ fontSize: 11.5, color: '#9fb4c9', marginBottom: 12 }}>
          {mode === 'standard' ? 'Charge the flat setup rate per gate. Parts/labor below set your cost so you see margin.'
            : mode === 'standard_plus' ? 'Flat setup rate covers the base install; additional equipment is itemized on top.'
              : 'Every part and labor billed at retail, fully itemized for the client.'}
        </div>

        {/* Standard rate + gate counts (standard modes) */}
        {showStd && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            <label style={{ ...lblS, color: '#9FD8EC' }}>Working gates<input type="number" min={0} value={workingGates === 0 ? '' : workingGates} placeholder="0" onFocus={e => e.target.select()} onChange={e => setWorkingGates(num(e.target.value))} style={inputS} /></label>
            <label style={{ ...lblS, color: '#9FD8EC' }}>Non-working<input type="number" min={0} value={nonWorkingGates === 0 ? '' : nonWorkingGates} placeholder="0" onFocus={e => e.target.select()} onChange={e => setNonWorkingGates(num(e.target.value))} style={inputS} /></label>
            <label style={{ ...lblS, color: '#9FD8EC' }}>Rate — working<input type="number" min={0} value={workRate === 0 ? '' : workRate} placeholder="0" onFocus={e => e.target.select()} onChange={e => persist(setWorkRate, LS.setupWorking)(num(e.target.value))} style={inputS} /></label>
            <label style={{ ...lblS, color: '#9FD8EC' }}>Rate — non-work<input type="number" min={0} value={nonWorkRate === 0 ? '' : nonWorkRate} placeholder="0" onFocus={e => e.target.select()} onChange={e => persist(setNonWorkRate, LS.setupNonWorking)(num(e.target.value))} style={inputS} /></label>
          </div>
        )}

        {/* Part quantities — the whole BOM for itemized; the cost basis + extras otherwise */}
        <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#8fa4b8', marginBottom: 4 }}>
          {mode === 'standard' ? 'Equipment (sets your cost)' : mode === 'standard_plus' ? 'Equipment — base is in the rate, extras itemized' : 'Equipment'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {INSTALL_PARTS.map(p => (
            <label key={p.key} style={{ ...lblS, opacity: mode === 'standard_plus' && isBase(p.key) ? 0.6 : 1 }}>
              {p.name}{p.verify ? ' *' : ''}{mode === 'standard_plus' && isBase(p.key) ? ' (in rate)' : mode === 'standard_plus' && !isBase(p.key) ? ' (extra)' : ''}
              <input type="number" min={0} value={qty[p.key] === 0 ? '' : qty[p.key]} placeholder="0" onFocus={e => e.target.select()} onChange={e => set(p.key, num(e.target.value))} style={inputS} />
            </label>
          ))}
        </div>

        {/* Labor */}
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <label style={{ ...lblS, color: '#9FD8EC' }}>Labor hours<input type="number" min={0} value={hours === 0 ? '' : hours} placeholder="0" onFocus={e => e.target.select()} onChange={e => setHours(num(e.target.value))} style={inputS} /></label>
          <label style={{ ...lblS, color: '#9FD8EC' }}>Your cost $/hr<input type="number" min={0} value={costRate === 0 ? '' : costRate} placeholder="0" onFocus={e => e.target.select()} onChange={e => persist(setCostRate, LS.laborCost)(num(e.target.value))} style={inputS} /></label>
          <label style={{ ...lblS, color: '#9FD8EC' }}>Your bill $/hr<input type="number" min={0} value={retailRate === 0 ? '' : retailRate} placeholder="0" onFocus={e => e.target.select()} onChange={e => persist(setRetailRate, LS.laborRetail)(num(e.target.value))} style={inputS} /></label>
        </div>

        {/* Totals */}
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div style={{ borderRadius: 10, padding: '8px 10px', background: 'rgba(0,0,0,0.24)', border: '1px solid rgba(140,170,200,0.2)' }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', color: '#8fa4b8' }}>Your cost</div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>{money(calc.totalCost)}</div>
          </div>
          <div style={{ borderRadius: 10, padding: '8px 10px', background: 'rgba(0,0,0,0.24)', border: '1px solid rgba(140,170,200,0.2)' }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', color: '#8fa4b8' }}>Setup charged</div>
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
        <div style={{ fontSize: 10.5, color: '#6f8299', marginTop: 8 }}>* placeholder part cost — confirm with corporate. Your labor + setup rates are saved and shared with the sales-tab calculator.</div>
      </div>
    </div>
  )
}
