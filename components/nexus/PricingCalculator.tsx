'use client'

// Gate Guard cost + dealer-price calculator.
// The COST model is computed SERVER-SIDE (/api/pricing/compute) so GateGuard's
// true Brivo / Eagle Eye costs and margin math never ship in the browser bundle.
// This component only collects counts, sends them to the API, and renders the
// gated result. See lib/pricing-model.ts + docs/nexus/PRICING_MODEL.md.
import { useEffect, useMemo, useRef, useState } from 'react'

// Dealer-facing display constants only (NOT cost basis — safe in the client):
const OVERAGE_MARKUP = 2
const ADDON_MARGIN = 2
const MSO_AGENT_PER_UNIT = 1

const usd = (n: number) => (Number(n) || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
const inputStyle = { background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.92)' } as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Result = Record<string, any>

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

export function PricingCalculator({ initialUnits, initialUnitAutomation, initialDoors, initialCommonLocks, initialCameras, onCompute }: { initialUnits?: number | string | null; initialUnitAutomation?: boolean; initialDoors?: number | string | null; initialCommonLocks?: number | string | null; initialCameras?: number | string | null; onCompute?: (c: { units: number; ggFee: number; ggCost: number; suggestedRetail: number; commission: number; dealerMonthlyNet: number; empty: boolean }) => void } = {}) {
  const seedUnits = initialUnits != null && initialUnits !== '' ? String(initialUnits) : ''
  const seed = (v: number | string | null | undefined) => (v != null && v !== '' && Number(v) > 0 ? String(v) : '')
  const [livingUnits, setLivingUnits] = useState(seedUnits)
  const [doors, setDoors] = useState(seed(initialDoors))
  const [commonLocks, setCommonLocks] = useState(seed(initialCommonLocks))
  const [unitsApp, setUnitsApp] = useState(initialUnitAutomation ? seedUnits : '')
  const [unitsGw, setUnitsGw] = useState('')
  const [camMon, setCamMon] = useState(seed(initialCameras))
  const [camBackup, setCamBackup] = useState('')
  const [passesPerUnit, setPassesPerUnit] = useState('1.5')

  const [viewAsDealer, setViewAsDealer] = useState(false)   // admins can preview the dealer copy
  const [canViewInternal, setCanViewInternal] = useState(false)
  const [internalView, setInternalView] = useState(false)
  const [calc, setCalc] = useState<Result>({ empty: true, noUnits: true })

  const inputs = useMemo(() => ({ livingUnits, doors, commonLocks, unitsApp, unitsGw, camMon, camBackup, passesPerUnit }),
    [livingUnits, doors, commonLocks, unitsApp, unitsGw, camMon, camBackup, passesPerUnit])

  // Compute server-side, debounced. Re-runs when inputs or the admin preview toggle change.
  const onComputeRef = useRef(onCompute)
  useEffect(() => { onComputeRef.current = onCompute }, [onCompute])
  useEffect(() => {
    const t = setTimeout(() => {
      void fetch('/api/pricing/compute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...inputs, viewAsDealer }),
      }).then(r => r.json()).then(j => {
        if (!j || !j.result) return
        setCalc(j.result)
        setCanViewInternal(!!j.canViewInternal)
        setInternalView(!!j.internalView)
        const c = j.result
        onComputeRef.current?.({
          units: c.units, ggFee: c.ggFee, ggCost: c.ggCost ?? 0,
          suggestedRetail: c.suggestedRetail, commission: c.commission,
          dealerMonthlyNet: c.dealerMonthlyNet, empty: c.empty,
        })
      }).catch(() => {})
    }, 250)
    return () => clearTimeout(t)
  }, [inputs, viewAsDealer])

  const showInternal = canViewInternal && internalView
  const ggFee = calc.ggFee ?? 0
  const suggestedRetail = calc.suggestedRetail ?? 0
  const commission = calc.commission ?? 0
  const dealerProfit = calc.dealerProfit ?? 0

  return (
    <div className="space-y-5">
      {canViewInternal && (
        <div className="flex items-center gap-2 rounded-full p-1 text-[12px] font-semibold" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', width: 'fit-content' }}>
          <button type="button" onClick={() => setViewAsDealer(false)} className="rounded-full px-3 py-1.5" style={!viewAsDealer ? { background: 'rgba(0,200,255,0.2)', border: '1px solid rgba(0,200,255,0.5)', color: '#7DE5FF' } : { color: 'rgba(255,255,255,0.6)' }}>Internal (cost + profit)</button>
          <button type="button" onClick={() => setViewAsDealer(true)} className="rounded-full px-3 py-1.5" style={viewAsDealer ? { background: 'rgba(52,211,153,0.2)', border: '1px solid rgba(52,211,153,0.5)', color: '#6ee7b7' } : { color: 'rgba(255,255,255,0.6)' }}>Dealer view (preview)</button>
        </div>
      )}
      <div className="rounded-3xl p-4" style={{ background: 'linear-gradient(180deg, rgba(8,18,34,0.7), rgba(3,9,22,0.5))', border: '1px solid rgba(0,200,255,0.16)' }}>
        <div className="mb-1 text-base font-semibold" style={{ color: 'rgba(255,255,255,0.95)' }}>What&apos;s on this site?</div>
        <div className="mb-4 text-[12px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Type how many of each — cost + dealer price update as you go.</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Num label="Total living units" value={livingUnits} onChange={setLivingUnits} hint="property size — drives $5/unit access" />
          <Num label="Gates / common doors" value={doors} onChange={setDoors} hint="tiered pricing by count" />
          <Num label="Common-area smart locks" value={commonLocks} onChange={setCommonLocks} hint="per lock" />
          <Num label="Unit locks — app" value={unitsApp} onChange={setUnitsApp} hint={`add-on · ${usd(calc.appPrice ?? 4.25)}/unit`} />
          <Num label="Unit locks — gateway" value={unitsGw} onChange={setUnitsGw} hint={`add-on · ${usd(calc.gwPrice ?? 6.5)}/unit`} />
          <Num label="Cameras — monitored" value={camMon} onChange={setCamMon} hint="per camera" />
          <Num label="Cameras — backup only" value={camBackup} onChange={setCamBackup} hint="per camera" />
          <Num label="Passes per unit" value={passesPerUnit} onChange={setPassesPerUnit} hint="500 incl · billed per 100 over" decimal />
        </div>
      </div>

      {showInternal && (
        <div className="rounded-3xl p-5" style={{ background: 'radial-gradient(circle at 14% 0%, rgba(0,124,255,0.16), transparent 40%), linear-gradient(180deg, rgba(8,18,34,0.82), rgba(3,9,22,0.6))', border: '1px solid rgba(0,200,255,0.28)' }}>
          <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: 'rgba(0,200,255,0.85)' }}>Gate Guard cost / month · internal</div>
          <div className="mt-1 text-4xl font-bold" style={{ color: '#7DE5FF' }}>{calc.empty ? '—' : usd(calc.ggCost ?? 0)}</div>
          {!calc.empty && <div className="mt-1 text-[12px]" style={{ color: 'rgba(255,255,255,0.55)' }}>Access {usd(calc.accessCost ?? 0)} + unit locks {usd(calc.unitLockCost ?? 0)}</div>}
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
                <div style={{ color: (calc.marginPerUnit ?? 0) >= 2.25 ? '#6ee7b7' : '#fca5a5' }}>{usd(calc.marginPerUnit ?? 0)}/unit margin</div>
                <div>{usd(calc.margin ?? 0)} total margin</div>
              </>}
            </div>
          )}
        </div>
        {!calc.empty && (
          <div className="mt-3 space-y-1.5 rounded-2xl p-3" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)' }}>
            {!calc.noUnits && <Line label={`Access — ${usd(calc.pricePerUnit ?? 0)}/unit${calc.sliding ? ' (sliding, over 500)' : ''} × ${calc.units}`} value={usd((calc.pricePerUnit ?? 0) * (calc.units ?? 0))} />}
            {(calc.equipFee ?? 0) > 0 && <Line label={`Equipment fee (door/camera-heavy${(calc.doors ?? 0) > 0 ? `, ≈ ${usd(calc.perDoorFee ?? 0)}/door` : ''})`} value={usd(calc.equipFee ?? 0)} />}
            {(calc.appUnits ?? 0) > 0 && <Line label={`Unit locks — app · ${calc.appUnits} × ${usd(calc.appPrice ?? 0)}`} value={usd(calc.appAddon ?? 0)} />}
            {(calc.gwUnits ?? 0) > 0 && <Line label={`Unit locks — gateway · ${calc.gwUnits} × ${usd(calc.gwPrice ?? 0)}`} value={usd(calc.gwAddon ?? 0)} />}
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
          {!calc.empty && !calc.noUnits && (calc.units ?? 0) > 0 && <div className="text-[12px]" style={{ color: 'rgba(255,255,255,0.55)' }}>≈ {usd(dealerProfit / calc.units)}/unit</div>}
        </div>
        {!calc.empty && (
          <div className="mt-3 space-y-1.5 rounded-2xl p-3" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <Line label="Suggested retail" value={usd(suggestedRetail)} />
            <Line label="Gate Guard Fee" value={`(${usd(ggFee)})`} />
            <Line label={`MSO & Agent Override${(calc.units ?? 0) > 0 ? ` · ${usd(MSO_AGENT_PER_UNIT)}/unit` : ''}`} value={`(${usd(commission)})`} />
            <div className="mt-1 border-t pt-1.5" style={{ borderColor: 'rgba(255,255,255,0.1)' }}><Line label="Your net profit" value={usd(dealerProfit)} /></div>
          </div>
        )}
        <div className="mt-2 text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>MSO &amp; Agent Override is the network commission ({usd(MSO_AGENT_PER_UNIT)}/unit/mo) paid through Gate Guard to the master operator and agent.</div>
      </div>

      <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
        {showInternal
          ? <>Access = $5/unit ≤ 500 (slides above); over-budget doors/cameras billed at {OVERAGE_MARKUP}× as equipment fees. Unit locks always cost + ${ADDON_MARGIN.toFixed(2)}. Cost model is computed server-side.</>
          : <>Gate Guard Fee is your monthly cost from Gate Guard. Suggested retail is a recommended price to the property — you set the final number.</>}
      </div>
    </div>
  )
}
