'use client'

/**
 * GateProgramCalc — enter the counts, get correct gate-program pricing.
 *
 * Reuses your Pricing Console rates (via /api/quotes/pricing-rates): $/unit,
 * included gates/systems/cameras, additional-gate rate, working/non-working
 * setup, door + camera rates, and the per-gate BAND guardrail. Generates the
 * priced line items and flags a gate-heavy ("out of whack") property before it
 * ever reaches the client.
 */
import { useEffect, useMemo, useState } from 'react'

export interface GenLine { description: string; qty: number; unit_price: number; is_recurring: boolean; is_optional: boolean; unit_cost?: number; labor_hours?: number }
interface Rates {
  unitRate: number; includedGates: number; includedSystems: number; includedCamerasPerSystem: number
  addlGate: number; setupWorking: number; setupNonWorking: number
  doorInterior: number; doorExterior: number; cameraNew: number
  bandTarget: number; bandFloor: number; propertyFloor: number; propertyTarget: number
}
const money = (n: number) => '$' + Math.round(n || 0).toLocaleString()

export function GateProgramCalc({ defaultUnits, onClose, onGenerate }: {
  defaultUnits?: number
  onClose: () => void
  onGenerate: (lines: GenLine[]) => void
}) {
  const [rates, setRates] = useState<Rates | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [units, setUnits] = useState(defaultUnits || 0)
  const [workingGates, setWorkingGates] = useState(0)
  const [nonWorkingGates, setNonWorkingGates] = useState(0)
  const [interiorDoors, setInteriorDoors] = useState(0)
  const [exteriorDoors, setExteriorDoors] = useState(0)
  const [cameras, setCameras] = useState(0)

  useEffect(() => {
    fetch('/api/quotes/pricing-rates').then(r => r.json()).then(j => {
      if (j?.rates) setRates(j.rates); else setErr('Could not load rates.')
    }).catch(() => setErr('Could not load rates.'))
  }, [])

  const calc = useMemo(() => {
    if (!rates) return null
    const totalGates = workingGates + nonWorkingGates
    const extraGates = Math.max(0, totalGates - rates.includedGates)
    const includedCams = rates.includedSystems * rates.includedCamerasPerSystem
    const extraCams = Math.max(0, cameras - includedCams)
    const monthlyBase = units * rates.unitRate
    const monthlyGates = extraGates * rates.addlGate
    const monthlyDoors = interiorDoors * rates.doorInterior + exteriorDoors * rates.doorExterior
    const monthlyCams = extraCams * rates.cameraNew
    const monthlyProgram = monthlyBase + monthlyGates                 // the band basis
    const monthlyTotal = monthlyProgram + monthlyDoors + monthlyCams
    const setup = workingGates * rates.setupWorking + nonWorkingGates * rates.setupNonWorking
    const perGate = totalGates > 0 ? monthlyProgram / totalGates : Infinity
    const band = perGate < rates.bandFloor ? { tone: 'bad', text: `⛔ ${money(perGate)}/gate — below floor (${money(rates.bandFloor)}). Blocked / dual approval.` }
      : perGate < rates.bandTarget ? { tone: 'warn', text: `⚠ ${money(perGate)}/gate — below target (${money(rates.bandTarget)}). Needs written justification.` }
      : { tone: 'good', text: `✓ ${money(perGate)}/gate — in the sweet spot (${money(rates.bandTarget)}+).` }

    const lines: GenLine[] = []
    if (units > 0) lines.push({ description: `Gate program — $${rates.unitRate}/unit`, qty: units, unit_price: rates.unitRate, is_recurring: true, is_optional: false })
    if (extraGates > 0) lines.push({ description: `Additional gates (${extraGates} beyond ${rates.includedGates} included)`, qty: extraGates, unit_price: rates.addlGate, is_recurring: true, is_optional: false })
    if (interiorDoors > 0) lines.push({ description: 'Interior access doors', qty: interiorDoors, unit_price: rates.doorInterior, is_recurring: true, is_optional: false })
    if (exteriorDoors > 0) lines.push({ description: 'Exterior access doors', qty: exteriorDoors, unit_price: rates.doorExterior, is_recurring: true, is_optional: false })
    if (extraCams > 0) lines.push({ description: `Monitored cameras (${extraCams} beyond ${includedCams} included)`, qty: extraCams, unit_price: rates.cameraNew, is_recurring: true, is_optional: false })
    if (workingGates > 0) lines.push({ description: 'Gate setup — working', qty: workingGates, unit_price: rates.setupWorking, is_recurring: false, is_optional: false })
    if (nonWorkingGates > 0) lines.push({ description: 'Gate setup — non-working', qty: nonWorkingGates, unit_price: rates.setupNonWorking, is_recurring: false, is_optional: false })

    return { totalGates, extraGates, monthlyTotal, setup, band, lines }
  }, [rates, units, workingGates, nonWorkingGates, interiorDoors, exteriorDoors, cameras])

  const bandColor = (t: string) => t === 'bad' ? '#f0556a' : t === 'warn' ? '#f0a020' : '#12b886'
  const num = (v: string) => Math.max(0, Number(v) || 0)

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(6,12,20,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(560px,100%)', maxHeight: '90vh', overflowY: 'auto', borderRadius: 18, padding: 20, color: '#eef4fb', background: 'repeating-linear-gradient(90deg,rgba(255,255,255,0.04) 0 1px,transparent 1px 4px), linear-gradient(180deg,#33465e,#243141)', border: '1px solid rgba(170,198,222,0.3)', boxShadow: '0 30px 80px rgba(0,0,0,0.55)' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>🧮 Gate Program calculator</div>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)', color: '#cfe0f0', borderRadius: 9, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>Close</button>
        </div>

        {err && <div style={{ color: '#fca5a5', fontSize: 12, marginBottom: 8 }}>{err}</div>}
        {!rates ? <div style={{ color: '#9fb4c9', fontSize: 13, padding: 20, textAlign: 'center' }}>Loading rates…</div> : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { l: 'Units', v: units, set: setUnits },
                { l: 'Working gates', v: workingGates, set: setWorkingGates },
                { l: 'Non-working gates', v: nonWorkingGates, set: setNonWorkingGates },
                { l: 'Monitored cameras', v: cameras, set: setCameras },
                { l: 'Interior doors', v: interiorDoors, set: setInteriorDoors },
                { l: 'Exterior doors', v: exteriorDoors, set: setExteriorDoors },
              ].map((f, k) => (
                <label key={k} style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#9fb4c9' }}>{f.l}
                  <input type="number" value={f.v} onChange={e => f.set(num(e.target.value))} style={{ display: 'block', width: '100%', marginTop: 4, padding: '9px 10px', borderRadius: 9, background: '#0c1420', border: '1px solid rgba(140,170,200,0.24)', color: '#eef4fb', fontSize: 15, fontWeight: 600 }} />
                </label>
              ))}
            </div>

            {calc && (
              <>
                {/* Band guardrail */}
                <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 11, fontSize: 12.5, fontWeight: 700, color: bandColor(calc.band.tone), border: `1px solid ${bandColor(calc.band.tone)}`, background: 'rgba(0,0,0,0.2)' }}>
                  {calc.band.text}
                  <span style={{ display: 'block', fontWeight: 500, color: '#9fb4c9', marginTop: 2 }}>{calc.totalGates} gates · {rates.includedGates} included · {calc.extraGates} additional</span>
                </div>

                {/* Generated lines preview */}
                <div style={{ marginTop: 12, borderRadius: 11, border: '1px solid rgba(140,170,200,0.2)', background: 'rgba(12,20,32,0.4)', padding: 10 }}>
                  {calc.lines.length === 0 && <div style={{ fontSize: 12, color: '#6f8299' }}>Enter counts to generate lines.</div>}
                  {calc.lines.map((l, k) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '5px 0', borderBottom: '1px dashed rgba(140,170,200,0.16)', color: '#d6e3ef' }}>
                      <span>{l.description}{l.qty > 1 ? ` ×${l.qty}` : ''}</span>
                      <span style={{ fontWeight: 700 }}>{money(l.qty * l.unit_price)}{l.is_recurring ? '/mo' : ''}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 13, fontWeight: 800 }}>
                    <span>Monthly {money(calc.monthlyTotal)}</span>
                    <span>Setup {money(calc.setup)}</span>
                  </div>
                </div>

                <button
                  onClick={() => { if (calc.lines.length) onGenerate(calc.lines) }}
                  disabled={calc.band.tone === 'bad' || calc.lines.length === 0}
                  style={{ width: '100%', marginTop: 14, padding: '13px', borderRadius: 12, border: 0, fontWeight: 800, fontSize: 15, color: '#04231a', background: calc.band.tone === 'bad' || !calc.lines.length ? 'rgba(255,255,255,0.12)' : 'linear-gradient(135deg,#3ddc97,#12b886)', cursor: calc.band.tone === 'bad' || !calc.lines.length ? 'not-allowed' : 'pointer' }}
                >
                  {calc.band.tone === 'bad' ? 'Below floor — needs approval' : 'Add to proposal →'}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
