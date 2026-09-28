'use client'

/**
 * RoiCalculator — partnership deal-profitability tool (replaces the rough calculator
 * on the Sales page). Ports the Vinnings ROI spreadsheet: enter the site scope +
 * partnership terms, see start-up profit, monthly profit, ROI months, and PASS/FAIL.
 *
 * Rendered in the new light "rich hybrid" coloring. COGS / profit / ROI come from
 * the server (/api/roi/compute) and only render for corporate; others see deal sizing.
 */
import { useEffect, useMemo, useState } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Result = Record<string, any>
type Line = { label: string; amount: number }

const INK = '#17293e', MUT = '#5a708c', CYAN = '#2f7fb8', GREEN = '#12855f', RED = '#c0392b'
const usd = (v: number) => '$' + Math.round(Number(v) || 0).toLocaleString()

const cardS: React.CSSProperties = { background: '#fff', border: '1px solid rgba(70,100,140,0.16)', borderRadius: 12, padding: 14, boxShadow: '0 1px 3px rgba(20,40,80,0.06), 0 8px 22px rgba(20,40,80,0.06)' }
const lblS: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: MUT }
const secS: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: CYAN, margin: '2px 0 8px' }
const stepBtn: React.CSSProperties = { width: 28, height: 32, borderRadius: 8, border: '1px solid rgba(70,100,140,0.25)', background: '#eef4fb', color: CYAN, fontSize: 17, fontWeight: 700, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }
const inS: React.CSSProperties = { width: '100%', padding: '7px 9px', borderRadius: 8, background: '#f7fafd', border: '1px solid rgba(70,100,140,0.22)', color: INK, fontSize: 13, textAlign: 'center' }

function Stepper({ label, value, onChange, step = 1, prefix }: { label: string; value: number; onChange: (v: number) => void; step?: number; prefix?: string }) {
  const v = value || 0
  return (
    <div>
      <div style={lblS}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
        <button type="button" onClick={() => onChange(Math.max(0, v - step))} style={stepBtn}>−</button>
        <div style={{ position: 'relative', flex: 1 }}>
          {prefix && <span style={{ position: 'absolute', left: 7, top: 8, color: MUT, fontSize: 12 }}>{prefix}</span>}
          <input type="number" min={0} value={v} onChange={e => onChange(Math.max(0, Number(e.target.value) || 0))} style={{ ...inS, paddingLeft: prefix ? 16 : 9 }} />
        </div>
        <button type="button" onClick={() => onChange(v + step)} style={stepBtn}>+</button>
      </div>
    </div>
  )
}

