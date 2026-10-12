'use client'

/**
 * RoiCalculator — partnership deal-profitability tool (Sales page).
 * Elevated-glass shell: inputs LEFT (2-col groups), outputs RIGHT (2/3).
 * Outputs split into two clean sections so dealer logins only see Section 2:
 *   Section 1 — All Numbers & Calculations  (corporate only)
 *   Section 2 — Dealer Numbers & Calculations (always visible)
 * COGS / profit / ROI come from the server (/api/roi/compute); corporate-only
 * figures are gated on `data.corporate`.
 */
import { useEffect, useMemo, useState } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Result = Record<string, any>
type Line = { label: string; amount: number }

const C = { ink: '#eef4fb', ink2: '#9fb0c4', ink3: '#6d7f94', cyan: '#00A3E0', indigo: '#6B7EFF', safe: '#22C55E', warn: '#F59E0B', alert: '#EF4444', gold: '#C7B37A' }
const BRAND = 'linear-gradient(135deg,#19C8F5 0%,#4A8CFF 52%,#6B7EFF 100%)'
const usd = (v: number) => '$' + Math.round(Number(v) || 0).toLocaleString()

const glass: React.CSSProperties = { background: 'linear-gradient(165deg,rgba(255,255,255,0.045),transparent 55%), linear-gradient(180deg,rgba(32,44,66,0.82),rgba(18,26,42,0.78))', border: '1px solid rgba(255,255,255,0.09)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.09), 0 2px 6px rgba(0,0,0,0.25), 0 34px 70px -32px rgba(0,0,0,0.85)' }
const tile: React.CSSProperties = { background: 'rgba(14,21,33,0.5)', border: '1px solid rgba(255,255,255,0.06)' }
const secS: React.CSSProperties = { fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.ink3, display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }

function Ring({ size, pct, color, stroke, children }: { size: number; pct: number; color: string; stroke: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2 - 1, circ = 2 * Math.PI * r, off = circ * (1 - Math.max(0, Math.min(100, pct)) / 100)
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
    </div>
  )
}

