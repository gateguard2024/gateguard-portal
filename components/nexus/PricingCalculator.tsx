'use client'

// Gate Guard cost + dealer-price calculator — see docs/nexus/PRICING_MODEL.md.
// Step 1: compute GATE GUARD COST (what GG pays Brivo / Eagle Eye).
// Step 2: dealer price = GG cost + (living units × per-unit margin), where the
//         GG margin per unit is bounded $2.25 min / $3.00 max.
// (Phase 2: dealer → end-user price.)
import { useMemo, useState } from 'react'

const PASS_INCLUDED = 500
const MARGIN_MIN = 2.25      // Gate Guard margin per unit — floor
const MARGIN_MAX = 3.00      // Gate Guard margin per unit — ceiling

const COST = {
  base: 89.25,               // Brivo base/site (500 passes incl). Applies when there's access.
  doorS1: 11.10, doorS2: 9.00, doorS3: 3.72,   // common/hardwired doors, tiered
  commonLock: 2.25,          // Schlage/Allegion/dormakaba on a common-area door
  unitPassApp: 2.25,         // unit lock controlled via Brivo mobile-pass app
  unitGateway: 4.50,         // unit on Brivo smart-home via gateway
  camera: 15,                // monitored OR stored-video only — both $15
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
  const [livingUnits, setLivingUnits] = useState('')
  const [doors, setDoors] = useState('')
  const [commonLocks, setCommonLocks] = useState('')
  const [unitsApp, setUnitsApp] = useState('')
  const [unitsGw, setUnitsGw] = useState('')
  const [camMon, setCamMon] = useState('')
  const [camBackup, setCamBackup] = useState('')
  const [passesPerUnit, setPassesPerUnit] = useState('1.5')
  const [margin, setMargin] = useState('2.25')   // GG margin per unit (clamped 2.25–3.00)

  const n = (s: string) => Number(s) || 0

  const calc = useMemo(() => {
    const accessUnits = n(unitsApp) + n(unitsGw)
    const cameras = n(camMon) + n(camBackup)
    const hasAccess = n(doors) > 0 || n(commonLocks) > 0 || accessUnits > 0
    const livingTotal = n(livingUnits) || accessUnits
    const passes = hasAccess ? livingTotal * n(passesPerUnit) : 0
    const passBlocks = Math.ceil(Math.max(0, passes - PASS_INCLUDED) / 100)

    // Gate Guard cost (what GG pays Brivo / Eagle Eye)
    const ggCost =
      (hasAccess ? COST.base : 0) +
      doorCost(n(doors)) +
      n(commonLocks) * COST.commonLock +
      n(unitsApp) * COST.unitPassApp +
      n(unitsGw) * COST.unitGateway +
      cameras * COST.camera +
      passBlocks * COST.passBlock

    // Dealer price = GG cost + per-unit margin (bounded)
    const marginPerUnit = Math.min(MARGIN_MAX, Math.max(MARGIN_MIN, n(margin) || MARGIN_MIN))
    const ggMargin = livingTotal * marginPerUnit
    const dealerPrice = ggCost + ggMargin

    return {
      ggCost,
      ggPerUnit: livingTotal > 0 ? ggCost / livingTotal : 0,
      marginPerUnit,
      ggMargin,
      dealerPrice,
      dealerPerUnit: livingTotal > 0 ? dealerPrice / livingTotal : 0,
      livingTotal,
      noUnits: livingTotal === 0,
      empty: ggCost === 0,
    }
  }, [livingUnits, doors, commonLocks, unitsApp, unitsGw, camMon, camBackup, passesPerUnit, margin])

  return (
    <div className="space-y-5">
      <div className="rounded-3xl p-4" style={{ background: 'linear-gradient(180deg, rgba(8,18,34,0.7), rgba(3,9,22,0.5))', border: '1px solid rgba(0,200,255,0.16)' }}>
        <div className="mb-1 text-base font-semibold" style={{ color: 'rgba(255,255,255,0.95)' }}>What's on this site?</div>
        <div className="mb-4 text-[12px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Type how many of each — Gate Guard cost updates as you go.</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Num label="Total living units" value={livingUnits} onChange={setLivingUnits} hint="property size — for $/unit + passes" />
          <Num label="Gates / common doors" value={doors} onChange={setDoors} hint="tiered $11.10 / $9 / $3.72" />
          <Num label="Common-area smart locks" value={commonLocks} onChange={setCommonLocks} hint="$2.25 each" />
          <Num label="Smart-lock units (app)" value={unitsApp} onChange={setUnitsApp} hint="$2.25 cost/unit" />
          <Num label="Smart-home units (gateway)" value={unitsGw} onChange={setUnitsGw} hint="$4.50 cost/unit" />
          <Num label="Cameras — monitored" value={camMon} onChange={setCamMon} hint="$15 cost each" />
          <Num label="Cameras — backup only" value={camBackup} onChange={setCamBackup} hint="$15 cost each" />
          <Num label="Passes per unit" value={passesPerUnit} onChange={setPassesPerUnit} hint="500 incl · $30/100 over" decimal />
          <Num label="GG margin / unit ($2.25–$3.00)" value={margin} onChange={setMargin} hint="bounded; default $2.25" decimal />
        </div>
      </div>

      {/* Step 1 — Gate Guard cost (the foundation) */}
      <div className="rounded-3xl p-5" style={{ background: 'radial-gradient(circle at 14% 0%, rgba(0,124,255,0.16), transparent 40%), linear-gradient(180deg, rgba(8,18,34,0.82), rgba(3,9,22,0.6))', border: '1px solid rgba(0,200,255,0.28)' }}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: 'rgba(0,200,255,0.85)' }}>Gate Guard cost / month</div>
            <div className="mt-1 text-4xl font-bold" style={{ color: '#7DE5FF' }}>{calc.empty ? '—' : usd(calc.ggCost)}</div>
            {!calc.empty && !calc.noUnits && <div className="mt-1 text-[12px]" style={{ color: 'rgba(255,255,255,0.55)' }}>{usd(calc.ggPerUnit)} cost per unit · {calc.livingTotal} units</div>}
          </div>
        </div>
      </div>

      {/* Step 2 — Dealer price */}
      <div className="rounded-3xl p-5" style={{ background: 'linear-gradient(180deg, rgba(52,211,153,0.08), rgba(8,18,34,0.6))', border: '1px solid rgba(52,211,153,0.28)' }}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: '#6ee7b7' }}>Dealer price / month</div>
            <div className="mt-1 text-3xl font-bold" style={{ color: '#6ee7b7' }}>{calc.empty ? '—' : usd(calc.dealerPrice)}</div>
            {!calc.empty && !calc.noUnits && <div className="mt-1 text-[12px]" style={{ color: 'rgba(255,255,255,0.55)' }}>{usd(calc.dealerPerUnit)} per unit</div>}
          </div>
          <div className="text-right text-[12px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
            <div>GG margin kept: {calc.empty ? '—' : usd(calc.ggMargin)}</div>
            <div>{usd(calc.marginPerUnit)}/unit × {calc.livingTotal} units</div>
          </div>
        </div>
        {calc.noUnits && !calc.empty && <div className="mt-3 text-[11px]" style={{ color: '#fde68a' }}>Add living units to apply the per-unit margin (gate-only / camera-only margin rule still TBD).</div>}
      </div>

      <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Step 1 = Gate Guard cost (Brivo + Eagle Eye). Step 2 = dealer price = cost + ${MARGIN_MIN.toFixed(2)}–${MARGIN_MAX.toFixed(2)}/unit margin. Costs: docs/nexus/PRICING_MODEL.md.</div>
    </div>
  )
}
