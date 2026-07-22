'use client'

// Gate Guard MONTHLY calculator — v2 (rough calculator), slider UI matching the
// design widget. Cost sheet + distributor cut + GG net are computed SERVER-SIDE.
// Corporate sees the full split; master-dealer-and-below see only Dealer, Sales
// rep, and one combined Gate Guard line. One-time install is a separate tab.
import { useEffect, useMemo, useRef, useState } from 'react'
import { InstallCalculator } from '@/components/nexus/InstallCalculator'

const usd = (n: number) => (Number(n) || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
const usd0 = (n: number) => (Number(n) || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Result = Record<string, any>
type Smart = 'none' | 'lock' | 'full'
type Cell = 'none' | 'relay' | 'full'
type GgNet = 'double' | 'min2'

const card = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '14px 16px' } as const
const tagS = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', opacity: .55 } as const

function Slider({ label, hint, value, min, max, step, onChange }: { label: string; hint?: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
        <span style={{ color: 'rgba(255,255,255,0.82)' }}>{label}{hint ? <span style={{ ...tagS, marginLeft: 6 }}>{hint}</span> : null}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 800, color: '#6B7EFF' }}>{value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)} style={{ width: '100%', accentColor: '#6B7EFF' }} />
    </div>
  )
}

function Seg<T extends string>({ options, value, onChange }: { options: { v: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      {options.map(o => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)}
          style={{ flex: 1, minWidth: 54, padding: '6px', borderRadius: 9, fontSize: 11, fontWeight: 600, cursor: 'pointer', ...(value === o.v ? { background: '#6B7EFF', border: '1px solid #6B7EFF', color: '#fff' } : { background: 'transparent', border: '1px solid rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.6)' }) }}>{o.label}</button>
      ))}
    </div>
  )
}

function Row({ label, total, units, strong }: { label: string; total: number; units: number; strong?: boolean }) {
  const pu = units > 0 ? total / units : 0
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: '1px solid rgba(255,255,255,0.08)', fontVariantNumeric: 'tabular-nums' }}>
      <span style={{ opacity: strong ? 1 : .82, fontWeight: strong ? 800 : 400 }}>{label}</span>
      <span style={{ display: 'flex', gap: 14 }}>
        <span style={{ width: 62, textAlign: 'right', opacity: .5 }}>{usd(pu)}</span>
        <span style={{ width: 78, textAlign: 'right', fontWeight: strong ? 800 : 400 }}>{usd(total)}</span>
      </span>
    </div>
  )
}