function Field({ label, value, onChange, prefix }: { label: string; value: number; onChange: (v: number) => void; prefix?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: C.ink2, marginBottom: 4, fontWeight: 600, lineHeight: 1.25, minHeight: 24, display: 'flex', alignItems: 'flex-end' }}>{label}</div>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {prefix && <span style={{ position: 'absolute', left: 10, fontSize: 12, color: C.ink3 }}>{prefix}</span>}
        <input type="number" min={0} value={value || 0} onChange={e => onChange(Math.max(0, Number(e.target.value) || 0))}
          style={{ width: '100%', background: 'rgba(11,17,28,0.6)', border: '1px solid #273548', borderRadius: 9, color: C.ink, fontSize: 13, fontWeight: 700, padding: prefix ? '8px 9px 8px 18px' : '8px 9px', outline: 'none' }} />
      </div>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ ...glass, borderRadius: 14, padding: '15px 17px' }}>
      <div style={secS}><span style={{ width: 7, height: 7, borderRadius: 999, background: C.cyan }} />{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>{children}</div>
    </div>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' | 'brand' }) {
  const bg = tone === 'good' ? 'rgba(34,197,94,0.08)' : tone === 'brand' ? 'rgba(74,140,255,0.08)' : 'rgba(14,21,33,0.5)'
  const bc = tone === 'good' ? 'rgba(34,197,94,0.22)' : tone === 'brand' ? 'rgba(74,140,255,0.25)' : 'rgba(255,255,255,0.06)'
  const vc = tone === 'good' ? C.safe : tone === 'bad' ? C.alert : C.ink
  return (
    <div style={{ background: bg, border: `1px solid ${bc}`, borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: C.ink2 }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 5, color: vc }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.ink3, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function Breakdown({ title, lines, total }: { title: string; lines: Line[]; total: number }) {
  return (
    <div style={{ ...tile, borderRadius: 12, padding: '13px 15px' }}>
      <div style={secS}><span style={{ width: 7, height: 7, borderRadius: 999, background: C.cyan }} />{title}</div>
      {(lines || []).map((l, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', color: C.ink2 }}>
          <span style={{ paddingRight: 8 }}>{l.label}</span><span style={{ color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{usd(l.amount)}</span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 800, paddingTop: 6, marginTop: 4, borderTop: '1px solid rgba(255,255,255,0.1)', color: C.ink }}>
        <span>Total</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{usd(total)}</span>
      </div>
    </div>
  )
}

type Inputs = {
  units: number; termMonths: number; setupFee: number; additionalDealerInstall: number
  monthlyBulkFee: number; monthlyPA: number; addonDealerFee: number
  salesRepPerUnit: number; packagePerUnit: number; servicingPerUnit: number
  workingVehGates: number; nonWorkingVehGates: number
  workingExitGates: number; nonWorkingExitGates: number
  otherWorking: number; otherNotWorking: number
  existingCameras: number; newCameras: number; conversionCameras: number; monitoredCameras: number; recorders: number
  securityPanel: number; securityDoors: number; additionalDoors: number; additionalMotions: number; cell: number
}
const SEED: Inputs = {
  units: 0, termMonths: 60, setupFee: 5000, additionalDealerInstall: 0,
  monthlyBulkFee: 0, monthlyPA: 125, addonDealerFee: 0,
  salesRepPerUnit: 0, packagePerUnit: 0, servicingPerUnit: 0,
  workingVehGates: 0, nonWorkingVehGates: 0, workingExitGates: 0, nonWorkingExitGates: 0,
  otherWorking: 0, otherNotWorking: 0,
  existingCameras: 0, newCameras: 0, conversionCameras: 0, monitoredCameras: 0, recorders: 0,
  securityPanel: 0, securityDoors: 0, additionalDoors: 0, additionalMotions: 0, cell: 0,
}

export function RoiCalculator() {
  const [inp, setInp] = useState<Inputs>(SEED)
  const [data, setData] = useState<{ result: Result; corporate: boolean } | null>(null)
  const set = (k: keyof Inputs, v: number) => setInp(p => ({ ...p, [k]: v }))

  // Map the UI scope fields onto the model's RoiInputs shape.
  const payload = useMemo(() => ({
    units: inp.units, termMonths: inp.termMonths, setupFee: inp.setupFee,
    additionalDealerInstall: inp.additionalDealerInstall,
    monthlyBulkFee: inp.monthlyBulkFee, monthlyPA: inp.monthlyPA, addonDealerFee: inp.addonDealerFee,
    salesRepPerUnit: inp.salesRepPerUnit, packagePerUnit: inp.packagePerUnit,
    workingVehGates: inp.workingVehGates, nonWorkingVehGates: inp.nonWorkingVehGates,
    exitGates: inp.workingExitGates + inp.nonWorkingExitGates,
    workingAccessDoors: inp.otherWorking, nonWorkingAccessDoors: inp.otherNotWorking,
    existingCameras: inp.existingCameras, newCameras: inp.newCameras, conversionCameras: inp.conversionCameras,
    monitoredCameras: inp.monitoredCameras, recorders: inp.recorders,
    securityPanel: inp.securityPanel, securityDoors: inp.securityDoors,
    additionalDoors: inp.additionalDoors, additionalMotions: inp.additionalMotions, cell: inp.cell,
  }), [inp])
  const key = useMemo(() => JSON.stringify(payload), [payload])

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
  const roiLabel = r ? (r.roiMonths === null || !isFinite(r.roiMonths) ? '∞' : String(r.roiMonths)) : '0'
  const roiPct = r ? (r.pass ? 100 : 30) : 0
  const dealerAnnual = r ? (r.dealerFee || 0) * 12 + (inp.additionalDealerInstall || 0) : 0

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,360px) 1fr', gap: 18, alignItems: 'start' }}>

      {/* LEFT — INPUTS */}
      <div style={{ display: 'grid', gap: 16 }}>
        <Group title="Site & terms">
          <Field label="Units" value={inp.units} onChange={v => set('units', v)} />
          <Field label="Term (months)" value={inp.termMonths} onChange={v => set('termMonths', v)} />
          <Field label="Set-up fee" value={inp.setupFee} onChange={v => set('setupFee', v)} prefix="$" />
          <Field label="Additional dealer install fee" value={inp.additionalDealerInstall} onChange={v => set('additionalDealerInstall', v)} prefix="$" />
          <Field label="Monthly bulk fee / unit" value={inp.monthlyBulkFee} onChange={v => set('monthlyBulkFee', v)} prefix="$" />
          <Field label="Monthly P&A / unit" value={inp.monthlyPA} onChange={v => set('monthlyPA', v)} prefix="$" />
          <Field label="Monthly add-on dealer fee / unit" value={inp.addonDealerFee} onChange={v => set('addonDealerFee', v)} prefix="$" />
        </Group>
        <Group title="Payouts ($ / unit / mo)">
          <Field label="Sales rep" value={inp.salesRepPerUnit} onChange={v => set('salesRepPerUnit', v)} prefix="$" />
          <Field label="Package room" value={inp.packagePerUnit} onChange={v => set('packagePerUnit', v)} prefix="$" />
          <Field label="Servicing partner" value={inp.servicingPerUnit} onChange={v => set('servicingPerUnit', v)} prefix="$" />
        </Group>
        <Group title="Gates & doors">
          <Field label="Veh entry gates — working" value={inp.workingVehGates} onChange={v => set('workingVehGates', v)} />
          <Field label="Veh entry gates — not working" value={inp.nonWorkingVehGates} onChange={v => set('nonWorkingVehGates', v)} />
          <Field label="Veh exit gates — working" value={inp.workingExitGates} onChange={v => set('workingExitGates', v)} />
          <Field label="Veh exit gates — not working" value={inp.nonWorkingExitGates} onChange={v => set('nonWorkingExitGates', v)} />
          <Field label="Other gates/doors — working" value={inp.otherWorking} onChange={v => set('otherWorking', v)} />
          <Field label="Other gates/doors — not working" value={inp.otherNotWorking} onChange={v => set('otherNotWorking', v)} />
        </Group>
        <Group title="Cameras">
          <Field label="Existing" value={inp.existingCameras} onChange={v => set('existingCameras', v)} />
          <Field label="New" value={inp.newCameras} onChange={v => set('newCameras', v)} />
          <Field label="Conversion" value={inp.conversionCameras} onChange={v => set('conversionCameras', v)} />
          <Field label="Monitored" value={inp.monitoredCameras} onChange={v => set('monitoredCameras', v)} />
          <Field label="Recorders (3–16 cams)" value={inp.recorders} onChange={v => set('recorders', v)} />
        </Group>
        <Group title="Security">
          <Field label="Panels" value={inp.securityPanel} onChange={v => set('securityPanel', v)} />
          <Field label="Doors" value={inp.securityDoors} onChange={v => set('securityDoors', v)} />
          <Field label="Additional doors" value={inp.additionalDoors} onChange={v => set('additionalDoors', v)} />
          <Field label="Motions" value={inp.additionalMotions} onChange={v => set('additionalMotions', v)} />
          <Field label="Cell" value={inp.cell} onChange={v => set('cell', v)} />
        </Group>
      </div>

      {/* RIGHT — OUTPUTS */}
      <div style={{ display: 'grid', gap: 16 }}>
        {!r || !inp.units ? (
          <div style={{ ...glass, borderRadius: 18, padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: 260 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: BRAND, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, boxShadow: '0 0 24px rgba(74,140,255,0.35)' }}>
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#041018" strokeWidth="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.ink }}>Model a deal</div>
            <div style={{ fontSize: 12.5, color: C.ink2, marginTop: 6, maxWidth: 320, lineHeight: 1.5 }}>Enter the unit count and site scope on the left. Start-up, monthly profit, payback, and the dealer breakdown update live.</div>
          </div>
        ) : (<>

          {/* Verdict hero (corporate) */}
          {corp && (
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 20, alignItems: 'center', padding: '18px 22px', borderRadius: 18,
              background: `linear-gradient(135deg,${r.pass ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)'},rgba(25,200,245,0.05)), linear-gradient(180deg,rgba(26,36,54,0.82),rgba(15,22,36,0.84))`,
              border: `1px solid ${r.pass ? 'rgba(34,197,94,0.22)' : 'rgba(239,68,68,0.3)'}`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 30px 70px -30px rgba(0,0,0,0.8)' }}>
              <Ring size={104} pct={roiPct} color={r.pass ? C.safe : C.alert} stroke={9}>
                <b style={{ fontSize: 24, fontWeight: 800, color: C.ink }}>{roiLabel}</b>
                <span style={{ fontSize: 9, fontWeight: 700, color: r.pass ? C.safe : C.alert, letterSpacing: '0.06em' }}>MONTHS</span>
              </Ring>
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.ink3 }}>Payback period</div>
                <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 2, color: r.monthlyProfit >= 0 ? C.ink : C.alert }}>{r.monthlyProfit >= 0 ? `${usd(r.monthlyProfit)}/mo profit` : `${usd(Math.abs(r.monthlyProfit))}/mo loss`}</div>
                <div style={{ fontSize: 12.5, color: C.ink2, marginTop: 3 }}>{r.monthlyProfit < 0 ? 'Loses money monthly — not viable · ' : r.startupProfit >= 0 ? 'Profitable at signing · ' : ''}{usd(r.annualProfit)}/yr · start-up {usd(r.startupProfit)}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '12px 22px', borderRadius: 14, background: r.pass ? 'rgba(34,197,94,0.14)' : 'rgba(239,68,68,0.14)', border: `1px solid ${r.pass ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}` }}>
                <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '0.04em', color: r.pass ? C.safe : C.alert }}>{r.pass ? 'PASS' : 'FAIL'}</div>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.ink3, textAlign: 'center' }}>ROI ≤ 4mo · margin ≥ 30%</div>
              </div>
            </div>
          )}

          {/* SECTION 1 — All numbers (corporate only) */}
          {corp && (
            <div style={{ ...glass, borderRadius: 14, padding: '15px 17px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, fontWeight: 800 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: '#041018', background: C.gold }}>1</span>
                  All Numbers & Calculations
                </div>
                <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.gold, background: 'rgba(199,179,122,0.12)', border: '1px solid rgba(199,179,122,0.32)', padding: '4px 9px', borderRadius: 999 }}>Corporate only</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(135px,1fr))', gap: 11, marginBottom: 14 }}>
                <Stat label="Monthly revenue" value={usd(r.monthlyRevenue)} sub="bulk + P&A" />
                <Stat label="Monthly cost (COGS)" value={usd(r.monthlyCogs)} />
                <Stat label="Monthly payroll" value={usd(r.payroll)} sub="dealers + reps" />
                <Stat label="Monthly profit" value={usd(r.monthlyProfit)} tone={r.monthlyProfit >= 0 ? 'good' : 'bad'} />
                <Stat label="Annual profit" value={usd(r.annualProfit)} tone={r.annualProfit >= 0 ? 'good' : 'bad'} />
                <Stat label="Net margin" value={`${Math.round((r.netMargin || 0) * 100)}%`} tone={(r.netMargin || 0) >= 0.30 ? 'good' : 'bad'} sub="of billed · ≥30% to pass" />
                <Stat label="Start-up profit" value={usd(r.startupProfit)} tone={r.startupProfit >= 0 ? 'good' : 'bad'} sub={`fees − ${usd(r.startupCogs)} install`} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 11 }}>
                <Breakdown title="Monthly revenue" lines={r.revenueBreakdown} total={r.monthlyRevenue} />
                <Breakdown title="Install cost (one-time)" lines={r.startupBreakdown} total={r.startupCogs} />
                <Breakdown title="Monthly cost" lines={r.monthlyBreakdown} total={r.monthlyCogs} />
                <Breakdown title="Monthly payroll" lines={r.payrollBreakdown} total={r.payroll} />
              </div>
            </div>
          )}

          {/* SECTION 2 — Dealer numbers (always) */}
          <div style={{ ...glass, borderRadius: 14, padding: '15px 17px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, fontWeight: 800 }}>
                <span style={{ width: 22, height: 22, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: '#041018', background: C.cyan }}>2</span>
                Dealer Numbers & Calculations
              </div>
              <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.cyan, background: 'rgba(0,163,224,0.12)', border: '1px solid rgba(0,163,224,0.3)', padding: '4px 9px', borderRadius: 999 }}>Visible to dealers</span>
            </div>
            <div style={{ fontSize: 11, color: C.ink3, marginBottom: 11, marginTop: -4 }}>The dealer pays all set-up + monthly costs and collects the set-up fee and all income (bulk + P&A).</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(135px,1fr))', gap: 11 }}>
              <Stat label="Set-up fee (income)" value={usd(r.setupFee)} sub="collected by dealer" tone="brand" />
              <Stat label="Set-up cost" value={usd(r.startupCogs)} sub="equipment + install" />
              <Stat label="Start-up net" value={usd(r.startupProfit)} tone={r.startupProfit >= 0 ? 'good' : 'bad'} />
              <Stat label="Monthly income" value={usd(r.monthlyRevenue)} sub="bulk + P&A" tone="brand" />
              <Stat label="Monthly cost" value={usd((r.monthlyCogs || 0) + (r.payroll || 0))} sub="platform + payouts" />
              <Stat label="Monthly net" value={usd(r.monthlyProfit)} tone={r.monthlyProfit >= 0 ? 'good' : 'bad'} />
              <Stat label="Payback" value={`${roiLabel} mo`} />
              <Stat label="Net margin" value={`${Math.round((r.netMargin || 0) * 100)}%`} tone={(r.netMargin || 0) >= 0.30 ? 'good' : 'bad'} sub="of billed" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 11, marginTop: 12 }}>
              {Array.isArray(r.revenueBreakdown) && r.revenueBreakdown.length > 0 && <Breakdown title="Monthly income" lines={r.revenueBreakdown} total={r.monthlyRevenue} />}
              {Array.isArray(r.startupBreakdown) && r.startupBreakdown.length > 0 && <Breakdown title="Equipment & install — setup cost" lines={r.startupBreakdown} total={r.startupCogs} />}
            </div>
          </div>
        </>)}
      </div>
    </div>
  )
}
