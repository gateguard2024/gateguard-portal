'use client'

// Gate Guard cost + dealer-price calculator — see docs/nexus/PRICING_MODEL.md.
// Step 1: Gate Guard COST (what GG pays Brivo / Eagle Eye).
// Step 2: Dealer price = ACCESS (per-unit) + UNIT-LOCK ADD-ONS.
//   ACCESS (base, gates/common doors, common-area locks, cameras, passes):
//     $5/unit ≤ 500 units; slides toward cost/unit+$3 above 500 (cap $5, floor
//     cost/unit+$2.25). Access cost over what units can carry → equipment fee at 2×.
//   UNIT LOCKS (app + gateway) are ALWAYS add-ons at GG cost + $2 margin each.
import { useMemo, useState } from 'react'
import { useUser } from '@clerk/nextjs'

const PASS_INCLUDED = 500
const MARGIN_MIN = 2.25
const MARGIN_TARGET = 3.0
const UNIT_PRICE = 5
const FLOOR_LIMIT = 500
const OVERAGE_MARKUP = 2
const ADDON_MARGIN = 2        // unit door locks: GG cost + $2
const MSO_AGENT_PER_UNIT = 1  // commission carved from the retail markup → MSO + agent

const COST = {
  base: 89.25,
  doorS1: 11.10, doorS2: 9.0, doorS3: 3.72,
  commonLock: 2.25,
  unitPassApp: 2.25, unitGateway: 4.5,
  camera: 15,
  passBlock: 30,
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

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[12px]" style={{ color: 'rgba(255,255,255,0.7)' }}>
      <span>{label}</span><span style={{ color: 'rgba(255,255,255,0.92)' }}>{value}</span>
    </div>
  )
}

