'use client'

// Itemized pricing calculator — see docs/nexus/PRICING_MODEL.md.
// THE RULE (locked): price = max(MIN_FEE, cost × 2)  →  50% margin.
// Reps just enter the site; price comes out. The two settings below are the
// only knobs, and they live here (not in the rep UI).
import { useMemo, useState } from 'react'

const MIN_FEE = 150          // minimum monthly price ($) — protects small sites
const PRICE_MULTIPLIER = 2   // 2× cost = 50% margin
const PASS_INCLUDED = 500    // mobile passes included in the MDU base

const COST = {
  base: 89.25,               // Brivo base — applies only when there's access (doors/units)
  doorS1: 11.10, doorS2: 9.00, doorS3: 3.72,
  unitPassApp: 2.25, unitGateway: 4.50,
  camAccess: 14, camMonitored: 30,
  passBlock: 30,             // per 100 mobile passes over the 500 included
}

function doorCost(doors: number): number {
  let c = 0
  for (let i = 1; i <= doors; i++) c += i <= 2 ? COST.doorS1 : i <= 12 ? COST.doorS2 : COST.doorS3
  return c
}

const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
const inputStyle = { background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.92)' } as const

function Num({ label, value, onChange, hint, decimal }: { label: string; value: string; onChange: (v: string) => void; hint?: string; decimal?: boolean }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.62)' }}>{label}</div>
      <input value={value} onChange={e => onChange(decimal ? e.target.value.replace(/[^0-9.]/g, '') : e.target.value.replace(/[^0-9]/g, ''))} inputMode="decimal" placeholder="0" className="w-full rounded-xl px-3 py-2.5 text-base outline-none" style={inputStyle} />
      {hint && <div className="mt-0.5 text-[10px]" style={{ color: 'rgba(255,255,255,0.34)' }}>{hint}</div>}
    </label>
  )
}

export function PricingCalculator() {
  const [doors, setDoors] = useState('')
  const [unitsApp, setUnitsApp] = useState('')
  const [unitsGw, setUnitsGw] = useState('')
  const [camAccess, setCamAccess] = useState('')
  const [camMon, setCamMon] = useState('')
  const [passesPerUnit, setPassesPerUnit] = useState('2')

  const n = (s: string) => Number(s) || 0

  const calc = useMemo(() => {
    const totalUnits = n(unitsApp) + n(unitsGw)
    const hasAccess = n(doors) > 0 || totalUnits > 0
    const passes = totalUnits * n(passesPerUnit)
    const passBlocks = Math.ceil(Math.max(0, passes - PASS_INCLUDED) / 100)
    const cost =
      (hasAccess ? COST.base : 0) +
      doorCost(n(doors)) +
      n(unitsApp) * COST.unitPassApp +
      n(unitsGw) * COST.unitGateway +
      n(camAccess) * COST.camAccess +
      n(camMon) * COST.camMonitored +
      passBlocks * COST.passBlock

    const priceRaw = cost * PRICE_MULTIPLIER
    const price = Math.max(MIN_FEE, priceRaw)
    const atFloor = price > priceRaw && cost > 0
    const margin = price - cost
    const marginPct = price > 0 ? (margin / price) * 100 : 0
    const perUnit = totalUnits > 0 ? price / totalUnits : 0
    return { cost, price, margin, marginPct, perUnit, atFloor, totalUnits, empty: cost === 0 }
  }, [doors, unitsApp, unitsGw, camAccess, camMon, passesPerUnit])

  return (
    <div className="space-y-5">
      <div className="rounded-3xl p-4" style={{ background: 'linear-gradient(180deg, rgba(8,18,34,0.7), rgba(3,9,22,0.5))', border: '1px solid rgba(0,200,255,0.16)' }}>
        <div className="mb-1 text-base font-semibold" style={{ color: 'rgba(255,255,255,0.95)' }}>What's on this site?</div>
        <div className="mb-4 text-[12px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Type how many of each. The price updates as you go.</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Num label="Gates / common doors" value={doors} onChange={setDoors} />
          <Num label="Smart-lock units (app)" value={unitsApp} onChange={setUnitsApp} hint="$2.25 cost/unit" />
          <Num label="Smart-home units (gateway)" value={unitsGw} onChange={setUnitsGw} hint="$4.50 cost/unit" />
          <Num label="Cameras — backup only" value={camAccess} onChange={setCamAccess} hint="$14 cost each" />
          <Num label="Cameras — monitored" value={camMon} onChange={setCamMon} hint="$30 cost each" />
          <Num label="Passes per unit" value={passesPerUnit} onChange={setPassesPerUnit} hint="500 incl · $30/100 over" decimal />
        </div>
      </div>

      <div className="rounded-3xl p-5" style={{ background: 'radial-gradient(circle at 14% 0%, rgba(0,124,255,0.16), transparent 40%), linear-gradient(180deg, rgba(8,18,34,0.82), rgba(3,9,22,0.6))', border: '1px solid rgba(0,200,255,0.28)' }}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: 'rgba(0,200,255,0.85)' }}>Monthly price</div>
            <div className="mt-1 text-4xl font-bold" style={{ color: '#7DE5FF' }}>{calc.empty ? '—' : usd(calc.price)}</div>
            {calc.totalUnits > 0 && !calc.empty && <div className="mt-1 text-[12px]" style={{ color: 'rgba(255,255,255,0.55)' }}>{usd(calc.perUnit)} per unit · {calc.totalUnits} units</div>}
          </div>
          <div className="text-right">
            <div className="text-[12px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Cost {usd(calc.cost)}</div>
            <div className="text-[12px]" style={{ color: calc.marginPct >= 50 ? '#6ee7b7' : '#fde68a' }}>Margin {calc.empty ? '—' : `${usd(calc.margin)} · ${calc.marginPct.toFixed(0)}%`}</div>
            {calc.atFloor && <div className="mt-1 text-[11px]" style={{ color: '#fde68a' }}>At the ${MIN_FEE} minimum</div>}
          </div>
        </div>
      </div>
      <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Rule: price = 2× cost (50% margin), never below ${MIN_FEE}/mo. Brivo base only counts when there's access. Costs: docs/nexus/PRICING_MODEL.md.</div>
    </div>
  )
}
