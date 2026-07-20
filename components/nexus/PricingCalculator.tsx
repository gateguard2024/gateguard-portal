'use client'

// Gate Guard MONTHLY RECURRING calculator — model "v16" (rough calculator).
// Revenue = graduated per-unit tiers + included allotment + add-ons, floored.
// Distribution = flat per-unit caps: dealer $3, sales $1, distribution $1 / unit.
// Cost = the real recurring cost sheet. GG cost + net are computed SERVER-SIDE
// (/api/pricing/compute → lib/pricing-model.ts) and shown only to corporate.
// A one-time / install-fee section is coming as a separate block.
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

// A distribution / cost line: label · per-unit · total.
function Row({ label, total, units, strong, cap }: { label: string; total: number; units: number; strong?: boolean; cap?: string }) {
  const pu = units > 0 ? total / units : 0
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-1 text-[12px]">
      <span style={{ color: strong ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.7)', fontWeight: strong ? 600 : 400 }}>{label}{cap ? <span className="ml-1.5 text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>≤ {cap}</span> : null}</span>
      <span className="w-16 text-right" style={{ color: 'rgba(255,255,255,0.5)' }}>{usd(pu)}</span>
      <span className="w-20 text-right" style={{ color: 'rgba(255,255,255,0.92)', fontWeight: strong ? 600 : 400 }}>{usd(total)}</span>
    </div>
  )
}