export function PricingCalculator({ initialUnits, initialUnitAutomation }: { initialUnits?: number | string | null; initialUnitAutomation?: boolean } = {}) {
  const seedUnits = initialUnits != null && initialUnits !== '' ? String(initialUnits) : ''
  const [livingUnits, setLivingUnits] = useState(seedUnits)
  const [doors, setDoors] = useState('')
  const [commonLocks, setCommonLocks] = useState('')
  // If the deal has unit automation, seed app-controlled locks = unit count (rep adjusts).
  const [unitsApp, setUnitsApp] = useState(initialUnitAutomation ? seedUnits : '')
  const [unitsGw, setUnitsGw] = useState('')
  const [camMon, setCamMon] = useState('')
  const [camBackup, setCamBackup] = useState('')
  const [passesPerUnit, setPassesPerUnit] = useState('1.5')

  // Internal view (GG cost + profit) is for GateGuard corporate admins only.
  // Everyone else sees the dealer copy: Gate Guard Fee + Suggested Retail.
  const { user } = useUser()
  const meta = (user?.publicMetadata ?? {}) as Record<string, unknown>
  const internal = meta.org_tier === 'corporate' && meta.role === 'admin'
  const [viewAsDealer, setViewAsDealer] = useState(false)   // admins can preview the dealer copy
  const showInternal = internal && !viewAsDealer

  const n = (s: string) => Number(s) || 0

  const calc = useMemo(() => {
    const appUnits = n(unitsApp), gwUnits = n(unitsGw)
    const cameras = n(camMon) + n(camBackup)
    const hasBrivo = n(doors) > 0 || n(commonLocks) > 0 || appUnits > 0 || gwUnits > 0
    const units = n(livingUnits) || (appUnits + gwUnits)
    const passes = hasBrivo ? units * n(passesPerUnit) : 0
    const passBlocks = Math.ceil(Math.max(0, passes - PASS_INCLUDED) / 100)

    // ── Access bucket (the $5/unit model) ────────────────────────────────────
    const accessCost =
      (hasBrivo ? COST.base : 0) +
      doorCost(n(doors)) +
      n(commonLocks) * COST.commonLock +
      cameras * COST.camera +
      passBlocks * COST.passBlock
    const accessCostPerUnit = units > 0 ? accessCost / units : 0
    let pricePerUnit = 0
    if (units > 0) {
      pricePerUnit = units <= FLOOR_LIMIT
        ? UNIT_PRICE
        : Math.max(accessCostPerUnit + MARGIN_MIN, Math.min(UNIT_PRICE, accessCostPerUnit + MARGIN_TARGET))
    }
    const budget = units * Math.max(0, pricePerUnit - MARGIN_MIN)
    const overage = Math.max(0, accessCost - budget)
    const equipFee = overage * OVERAGE_MARKUP
    const overModel = equipFee > 0
    const perDoorFee = overModel && n(doors) > 0 ? equipFee / n(doors) : 0
    const accessRevenue = pricePerUnit * units + equipFee

    // ── Unit-lock add-ons (always cost + $2) ─────────────────────────────────
    const appPrice = COST.unitPassApp + ADDON_MARGIN   // $4.25
    const gwPrice = COST.unitGateway + ADDON_MARGIN    // $6.50
    const appAddon = appUnits * appPrice
    const gwAddon = gwUnits * gwPrice
    const addonCost = appUnits * COST.unitPassApp + gwUnits * COST.unitGateway
    const addonRevenue = appAddon + gwAddon

    const ggCost = accessCost + addonCost
    const dealerPrice = accessRevenue + addonRevenue
    const margin = dealerPrice - ggCost
    const marginPerUnit = units > 0 ? margin / units : 0

    return {
      ggCost, units, accessCost, accessRevenue, pricePerUnit,
      equipFee, overModel, perDoorFee, doors: n(doors),
      appUnits, gwUnits, appPrice, gwPrice, appAddon, gwAddon,
      dealerPrice, margin, marginPerUnit,
      sliding: units > FLOOR_LIMIT,
      noUnits: units === 0, empty: ggCost === 0,
    }
  }, [livingUnits, doors, commonLocks, unitsApp, unitsGw, camMon, camBackup, passesPerUnit])

  const ggFee = calc.dealerPrice          // what the dealer pays GG
  const suggestedRetail = ggFee * 2       // ~2× → end-user price
  const commission = calc.units * MSO_AGENT_PER_UNIT   // $1/unit → MSO + agent (from the retail markup)
  const dealerProfit = suggestedRetail - ggFee - commission

  return (
    <div className="space-y-5">
      {internal && (
        <div className="flex items-center gap-2 rounded-full p-1 text-[12px] font-semibold" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', width: 'fit-content' }}>
          <button type="button" onClick={() => setViewAsDealer(false)} className="rounded-full px-3 py-1.5" style={!viewAsDealer ? { background: 'rgba(0,200,255,0.2)', border: '1px solid rgba(0,200,255,0.5)', color: '#7DE5FF' } : { color: 'rgba(255,255,255,0.6)' }}>Internal (cost + profit)</button>
          <button type="button" onClick={() => setViewAsDealer(true)} className="rounded-full px-3 py-1.5" style={viewAsDealer ? { background: 'rgba(52,211,153,0.2)', border: '1px solid rgba(52,211,153,0.5)', color: '#6ee7b7' } : { color: 'rgba(255,255,255,0.6)' }}>Dealer view (preview)</button>
        </div>
      )}
      <div className="rounded-3xl p-4" style={{ background: 'linear-gradient(180deg, rgba(8,18,34,0.7), rgba(3,9,22,0.5))', border: '1px solid rgba(0,200,255,0.16)' }}>
        <div className="mb-1 text-base font-semibold" style={{ color: 'rgba(255,255,255,0.95)' }}>What's on this site?</div>
        <div className="mb-4 text-[12px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Type how many of each — cost + dealer price update as you go.</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Num label="Total living units" value={livingUnits} onChange={setLivingUnits} hint="property size — drives $5/unit access" />
          <Num label="Gates / common doors" value={doors} onChange={setDoors} hint="tiered $11.10 / $9 / $3.72" />
          <Num label="Common-area smart locks" value={commonLocks} onChange={setCommonLocks} hint="$2.25 each" />
          <Num label="Unit locks — app" value={unitsApp} onChange={setUnitsApp} hint="add-on · $4.25/unit" />
          <Num label="Unit locks — gateway" value={unitsGw} onChange={setUnitsGw} hint="add-on · $6.50/unit" />
          <Num label="Cameras — monitored" value={camMon} onChange={setCamMon} hint="$15 cost each" />
          <Num label="Cameras — backup only" value={camBackup} onChange={setCamBackup} hint="$15 cost each" />
          <Num label="Passes per unit" value={passesPerUnit} onChange={setPassesPerUnit} hint="500 incl · $30/100 over" decimal />
        </div>
      </div>

      {showInternal && (
        <div className="rounded-3xl p-5" style={{ background: 'radial-gradient(circle at 14% 0%, rgba(0,124,255,0.16), transparent 40%), linear-gradient(180deg, rgba(8,18,34,0.82), rgba(3,9,22,0.6))', border: '1px solid rgba(0,200,255,0.28)' }}>
          <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: 'rgba(0,200,255,0.85)' }}>Gate Guard cost / month · internal</div>
          <div className="mt-1 text-4xl font-bold" style={{ color: '#7DE5FF' }}>{calc.empty ? '—' : usd(calc.ggCost)}</div>
          {!calc.empty && <div className="mt-1 text-[12px]" style={{ color: 'rgba(255,255,255,0.55)' }}>Access {usd(calc.ggCost - (calc.appUnits * COST.unitPassApp + calc.gwUnits * COST.unitGateway))} + unit locks {usd(calc.appUnits * COST.unitPassApp + calc.gwUnits * COST.unitGateway)}</div>}
        </div>
      )}

      <div className="rounded-3xl p-5" style={{ background: 'linear-gradient(180deg, rgba(52,211,153,0.08), rgba(8,18,34,0.6))', border: '1px solid rgba(52,211,153,0.28)' }}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: '#6ee7b7' }}>Gate Guard Fee / month</div>
            <div className="mt-1 text-3xl font-bold" style={{ color: '#6ee7b7' }}>{calc.empty ? '—' : usd(ggFee)}</div>
          </div>
          {showInternal && (
            <div className="text-right text-[12px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {!calc.empty && !calc.noUnits && <>
                <div style={{ color: calc.marginPerUnit >= MARGIN_MIN ? '#6ee7b7' : '#fca5a5' }}>{usd(calc.marginPerUnit)}/unit margin</div>
                <div>{usd(calc.margin)} total margin</div>
              </>}
            </div>
          )}
        </div>
        {!calc.empty && (
          <div className="mt-3 space-y-1.5 rounded-2xl p-3" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)' }}>
            {!calc.noUnits && <Line label={`Access — ${usd(calc.pricePerUnit)}/unit${calc.sliding ? ' (sliding, over 500)' : ''} × ${calc.units}`} value={usd(calc.pricePerUnit * calc.units)} />}
            {calc.equipFee > 0 && <Line label={`Equipment fee (door/camera-heavy${calc.doors > 0 ? `, ≈ ${usd(calc.perDoorFee)}/door` : ''})`} value={usd(calc.equipFee)} />}
            {calc.appUnits > 0 && <Line label={`Unit locks — app · ${calc.appUnits} × ${usd(calc.appPrice)}`} value={usd(calc.appAddon)} />}
            {calc.gwUnits > 0 && <Line label={`Unit locks — gateway · ${calc.gwUnits} × ${usd(calc.gwPrice)}`} value={usd(calc.gwAddon)} />}
          </div>
        )}
        {calc.noUnits && !calc.empty && <div className="mt-3 text-[11px]" style={{ color: '#fde68a' }}>Add living units to price the access service (gate-only / camera-only rule still TBD).</div>}
      </div>

      <div className="rounded-3xl p-5" style={{ background: 'linear-gradient(180deg, rgba(0,200,255,0.08), rgba(8,18,34,0.6))', border: '1px solid rgba(0,200,255,0.28)' }}>
        <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: '#7DE5FF' }}>Suggested retail / month</div>
        <div className="mt-1 text-3xl font-bold" style={{ color: '#7DE5FF' }}>{calc.empty ? '—' : usd(suggestedRetail)}</div>
        <div className="mt-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.45)' }}>Recommended price to the property — you set the final number.</div>
      </div>

      {/* Your expected profit — reconciles retail vs fee vs commission so nothing is "missing" */}
      <div className="rounded-3xl p-5" style={{ background: 'linear-gradient(180deg, rgba(52,211,153,0.10), rgba(8,18,34,0.6))', border: '1px solid rgba(52,211,153,0.3)' }}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: '#6ee7b7' }}>Your expected profit / month</div>
            <div className="mt-1 text-3xl font-bold" style={{ color: '#6ee7b7' }}>{calc.empty ? '—' : usd(dealerProfit)}</div>
          </div>
          {!calc.empty && !calc.noUnits && <div className="text-[12px]" style={{ color: 'rgba(255,255,255,0.55)' }}>≈ {usd(dealerProfit / calc.units)}/unit</div>}
        </div>
        {!calc.empty && (
          <div className="mt-3 space-y-1.5 rounded-2xl p-3" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <Line label="Suggested retail" value={usd(suggestedRetail)} />
            <Line label="Gate Guard Fee" value={`(${usd(ggFee)})`} />
            <Line label={`MSO & Agent Override${calc.units > 0 ? ` · ${usd(MSO_AGENT_PER_UNIT)}/unit` : ''}`} value={`(${usd(commission)})`} />
            <div className="mt-1 border-t pt-1.5" style={{ borderColor: 'rgba(255,255,255,0.1)' }}><Line label="Your net profit" value={usd(dealerProfit)} /></div>
          </div>
        )}
        <div className="mt-2 text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>MSO &amp; Agent Override is the network commission ({usd(MSO_AGENT_PER_UNIT)}/unit/mo) paid through Gate Guard to the master operator and agent.</div>
      </div>

      <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
        {showInternal
          ? <>Access = $5/unit ≤ 500 (slides above); over-budget doors/cameras billed at {OVERAGE_MARKUP}× as equipment fees. Unit locks always cost + ${ADDON_MARGIN.toFixed(2)}. Costs: docs/nexus/PRICING_MODEL.md.</>
          : <>Gate Guard Fee is your monthly cost from Gate Guard. Suggested retail is a recommended price to the property — you set the final number.</>}
      </div>
    </div>
  )
}