function StatCard({ label, value, tone, sub }: { label: string; value: string; tone?: 'good' | 'bad' | 'neutral'; sub?: string }) {
  const color = tone === 'good' ? GREEN : tone === 'bad' ? RED : INK
  return (
    <div style={{ ...cardS, padding: '12px 14px' }}>
      <div style={lblS}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: MUT, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function Breakdown({ title, lines, total }: { title: string; lines: Line[]; total: number }) {
  if (!lines?.length) return null
  return (
    <div style={{ ...cardS, padding: '12px 14px' }}>
      <div style={secS}>{title}</div>
      {lines.map((l, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '3px 0', color: INK }}>
          <span style={{ color: MUT }}>{l.label}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{usd(l.amount)}</span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 800, padding: '6px 0 0', marginTop: 4, borderTop: '1px solid rgba(70,100,140,0.14)', color: INK }}>
        <span>Total</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{usd(total)}</span>
      </div>
    </div>
  )
}

type Inputs = {
  units: number; termMonths: number; setupFee: number; monthlyPA: number; dealerPerPoint: number
  salesRepPerUnit: number; msoPerUnit: number; packagePerUnit: number
  workingVehGates: number; nonWorkingVehGates: number; workingPedGates: number; nonWorkingPedGates: number
  workingAccessDoors: number; nonWorkingAccessDoors: number; exitGates: number
  existingCameras: number; newCameras: number; conversionCameras: number; monitoredCameras: number; recorders: number
  securityPanel: number; securityDoors: number; additionalDoors: number; additionalMotions: number; cell: number
}
const SEED: Inputs = {
  units: 0, termMonths: 60, setupFee: 5000, monthlyPA: 125, dealerPerPoint: 100,
  salesRepPerUnit: 0, msoPerUnit: 0, packagePerUnit: 0,
  workingVehGates: 0, nonWorkingVehGates: 0, workingPedGates: 0, nonWorkingPedGates: 0,
  workingAccessDoors: 0, nonWorkingAccessDoors: 0, exitGates: 0,
  existingCameras: 0, newCameras: 0, conversionCameras: 0, monitoredCameras: 0, recorders: 0,
  securityPanel: 0, securityDoors: 0, additionalDoors: 0, additionalMotions: 0, cell: 0,
}

export function RoiCalculator() {
  const [inp, setInp] = useState<Inputs>(SEED)
  const [data, setData] = useState<{ result: Result; corporate: boolean } | null>(null)
  const set = (k: keyof Inputs, v: number) => setInp(p => ({ ...p, [k]: v }))
  const key = useMemo(() => JSON.stringify(inp), [inp])

  useEffect(() => {
    const t = setTimeout(() => {
      fetch('/api/roi/compute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: key })
        .then(r => r.json()).then(j => { if (j?.result) setData({ result: j.result, corporate: !!j.corporate }) })
        .catch(() => {})
    }, 250)
    return () => clearTimeout(t)
  }, [key])

  const r = data?.result
  const corp = data?.corporate

  return (
    <div style={{ background: 'linear-gradient(140deg,#E7EDF6,#DCE5F1)', borderRadius: 14, padding: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,340px) 1fr', gap: 14, alignItems: 'start' }}>

        {/* Inputs */}
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={cardS}>
            <div style={secS}>Site & terms</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Stepper label="Units" value={inp.units} onChange={v => set('units', v)} step={10} />
              <Stepper label="Term (months)" value={inp.termMonths} onChange={v => set('termMonths', v)} step={12} />
              <Stepper label="Set-up fee" value={inp.setupFee} onChange={v => set('setupFee', v)} step={500} prefix="$" />
              <Stepper label="Monthly P&A / unit" value={inp.monthlyPA} onChange={v => set('monthlyPA', v)} step={5} prefix="$" />
            </div>
          </div>

          <div style={cardS}>
            <div style={secS}>Gates & doors</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Stepper label="Veh gates — working" value={inp.workingVehGates} onChange={v => set('workingVehGates', v)} />
              <Stepper label="Veh gates — repair" value={inp.nonWorkingVehGates} onChange={v => set('nonWorkingVehGates', v)} />
              <Stepper label="Ped gates — working" value={inp.workingPedGates} onChange={v => set('workingPedGates', v)} />
              <Stepper label="Ped gates — repair" value={inp.nonWorkingPedGates} onChange={v => set('nonWorkingPedGates', v)} />
              <Stepper label="Access doors — working" value={inp.workingAccessDoors} onChange={v => set('workingAccessDoors', v)} />
              <Stepper label="Access doors — repair" value={inp.nonWorkingAccessDoors} onChange={v => set('nonWorkingAccessDoors', v)} />
              <Stepper label="Exit gates" value={inp.exitGates} onChange={v => set('exitGates', v)} />
            </div>
          </div>

          <div style={cardS}>
            <div style={secS}>Cameras</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Stepper label="Existing" value={inp.existingCameras} onChange={v => set('existingCameras', v)} />
              <Stepper label="New" value={inp.newCameras} onChange={v => set('newCameras', v)} />
              <Stepper label="Conversion" value={inp.conversionCameras} onChange={v => set('conversionCameras', v)} />
              <Stepper label="Monitored" value={inp.monitoredCameras} onChange={v => set('monitoredCameras', v)} />
              <Stepper label="Recorders" value={inp.recorders} onChange={v => set('recorders', v)} />
            </div>
          </div>

          <div style={cardS}>
            <div style={secS}>Security</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Stepper label="Panel" value={inp.securityPanel} onChange={v => set('securityPanel', v)} />
              <Stepper label="Doors" value={inp.securityDoors} onChange={v => set('securityDoors', v)} />
              <Stepper label="Additional doors" value={inp.additionalDoors} onChange={v => set('additionalDoors', v)} />
              <Stepper label="Motions" value={inp.additionalMotions} onChange={v => set('additionalMotions', v)} />
              <Stepper label="Cell" value={inp.cell} onChange={v => set('cell', v)} />
            </div>
          </div>

          <div style={cardS}>
            <div style={secS}>Payouts → added to P&A ($ / unit / mo)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Stepper label="Sales rep" value={inp.salesRepPerUnit} onChange={v => set('salesRepPerUnit', v)} prefix="$" />
              <Stepper label="MSO" value={inp.msoPerUnit} onChange={v => set('msoPerUnit', v)} prefix="$" />
              <Stepper label="Package room" value={inp.packagePerUnit} onChange={v => set('packagePerUnit', v)} prefix="$" />
            </div>
            {r && r.paAdditionsPerUnitYr > 0 && (
              <div style={{ fontSize: 11, color: MUT, marginTop: 6 }}>× 12 → <b style={{ color: INK }}>+{usd(r.paAdditionsPerUnitYr)}/unit/yr</b> added to the resident P&A</div>
            )}
          </div>
        </div>

        {/* Results */}
        <div style={{ display: 'grid', gap: 12 }}>
          {!r ? <div style={{ ...cardS, color: MUT, fontSize: 13 }}>Enter a site to model the deal.</div> : (<>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
              <StatCard label="Units" value={String(r.units)} />
              <StatCard label="Openings" value={String(r.openings)} sub={`${r.points} access points`} />
              <StatCard label="Set-up fee" value={usd(r.setupFee)} />
              <StatCard label="Resident P&A / unit / yr" value={usd(r.residentPaTotal ?? r.monthlyPA)} tone="good" sub={r.paAdditionsPerUnitYr > 0 ? `${usd(r.monthlyPA)} base + ${usd(r.paAdditionsPerUnitYr)} add-ons` : 'base P&A'} />
              <StatCard label="Annual resident rev" value={usd(r.annualResidentRevenue)} sub={`${r.units} units × P&A`} />
            </div>

            {corp ? (<>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
                <StatCard label="Start-up profit" value={usd(r.startupProfit)} tone={r.startupProfit >= 0 ? 'good' : 'bad'} sub={`set-up − ${usd(r.startupCogs)} install`} />
                <StatCard label="Monthly profit" value={usd(r.monthlyProfit)} tone={r.monthlyProfit >= 0 ? 'good' : 'bad'} />
                <StatCard label="Annual profit" value={usd(r.annualProfit)} tone={r.annualProfit >= 0 ? 'good' : 'bad'} />
                <StatCard label="ROI months" value={r.roiMonths === null || !isFinite(r.roiMonths) ? '∞' : String(r.roiMonths)} sub={r.startupProfit >= 0 ? 'profitable at signing' : undefined} />
              </div>
              <div style={{ ...cardS, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: r.pass ? 'rgba(18,133,95,0.08)' : 'rgba(192,57,43,0.08)', borderColor: r.pass ? 'rgba(18,133,95,0.35)' : 'rgba(192,57,43,0.35)' }}>
                <div style={{ fontSize: 13, color: MUT }}>Viability — ROI recovered within 4 months</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: r.pass ? GREEN : RED }}>{r.pass ? 'PASS' : 'FAIL'}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
                <Breakdown title="Install cost (one-time)" lines={r.startupBreakdown} total={r.startupCogs} />
                <Breakdown title="Monthly cost" lines={r.monthlyBreakdown} total={r.monthlyCogs} />
                <Breakdown title="Monthly payroll" lines={r.payrollBreakdown} total={r.payroll} />
              </div>
            </>) : (
              <div style={{ ...cardS, fontSize: 12.5, color: MUT }}>Profitability and cost figures are visible to GateGuard corporate only.</div>
            )}
          </>)}
        </div>
      </div>
    </div>
  )
}

export default RoiCalculator