export function PricingCalculator({ initialUnits, initialDoors, initialCameras, initialCommonLocks, initialUnitsApp, initialUnitsGw, initialCamBackup, onCompute, onPersist }: { initialUnits?: number | string | null; initialUnitAutomation?: boolean; initialDoors?: number | string | null; initialCommonLocks?: number | string | null; initialCameras?: number | string | null; initialCamBackup?: number | string | null; initialUnitsApp?: number | string | null; initialUnitsGw?: number | string | null; onCompute?: (c: { units: number; ggFee: number; ggCost: number; suggestedRetail: number; commission: number; dealerMonthlyNet: number; empty: boolean }) => void; onPersist?: (v: { livingUnits: string; unitsApp: string; unitsGw: string; camBackup: string; camMon: string; doors: string; commonLocks: string }) => void } = {}) {
  const seed = (v: number | string | null | undefined) => (v != null && v !== '' && Number(v) > 0 ? String(v) : '')
  const [livingUnits, setLivingUnits] = useState(seed(initialUnits))
  const [entryPoints, setEntryPoints] = useState(seed(initialDoors))
  const [cameras, setCameras] = useState(seed(initialCameras))
  const [cameraType, setCameraType] = useState<'new' | 'existing'>('new')
  const [smartLocks, setSmartLocks] = useState(seed(initialCommonLocks))
  const [cellular, setCellular] = useState('')
  const [dealerMaintains, setDealerMaintains] = useState(true)
  const passthru = useRef({ unitsApp: seed(initialUnitsApp), unitsGw: seed(initialUnitsGw), camBackup: seed(initialCamBackup) })

  const [viewAsDealer, setViewAsDealer] = useState(false)
  const [canViewInternal, setCanViewInternal] = useState(false)
  const [internalView, setInternalView] = useState(false)
  const [calc, setCalc] = useState<Result>({ empty: true, noUnits: true })

  const inputs = useMemo(() => ({ livingUnits, entryPoints, cameras, cameraType, smartLockUnits: smartLocks, cellular, dealerMaintainsEntry: dealerMaintains }), [livingUnits, entryPoints, cameras, cameraType, smartLocks, cellular, dealerMaintains])

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

  const onPersistRef = useRef(onPersist)
  useEffect(() => { onPersistRef.current = onPersist }, [onPersist])
  const persistedFirst = useRef(false)
  useEffect(() => {
    if (!onPersistRef.current) return
    if (!persistedFirst.current) { persistedFirst.current = true; return }
    const t = setTimeout(() => {
      const pt = passthru.current
      onPersistRef.current?.({ livingUnits, doors: entryPoints, camMon: cameras, commonLocks: smartLocks, unitsApp: pt.unitsApp, unitsGw: pt.unitsGw, camBackup: pt.camBackup })
    }, 600)
    return () => clearTimeout(t)
  }, [livingUnits, entryPoints, cameras, smartLocks])

  const showInternal = canViewInternal && internalView
  const empty = !!calc.empty
  const units = calc.units ?? 0

  return (
    <div className="space-y-5">
      {canViewInternal && (
        <div className="flex items-center gap-2 rounded-full p-1 text-[12px] font-semibold" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', width: 'fit-content' }}>
          <button type="button" onClick={() => setViewAsDealer(false)} className="rounded-full px-3 py-1.5" style={!viewAsDealer ? { background: 'rgba(0,200,255,0.2)', border: '1px solid rgba(0,200,255,0.5)', color: '#7DE5FF' } : { color: 'rgba(255,255,255,0.6)' }}>Internal (cost + margin)</button>
          <button type="button" onClick={() => setViewAsDealer(true)} className="rounded-full px-3 py-1.5" style={viewAsDealer ? { background: 'rgba(52,211,153,0.2)', border: '1px solid rgba(52,211,153,0.5)', color: '#6ee7b7' } : { color: 'rgba(255,255,255,0.6)' }}>Dealer view</button>
        </div>
      )}

      {/* Inputs */}
      <div className="rounded-3xl p-4" style={{ background: 'linear-gradient(180deg, rgba(8,18,34,0.7), rgba(3,9,22,0.5))', border: '1px solid rgba(0,200,255,0.16)' }}>
        <div className="mb-1 text-base font-semibold" style={{ color: 'rgba(255,255,255,0.95)' }}>What&apos;s on this site?</div>
        <div className="mb-4 text-[12px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Monthly recurring — pricing updates as you go.</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Num label="Living units" value={livingUnits} onChange={setLivingUnits} hint="drives the graduated base rate" />
          <Num label="Entry points" value={entryPoints} onChange={setEntryPoints} hint={`${calc.includedGates ?? 0} included`} />
          <Num label="Cameras" value={cameras} onChange={setCameras} hint={`${calc.includedCameras ?? 0} included`} />
          <Num label="Smart-lock units" value={smartLocks} onChange={setSmartLocks} hint="per unit" />
          <Num label="Cellular (IOT)" value={cellular} onChange={setCellular} hint="cellular connections" />
        </div>
        <div className="mt-3">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.62)' }}>Extra cameras are</div>
          <div className="flex items-center gap-2 rounded-full p-1 text-[12px] font-semibold" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', width: 'fit-content' }}>
            <button type="button" onClick={() => setCameraType('new')} className="rounded-full px-3 py-1.5" style={cameraType === 'new' ? { background: 'rgba(0,200,255,0.2)', border: '1px solid rgba(0,200,255,0.5)', color: '#7DE5FF' } : { color: 'rgba(255,255,255,0.6)' }}>New · $91</button>
            <button type="button" onClick={() => setCameraType('existing')} className="rounded-full px-3 py-1.5" style={cameraType === 'existing' ? { background: 'rgba(0,200,255,0.2)', border: '1px solid rgba(0,200,255,0.5)', color: '#7DE5FF' } : { color: 'rgba(255,255,255,0.6)' }}>Existing · $85</button>
          </div>
        </div>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-[12px]" style={{ color: 'rgba(255,255,255,0.7)' }}>
          <input type="checkbox" checked={dealerMaintains} onChange={e => setDealerMaintains(e.target.checked)} className="h-4 w-4" />
          Dealer maintains the entry points <span style={{ color: 'rgba(255,255,255,0.4)' }}>— guarantees ≥ $150 / gate / mo</span>
        </label>
      </div>

      {/* Customer price */}
      <div className="rounded-3xl p-5" style={{ background: 'linear-gradient(180deg, rgba(0,200,255,0.08), rgba(8,18,34,0.6))', border: '1px solid rgba(0,200,255,0.28)' }}>
        <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: '#7DE5FF' }}>Customer pays / month</div>
        <div className="mt-1 flex items-baseline gap-2 flex-wrap">
          <span className="text-4xl font-bold" style={{ color: '#7DE5FF' }}>{empty ? '—' : usd0(calc.perUnit ?? 0)}</span>
          <span className="text-[13px]" style={{ color: 'rgba(255,255,255,0.6)' }}>per unit</span>
          {!empty && <span className="text-[15px] font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>= {usd0(calc.customerMonthly ?? 0)} / mo</span>}
        </div>
        {!empty && calc.atFloor && <div className="mt-1 text-[11px]" style={{ color: '#fde68a' }}>At the Gate Guard minimum for a site this size.</div>}
      </div>

      {/* Distribution */}
      <div className="rounded-3xl p-5" style={{ background: 'linear-gradient(180deg, rgba(52,211,153,0.08), rgba(8,18,34,0.6))', border: '1px solid rgba(52,211,153,0.28)' }}>
        <div className="flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: '#6ee7b7' }}>Where the money goes / month</div>
          <div className="hidden grid-cols-[auto_auto] gap-3 text-[9px] font-bold uppercase tracking-wider sm:grid" style={{ color: 'rgba(255,255,255,0.35)' }}><span className="w-16 text-right">/ unit</span><span className="w-20 text-right">total</span></div>
        </div>
        {empty ? (
          <div className="mt-2 text-[12px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Enter a site above to see the split.</div>
        ) : (
          <div className="mt-2 rounded-2xl p-3" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <Row label="Dealer" total={calc.dealerCut ?? 0} units={units} strong cap={calc.dealerFloorBinds ? `${usd(calc.dealerEntryFloorRate ?? 150)}/gate × ${calc.entryPoints}` : `${usd(calc.dealerPerUnit ?? 3)}/unit`} />
            <Row label="Sales rep" total={calc.salesCut ?? 0} units={units} cap={usd(calc.salesPerUnit ?? 1) + '/unit'} />
            <Row label="Distribution" total={calc.distCut ?? 0} units={units} cap={usd(calc.distPerUnit ?? 1) + '/unit'} />
            {showInternal && <>
              <Row label="Gate Guard cost" total={calc.ggCost ?? 0} units={units} />
              <div className="my-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
              <Row label="Gate Guard net" total={calc.ggNet ?? 0} units={units} strong />
            </>}
          </div>
        )}
      </div>

      {/* Cost breakdown — corporate only */}
      {showInternal && !empty && (
        <div className="rounded-3xl p-5" style={{ background: 'radial-gradient(circle at 14% 0%, rgba(0,124,255,0.16), transparent 40%), linear-gradient(180deg, rgba(8,18,34,0.82), rgba(3,9,22,0.6))', border: '1px solid rgba(0,200,255,0.28)' }}>
        <div className="flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: 'rgba(0,200,255,0.85)' }}>Gate Guard recurring cost · real sheet</div>
          <div className="hidden grid-cols-[auto_auto] gap-3 text-[9px] font-bold uppercase tracking-wider sm:grid" style={{ color: 'rgba(255,255,255,0.35)' }}><span className="w-16 text-right">/ unit</span><span className="w-20 text-right">total</span></div>
        </div>
        <div className="mt-2 rounded-2xl p-3" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {(calc.costBrivo ?? 0) > 0 && <Row label="Brivo site fee" total={calc.costBrivo} units={units} />}
          {(calc.costEntry ?? 0) > 0 && <Row label={`${calc.entryPoints} entry points (tiered)`} total={calc.costEntry} units={units} />}
          {(calc.costSmartLock ?? 0) > 0 && <Row label={`${calc.smartLockUnits} smart locks`} total={calc.costSmartLock} units={units} />}
          {(calc.costNvr ?? 0) > 0 && <Row label="Eagle Eye NVR" total={calc.costNvr} units={units} />}
          {(calc.costCameras ?? 0) > 0 && <Row label={`${calc.cameras} cameras × ${usd0(calc.perCameraCost ?? 44)}`} total={calc.costCameras} units={units} />}
          {(calc.costCellular ?? 0) > 0 && <Row label={`${calc.cellular} cellular`} total={calc.costCellular} units={units} />}
          <div className="my-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
          <Row label="Total cost" total={calc.ggCost ?? 0} units={units} strong />
        </div>
        </div>
      )}

      <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
        {showInternal
          ? <>Distribution is capped per unit — dealer $3, sales $1, distribution $1. Gate Guard keeps the rest after the real recurring cost. One-time install fees are a separate section (coming).</>
          : <>Monthly recurring. Dealer/sales/distribution are the per-unit commissions on the billed total.</>}
      </div>
    </div>
  )
}