export function PricingCalculator({ initialUnits, initialDoors, initialCameras, initialUnitsApp, initialUnitsGw, initialCamBackup, onCompute, onPersist }: { initialUnits?: number | string | null; initialUnitAutomation?: boolean; initialDoors?: number | string | null; initialCommonLocks?: number | string | null; initialCameras?: number | string | null; initialCamBackup?: number | string | null; initialUnitsApp?: number | string | null; initialUnitsGw?: number | string | null; onCompute?: (c: { units: number; ggFee: number; ggCost: number; suggestedRetail: number; commission: number; dealerMonthlyNet: number; empty: boolean }) => void; onPersist?: (v: { livingUnits: string; unitsApp: string; unitsGw: string; camBackup: string; camMon: string; doors: string; commonLocks: string }) => void } = {}) {
  const seedN = (v: number | string | null | undefined) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n) : 0 }
  const [units, setUnits] = useState(seedN(initialUnits))
  const [ep, setEp] = useState(seedN(initialDoors))
  const [camMon, setCamMon] = useState(seedN(initialCameras))
  const [camNon, setCamNon] = useState(0)
  const [smartPkg, setSmartPkg] = useState<Smart>('none')
  const [cellular, setCellular] = useState<Cell>('none')
  const [dealerMaintains, setDealerMaintains] = useState(true)
  const [ggNetModel, setGgNetModel] = useState<GgNet>('min2')
  const [tab, setTab] = useState<'monthly' | 'install'>('monthly')
  const passthru = useRef({ unitsApp: seedN(initialUnitsApp), unitsGw: seedN(initialUnitsGw), camBackup: seedN(initialCamBackup) })

  const [viewAsDealer, setViewAsDealer] = useState(false)
  const [canViewInternal, setCanViewInternal] = useState(false)
  const [internalView, setInternalView] = useState(false)
  const [calc, setCalc] = useState<Result>({ empty: true })

  const inputs = useMemo(() => ({
    livingUnits: units, entryPoints: ep, camerasMonitored: camMon, camerasNonMonitored: camNon,
    smartPackage: smartPkg, cellular, dealerMaintainsEntry: dealerMaintains, ggNetModel,
  }), [units, ep, camMon, camNon, smartPkg, cellular, dealerMaintains, ggNetModel])

  const onComputeRef = useRef(onCompute)
  useEffect(() => { onComputeRef.current = onCompute }, [onCompute])
  useEffect(() => {
    const t = setTimeout(() => {
      void fetch('/api/pricing/compute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...inputs, viewAsDealer }),
      }).then(r => r.json()).then(j => {
        if (!j || !j.result) return
        setCalc(j.result); setCanViewInternal(!!j.canViewInternal); setInternalView(!!j.internalView)
        const c = j.result
        onComputeRef.current?.({
          units: c.livingUnits ?? 0, ggFee: c.ggNet ?? 0, ggCost: c.ggCost ?? 0,
          suggestedRetail: c.customerMonthly ?? 0, commission: c.salesCut ?? 0,
          dealerMonthlyNet: c.dealerCut ?? 0, empty: !!c.empty,
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
      onPersistRef.current?.({ livingUnits: String(units), doors: String(ep), camMon: String(camMon), commonLocks: '', unitsApp: String(pt.unitsApp), unitsGw: String(pt.unitsGw), camBackup: String(pt.camBackup) })
    }, 600)
    return () => clearTimeout(t)
  }, [units, ep, camMon])

  const showInternal = canViewInternal && internalView
  const empty = !!calc.empty
  const u = calc.livingUnits ?? 0
  const scale = calc.scale ?? 1
  const pill = { display: 'inline-block', fontSize: 11, fontWeight: 800, color: '#6B7EFF', background: 'rgba(107,126,255,.14)', borderRadius: 8, padding: '1px 7px', marginLeft: 6 } as const

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-full p-1 text-[12px] font-semibold" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', width: 'fit-content' }}>
        <button type="button" onClick={() => setTab('monthly')} className="rounded-full px-3.5 py-1.5" style={tab === 'monthly' ? { background: 'rgba(107,126,255,0.25)', border: '1px solid rgba(107,126,255,0.5)', color: '#c7d0ff' } : { color: 'rgba(255,255,255,0.6)' }}>Monthly recurring</button>
        <button type="button" onClick={() => setTab('install')} className="rounded-full px-3.5 py-1.5" style={tab === 'install' ? { background: 'rgba(107,126,255,0.25)', border: '1px solid rgba(107,126,255,0.5)', color: '#c7d0ff' } : { color: 'rgba(255,255,255,0.6)' }}>One-time install</button>
      </div>

      {tab === 'install' ? (
        <InstallCalculator initialWorkingGates={ep || undefined} initialCameras={(camMon + camNon) || undefined} />
      ) : (<>
      {/* Inputs — two-column card like the widget */}
      <div style={card}>
        <div className="grid grid-cols-1 gap-x-5 sm:grid-cols-2">
          <div>
            <Slider label="Living units" hint="= smart units" value={units} min={0} max={1000} step={10} onChange={setUnits} />
            <Slider label="Entry points (access)" value={ep} min={0} max={50} step={1} onChange={setEp} />
            <Slider label="Cameras — monitored" value={camMon} min={0} max={50} step={1} onChange={setCamMon} />
            <Slider label="Cameras — non-monitored" value={camNon} min={0} max={50} step={1} onChange={setCamNon} />
          </div>
          <div>
            {canViewInternal && (<div style={{ marginBottom: 10 }}>
              <div style={{ ...tagS, marginBottom: 5 }}>Gate Guard net model</div>
              <Seg<GgNet> options={[{ v: 'min2', label: '$2 / unit' }, { v: 'double', label: '2× expense' }]} value={ggNetModel} onChange={setGgNetModel} />
            </div>)}
            <div style={{ marginBottom: 10 }}><div style={{ ...tagS, marginBottom: 5 }}>Smart package</div>
              <Seg<Smart> options={[{ v: 'none', label: 'None' }, { v: 'lock', label: 'Lock' }, { v: 'full', label: 'Full' }]} value={smartPkg} onChange={setSmartPkg} /></div>
            <div style={{ marginBottom: 10 }}><div style={{ ...tagS, marginBottom: 5 }}>Cellular</div>
              <Seg<Cell> options={[{ v: 'none', label: 'None' }, { v: 'relay', label: 'Relay $6' }, { v: 'full', label: 'Full $60' }]} value={cellular} onChange={setCellular} /></div>
            <label className="flex cursor-pointer items-center gap-2 text-[12px]" style={{ color: 'rgba(255,255,255,0.72)', marginTop: 4 }}>
              <input type="checkbox" checked={dealerMaintains} onChange={e => setDealerMaintains(e.target.checked)} style={{ accentColor: '#6B7EFF', width: 16, height: 16 }} /> Dealer maintains entry points
            </label>
            {canViewInternal && (
              <div className="mt-3 flex items-center gap-2 rounded-full p-1 text-[11px] font-semibold" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', width: 'fit-content' }}>
                <button type="button" onClick={() => setViewAsDealer(false)} className="rounded-full px-3 py-1" style={!viewAsDealer ? { background: 'rgba(0,200,255,0.2)', border: '1px solid rgba(0,200,255,0.5)', color: '#7DE5FF' } : { color: 'rgba(255,255,255,0.6)' }}>Internal</button>
                <button type="button" onClick={() => setViewAsDealer(true)} className="rounded-full px-3 py-1" style={viewAsDealer ? { background: 'rgba(52,211,153,0.2)', border: '1px solid rgba(52,211,153,0.5)', color: '#6ee7b7' } : { color: 'rgba(255,255,255,0.6)' }}>Dealer view</button>
              </div>
            )}
            <div style={{ ...card, marginTop: 10, textAlign: 'center', background: 'rgba(107,126,255,.1)', borderColor: 'rgba(107,126,255,.35)' }}>
              <div style={tagS}>Customer bill / month</div>
              <div style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{empty ? '—' : usd0(calc.customerMonthly ?? 0)}</div>
              <div style={{ fontSize: 12, opacity: .75 }}>{empty ? '' : usd0(calc.perUnit ?? 0) + ' / unit'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Result cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {showInternal && (
          <div style={card}>
            <div style={{ ...tagS, marginBottom: 8 }}>Gate Guard cost · real sheet</div>
            {empty ? <div className="text-[12px]" style={{ opacity: .5 }}>Enter a site.</div> : (<>
              {(calc.costBrivo ?? 0) > 0 && <Row label="Brivo site fee ($90 flat)" total={calc.costBrivo} units={u} />}
              {(calc.costEntry ?? 0) > 0 && <Row label={`${calc.entryPoints} entry points (tiered)`} total={calc.costEntry} units={u} />}
              {(calc.costLarge ?? 0) > 0 && <Row label="Large-site surcharge" total={calc.costLarge} units={u} />}
              {(calc.costCameras ?? 0) > 0 && <Row label={`Cameras (${calc.camerasMonitored ?? 0} mon / ${calc.camerasNonMonitored ?? 0} non)`} total={calc.costCameras} units={u} />}
              {(calc.costCellular ?? 0) > 0 && <Row label="Cellular" total={calc.costCellular} units={u} />}
              {(calc.costSmart ?? 0) > 0 && <Row label={`Smart units${calc.smartMult === 2 ? ' (full ×2)' : ''}`} total={calc.costSmart} units={u} />}
              <Row label="Total Gate Guard cost" total={calc.ggCost ?? 0} units={u} strong />
            </>)}
          </div>
        )}
        <div style={{ ...card, ...(showInternal ? {} : { gridColumn: '1 / -1' }) }}>
          <div style={{ ...tagS, marginBottom: 8 }}>Where the money goes / month {!empty && scale > 1.001 && <span style={pill}>{scale.toFixed(2)}×</span>}</div>
          {empty ? <div className="text-[12px]" style={{ opacity: .5 }}>Enter a site above to see the split.</div> : (<>
            <Row label="Dealer" total={calc.dealerCut ?? 0} units={u} strong />
            <Row label="Sales rep" total={calc.salesCut ?? 0} units={u} />
            {showInternal ? (<>
              <Row label="Distribution" total={calc.distCut ?? 0} units={u} />
              <Row label="Gate Guard cost" total={calc.ggCost ?? 0} units={u} />
              <Row label={`Gate Guard net ${calc.ggNetModel === 'double' ? '(2× cost)' : '($2/unit)'}`} total={calc.ggNet ?? 0} units={u} strong />
            </>) : (
              <Row label="Gate Guard" total={calc.gateGuardCombined ?? 0} units={u} strong />
            )}
            <Row label="Customer bill" total={calc.customerMonthly ?? 0} units={u} strong />
          </>)}
        </div>
      </div>

      <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
        {showInternal
          ? <>GG net {calc.ggNetModel === 'double' ? '= 2× cost (Gate Guard take is 3× the cost line)' : '= $2/unit floor'}. Dealer locked at $150/entry point; sales &amp; distribution scale to hold the ratio.</>
          : <>Monthly recurring. Your dealer payment and the sales-rep commission; Gate Guard covers everything else.</>}
      </div>
      </>)}
    </div>
  )
}
