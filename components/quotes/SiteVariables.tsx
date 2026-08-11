'use client'

/**
 * SiteVariables — the rep keys in the known counts for a property and the
 * proposal's "Gate Program" pricing is generated automatically.
 *
 * Inputs (the real intake): units · vehicle gates · amenity & pedestrian gates ·
 * current call boxes · existing cameras to take over · new cameras.
 *
 * All rates come from the Pricing Console via /api/quotes/pricing-rates (single
 * source of truth). As the rep types, we debounce, then hand the parent both the
 * saved variables and the freshly generated priced lines, which the parent writes
 * into the managed "Gate Program" section. The per-gate BAND guardrail is shown
 * live so a gate-heavy ("out of whack") property is caught before the client sees it.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { GenLine } from './GateProgramCalc'

export interface SiteVars {
  units: number
  vehicleGates: number
  amenityGates: number
  callBoxes: number
  existingCameras: number
  newCameras: number
}
export const EMPTY_SITE_VARS: SiteVars = { units: 0, vehicleGates: 0, amenityGates: 0, callBoxes: 0, existingCameras: 0, newCameras: 0 }

interface Rates {
  unitRate: number; includedGates: number; includedSystems: number; includedCamerasPerSystem: number
  addlGate: number; setupWorking: number; setupNonWorking: number
  doorInterior: number; doorExterior: number; cameraNew: number
  bandTarget: number; bandFloor: number; propertyFloor: number; propertyTarget: number
}

const money = (n: number) => '$' + Math.round(n || 0).toLocaleString()
const num = (v: string) => Math.max(0, Math.round(Number(v) || 0))

export function SiteVariables({ initial, onVarsChange, onGenerate }: {
  initial?: Partial<SiteVars>
  onVarsChange: (v: SiteVars) => void
  onGenerate: (lines: GenLine[]) => void
}) {
  const [rates, setRates] = useState<Rates | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [v, setV] = useState<SiteVars>({ ...EMPTY_SITE_VARS, ...initial })
  const set = (k: keyof SiteVars, val: number) => setV(prev => ({ ...prev, [k]: val }))

  useEffect(() => {
    fetch('/api/quotes/pricing-rates').then(r => r.json()).then(j => {
      if (j?.rates) setRates(j.rates); else setErr('Could not load rates.')
    }).catch(() => setErr('Could not load rates.'))
  }, [])

  const calc = useMemo(() => {
    if (!rates) return null
    const totalGates = v.vehicleGates + v.amenityGates
    const extraGates = Math.max(0, totalGates - rates.includedGates)
    const totalCameras = v.existingCameras + v.newCameras
    const includedCams = rates.includedSystems * rates.includedCamerasPerSystem
    const extraCams = Math.max(0, totalCameras - includedCams)

    const monthlyBase = v.units * rates.unitRate
    const monthlyGates = extraGates * rates.addlGate
    const monthlyCams = extraCams * rates.cameraNew
    const monthlyProgram = monthlyBase + monthlyGates              // the band basis
    const monthlyTotal = monthlyProgram + monthlyCams
    const setup = totalGates * rates.setupWorking                  // assumes working gates; rep can flip a line
    const perGate = totalGates > 0 ? monthlyProgram / totalGates : Infinity
    const band = perGate < rates.bandFloor
      ? { tone: 'bad', text: `⛔ ${money(perGate)}/gate — below floor (${money(rates.bandFloor)}). Needs approval.` }
      : perGate < rates.bandTarget
        ? { tone: 'warn', text: `⚠ ${money(perGate)}/gate — below target (${money(rates.bandTarget)}).` }
        : { tone: 'good', text: `✓ ${money(perGate)}/gate — in the sweet spot (${money(rates.bandTarget)}+).` }

    const lines: GenLine[] = []
    if (v.units > 0) lines.push({ description: `Gate program — $${rates.unitRate}/unit`, qty: v.units, unit_price: rates.unitRate, is_recurring: true, is_optional: false })
    if (extraGates > 0) lines.push({ description: `Additional gates (${extraGates} beyond ${rates.includedGates} included)`, qty: extraGates, unit_price: rates.addlGate, is_recurring: true, is_optional: false })
    if (extraCams > 0) lines.push({ description: `Monitored cameras (${extraCams} beyond ${includedCams} included)`, qty: extraCams, unit_price: rates.cameraNew, is_recurring: true, is_optional: false })
    if (totalGates > 0) lines.push({ description: 'Gate activation & setup', qty: totalGates, unit_price: rates.setupWorking, is_recurring: false, is_optional: false })

    return { totalGates, extraGates, totalCameras, monthlyTotal, setup, band, lines }
  }, [rates, v])

  // Auto-drive: debounce the rep's typing, then persist the variables + regenerate
  // the Gate Program section. Skip the very first run so loading a saved proposal
  // doesn't rewrite its lines before the rep touches anything.
  const firstRun = useRef(true)
  const genRef = useRef(onGenerate); genRef.current = onGenerate
  const varsRef = useRef(onVarsChange); varsRef.current = onVarsChange
  useEffect(() => {
    if (!calc) return
    if (firstRun.current) { firstRun.current = false; return }
    const t = setTimeout(() => { varsRef.current(v); genRef.current(calc.lines) }, 900)
    return () => clearTimeout(t)
  }, [v, calc])

  const bandColor = (t: string) => t === 'bad' ? '#f0556a' : t === 'warn' ? '#f0a020' : '#12b886'

  const fields: Array<{ k: keyof SiteVars; l: string; hint?: string }> = [
    { k: 'units', l: 'Units' },
    { k: 'vehicleGates', l: 'Vehicle gates' },
    { k: 'amenityGates', l: 'Amenity / pedestrian gates' },
    { k: 'callBoxes', l: 'Current call boxes' },
    { k: 'existingCameras', l: 'Existing cameras (take over)' },
    { k: 'newCameras', l: 'New cameras' },
  ]

  return (
    <div className="rounded-xl p-3 mb-3" style={{ background: 'linear-gradient(180deg,#22384f,#1b2a3b)', border: '1px solid rgba(95,184,224,0.34)' }}>
      <div className="flex items-center gap-2 mb-1">
        <div className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: '#9FD8EC' }}>📋 Site variables</div>
        <span className="ml-auto text-[10px]" style={{ color: '#6f8299' }}>auto-prices the Gate Program</span>
      </div>
      <div className="text-[10.5px] mb-2 leading-relaxed" style={{ color: '#8fa4b8' }}>Key in the counts — the Gate Program section prices itself. Every line stays editable below.</div>

      {err && <div className="text-[11px] mb-2" style={{ color: '#fca5a5' }}>{err}</div>}
      {!rates ? (
        <div className="text-[12px] py-3 text-center" style={{ color: '#9fb4c9' }}>Loading rates…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {fields.map(f => (
              <label key={f.k} className="text-[9.5px] font-bold uppercase tracking-[0.04em]" style={{ color: '#9fb4c9' }}>{f.l}
                <input
                  type="number" min={0} value={v[f.k]}
                  onChange={e => set(f.k, num(e.target.value))}
                  className="block w-full mt-1 rounded-lg px-2 py-1.5 text-[14px] font-semibold outline-none"
                  style={{ background: '#0c1420', border: '1px solid rgba(140,170,200,0.24)', color: '#eef4fb' }}
                />
              </label>
            ))}
          </div>

          {calc && (calc.totalGates > 0 || calc.totalCameras > 0 || v.units > 0) && (
            <>
              <div className="mt-2.5 rounded-lg px-2.5 py-2 text-[11.5px] font-bold" style={{ color: bandColor(calc.band.tone), border: `1px solid ${bandColor(calc.band.tone)}`, background: 'rgba(0,0,0,0.22)' }}>
                {calc.band.text}
                <span className="block font-medium mt-0.5" style={{ color: '#9fb4c9' }}>
                  {calc.totalGates} gates · {rates.includedGates} included · {calc.extraGates} additional
                  {v.callBoxes > 0 ? ` · ${v.callBoxes} call box${v.callBoxes === 1 ? '' : 'es'} replaced (in setup)` : ''}
                </span>
              </div>
              <div className="mt-2 flex gap-4 text-[12.5px] font-extrabold" style={{ color: '#e7eef7' }}>
                <span>Monthly {money(calc.monthlyTotal)}</span>
                <span>Setup {money(calc.setup)}</span>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
