'use client'

// Gate Guard pricing calculator — EXACT port of the locked "v14" model.
// Graduated per-unit tiers + an included gate/camera allotment + per-item add-ons
// + a proportional channel split + a stepped platform cost + a $350 whole-deal GG
// net floor + whole-dollar customer rounding. The math + GG cost live SERVER-SIDE
// (/api/pricing/compute → lib/pricing-model.ts); GG cost / net are shown only to
// corporate. Dealers see the customer price, per-unit, and their own + channel cut.
import { useEffect, useMemo, useRef, useState } from 'react'

const usd = (n: number) => (Number(n) || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
const usd0 = (n: number) => (Number(n) || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const inputStyle = { background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.92)' } as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Result = Record<string, any>

function Num({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.62)' }}>{label}</div>
      <input value={value} onChange={e => onChange(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" placeholder="0" className="w-full rounded-xl px-3 py-2.5 text-base outline-none" style={inputStyle} />
      {hint && <div className="mt-0.5 text-[10px]" style={{ color: 'rgba(255,255,255,0.34)' }}>{hint}</div>}
    </label>
  )
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[12px]" style={{ color: strong ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.7)' }}>
      <span>{label}</span><span style={{ color: 'rgba(255,255,255,0.92)', fontWeight: strong ? 600 : 400 }}>{value}</span>
    </div>
  )
}

export function PricingCalculator({ initialUnits, initialDoors, initialCameras, initialCommonLocks, initialUnitsApp, initialUnitsGw, initialCamBackup, onCompute, onPersist }: { initialUnits?: number | string | null; initialUnitAutomation?: boolean; initialDoors?: number | string | null; initialCommonLocks?: number | string | null; initialCameras?: number | string | null; initialCamBackup?: number | string | null; initialUnitsApp?: number | string | null; initialUnitsGw?: number | string | null; onCompute?: (c: { units: number; ggFee: number; ggCost: number; suggestedRetail: number; commission: number; dealerMonthlyNet: number; empty: boolean }) => void; onPersist?: (v: { livingUnits: string; unitsApp: string; unitsGw: string; camBackup: string; camMon: string; doors: string; commonLocks: string }) => void } = {}) {
  const seed = (v: number | string | null | undefined) => (v != null && v !== '' && Number(v) > 0 ? String(v) : '')
  // v14 inputs. Entry points reuse the persisted `doors` slot; cameras reuse `camMon`.
  const [livingUnits, setLivingUnits] = useState(seed(initialUnits))
  const [entryPoints, setEntryPoints] = useState(seed(initialDoors))
  const [cameras, setCameras] = useState(seed(initialCameras))
  const [cameraType, setCameraType] = useState<'new' | 'existing'>('new')
  // Legacy persisted fields we no longer edit — kept so a save doesn't wipe them.
  const passthru = useRef({ unitsApp: seed(initialUnitsApp), unitsGw: seed(initialUnitsGw), camBackup: seed(initialCamBackup), commonLocks: seed(initialCommonLocks) })

  const [viewAsDealer, setViewAsDealer] = useState(false)
  const [canViewInternal, setCanViewInternal] = useState(false)
  const [internalView, setInternalView] = useState(false)
  const [calc, setCalc] = useState<Result>({ empty: true, noUnits: true })

  const inputs = useMemo(() => ({ livingUnits, entryPoints, cameras, cameraType }), [livingUnits, entryPoints, cameras, cameraType])

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
          units: c.units, ggFee: c.ggFee ?? 0, ggCost: c.ggCost ?? 0,
          suggestedRetail: c.suggestedRetail, commission: c.commission,
          dealerMonthlyNet: c.dealerMonthlyNet, empty: c.empty,
        })
      }).catch(() => {})
    }, 250)
    return () => clearTimeout(t)
  }, [inputs, viewAsDealer])

  // Persist deal counts back to the opportunity, debounced (skips first render).
  const onPersistRef = useRef(onPersist)
  useEffect(() => { onPersistRef.current = onPersist }, [onPersist])
  const persistedFirst = useRef(false)
  useEffect(() => {
    if (!onPersistRef.current) return
    if (!persistedFirst.current) { persistedFirst.current = true; return }
    const t = setTimeout(() => {
      const pt = passthru.current
      // entry points ride the `doors` slot; cameras ride `camMon` — same columns
      // the opportunity already stores, so nothing downstream changes.
      onPersistRef.current?.({ livingUnits, doors: entryPoints, camMon: cameras, unitsApp: pt.unitsApp, unitsGw: pt.unitsGw, camBackup: pt.camBackup, commonLocks: pt.commonLocks })
    }, 600)
    return () => clearTimeout(t)
  }, [livingUnits, entryPoints, cameras])

  const showInternal = canViewInternal && internalView
  const empty = !!calc.empty

  return (
    <div className="space-y-5">
      {canViewInternal && (
        <div className="flex items-center gap-2 rounded-full p-1 text-[12px] font-semibold" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', width: 'fit-content' }}>
          <button type="button" onClick={() => setViewAsDealer(false)} className="rounded-full px-3 py-1.5" style={!viewAsDealer ? { background: 'rgba(0,200,255,0.2)', border: '1px solid rgba(0,200,255,0.5)', color: '#7DE5FF' } : { color: 'rgba(255,255,255,0.6)' }}>Internal (cost + margin)</button>
          <button type="button" onClick={() => setViewAsDealer(true)} className="rounded-full px-3 py-1.5" style={viewAsDealer ? { background: 'rgba(52,211,153,0.2)', border: '1px solid rgba(52,211,153,0.5)', color: '#6ee7b7' } : { color: 'rgba(255,255,255,0.6)' }}>Dealer view (preview)</button>
        </div>
      )}

      {/* Inputs */}
      <div className="rounded-3xl p-4" style={{ background: 'linear-gradient(180deg, rgba(8,18,34,0.7), rgba(3,9,22,0.5))', border: '1px solid rgba(0,200,255,0.16)' }}>
        <div className="mb-1 text-base font-semibold" style={{ color: 'rgba(255,255,255,0.95)' }}>What&apos;s on this site?</div>
        <div className="mb-4 text-[12px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Living units, entry points, and cameras — pricing updates as you go.</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Num label="Living units" value={livingUnits} onChange={setLivingUnits} hint="drives the graduated base rate" />
          <Num label="Entry points" value={entryPoints} onChange={setEntryPoints} hint={`${calc.includedGates ?? 0} included`} />
          <Num label="Cameras" value={cameras} onChange={setCameras} hint={`${calc.includedCameras ?? 0} included`} />
        </div>
        <div className="mt-3">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.62)' }}>Extra cameras are</div>
          <div className="flex items-center gap-2 rounded-full p-1 text-[12px] font-semibold" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', width: 'fit-content' }}>
            <button type="button" onClick={() => setCameraType('new')} className="rounded-full px-3 py-1.5" style={cameraType === 'new' ? { background: 'rgba(0,200,255,0.2)', border: '1px solid rgba(0,200,255,0.5)', color: '#7DE5FF' } : { color: 'rgba(255,255,255,0.6)' }}>New (GG supplies) · $91</button>
            <button type="button" onClick={() => setCameraType('existing')} className="rounded-full px-3 py-1.5" style={cameraType === 'existing' ? { background: 'rgba(0,200,255,0.2)', border: '1px solid rgba(0,200,255,0.5)', color: '#7DE5FF' } : { color: 'rgba(255,255,255,0.6)' }}>Existing (monitor) · $85</button>
          </div>
        </div>
      </div>

      {/* Add-on stack */}
      {!empty && ((calc.extraGates ?? 0) > 0 || (calc.extraCameras ?? 0) > 0) && (
        <div className="rounded-2xl p-4" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.5)' }}>Add-ons over the included allotment</div>
          <div className="space-y-1.5">
            {(calc.extraGates ?? 0) > 0 && <Line label={`Extra entry points · ${calc.extraGates} × ${usd0(calc.gatePrice ?? 155)}`} value={usd0((calc.extraGates ?? 0) * (calc.gatePrice ?? 155))} />}
            {(calc.extraCameras ?? 0) > 0 && <Line label={`Extra cameras · ${calc.extraCameras} × ${usd0(calc.cameraPrice ?? 91)}`} value={usd0((calc.extraCameras ?? 0) * (calc.cameraPrice ?? 91))} />}
          </div>
        </div>
      )}

      {/* Customer price */}
      <div className="rounded-3xl p-5" style={{ background: 'linear-gradient(180deg, rgba(0,200,255,0.08), rgba(8,18,34,0.6))', border: '1px solid rgba(0,200,255,0.28)' }}>
        <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: '#7DE5FF' }}>What the customer pays / month</div>
        <div className="mt-1 flex items-baseline gap-2 flex-wrap">
          <span className="text-4xl font-bold" style={{ color: '#7DE5FF' }}>{empty ? '—' : usd0(calc.perUnit ?? 0)}</span>
          <span className="text-[13px]" style={{ color: 'rgba(255,255,255,0.6)' }}>per unit</span>
          {!empty && <span className="text-[15px] font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>= {usd0(calc.customerMonthly ?? 0)} / mo</span>}
        </div>
        {!empty && calc.atFloor && <div className="mt-1 text-[11px]" style={{ color: '#fde68a' }}>At the Gate Guard minimum for a site this size.</div>}
      </div>

      {/* Money distribution */}
      <div className="rounded-3xl p-5" style={{ background: 'linear-gradient(180deg, rgba(52,211,153,0.08), rgba(8,18,34,0.6))', border: '1px solid rgba(52,211,153,0.28)' }}>
        <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: '#6ee7b7' }}>Where the money goes / month</div>
        {empty ? (
          <div className="mt-2 text-[12px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Enter a site above to see the split.</div>
        ) : (
          <div className="mt-3 space-y-1.5 rounded-2xl p-3" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <Line label="Dealer" value={usd(calc.dealerCut ?? 0)} strong />
            <Line label="Sales rep" value={usd(calc.salesCut ?? 0)} />
            <Line label="Distribution" value={usd(calc.distCut ?? 0)} />
            {showInternal && <>
              <Line label="Gate Guard (net)" value={usd(calc.ggNet ?? 0)} />
              <Line label="Gate Guard cost" value={`(${usd(calc.ggCost ?? 0)})`} />
              <div className="mt-1 border-t pt-1.5" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                <Line label="Reconciles to billed" value={usd0(calc.customerMonthly ?? 0)} strong />
              </div>
            </>}
          </div>
        )}
        {showInternal && !empty && (calc.units ?? 0) > 0 && (
          <div className="mt-2 text-right text-[12px]" style={{ color: (calc.marginPerUnit ?? 0) >= 1 ? '#6ee7b7' : '#fca5a5' }}>{usd(calc.marginPerUnit ?? 0)}/unit GG margin</div>
        )}
      </div>

      <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
        {showInternal
          ? <>Graduated base ($10/$7/$5/$3 per unit), {calc.includedGates ?? 0} gates + {calc.includedCameras ?? 0} cameras included, add-ons over that, split 50/30/10/10 with a $350 Gate Guard floor. Cost model computed server-side.</>
          : <>Customer price rounds down to the dollar. Dealer/sales/distribution are the monthly cuts of the billed total.</>}
      </div>
    </div>
  )
}
