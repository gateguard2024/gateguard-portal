'use client'

/**
 * SiteVariables — the rep keys in the known counts for a property and the
 * proposal's "Gate Program" pricing is generated automatically from the REAL
 * Gate Guard pricing engine (/api/pricing/compute → lib/pricing-model.ts), the
 * same engine behind the sales-tab calculator.
 *
 * Field → engine mapping:
 *   units                              → livingUnits
 *   vehicle gates + amenity/ped gates  → entryPoints (all gates are "entry points")
 *   existing + new cameras             → camerasMonitored
 *   call boxes                         → one-time install only (not the monthly bill)
 *
 * Smart package / cellular / dealer-maintains are not captured here yet, so they
 * default (none / none / yes). Easy to add later.
 *
 * As the rep types, we debounce, compute via the engine, then hand the parent the
 * saved variables + the generated priced lines (monthly service + gate setup),
 * which it writes into the managed "Gate Program" section. The monthly line's cost
 * is set so the dealer P&L shows the dealer's real take from the engine.
 */
import { useEffect, useRef, useState } from 'react'
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Result = Record<string, any>
const money = (n: number) => '$' + Math.round(n || 0).toLocaleString()
const round2 = (n: number) => Math.round(n * 100) / 100
const num = (v: string) => Math.max(0, Math.round(Number(v) || 0))
const WORKING_GATE_CHARGE = 500   // one-time install guideline / gate (from InstallCalculator)

// Build the Gate Program priced lines from the engine result.
function buildLines(res: Result, v: SiteVars): GenLine[] {
  const lines: GenLine[] = []
  const units = Number(res.livingUnits) || v.units || 0
  const perUnit = Number(res.perUnit) || 0
  const monthly = Number(res.customerMonthly) || 0
  const dealer = Number(res.dealerCut) || 0
  const totalGates = v.vehicleGates + v.amenityGates
  if (monthly > 0) {
    if (units > 0) {
      // cost = the portion remitted past the dealer, so dealer P&L profit ≈ dealer cut
      const remitPerUnit = Math.max(0, round2(perUnit - dealer / units))
      lines.push({ description: `Gate Guard monthly service ($${round2(perUnit)}/unit)`, qty: units, unit_price: round2(perUnit), is_recurring: true, is_optional: false, unit_cost: remitPerUnit, labor_hours: 0 })
    } else {
      lines.push({ description: 'Gate Guard monthly service', qty: 1, unit_price: round2(monthly), is_recurring: true, is_optional: false, unit_cost: Math.max(0, round2(monthly - dealer)), labor_hours: 0 })
    }
  }
  if (totalGates > 0) {
    // One-time gate setup (install guideline). Cost falls back to the builder's
    // per-gate estimate until the parts sheet is wired in.
    lines.push({ description: 'Gate activation & setup (per gate)', qty: totalGates, unit_price: WORKING_GATE_CHARGE, is_recurring: false, is_optional: false })
  }
  return lines
}

export function SiteVariables({ initial, onVarsChange, onGenerate }: {
  initial?: Partial<SiteVars>
  onVarsChange: (v: SiteVars) => void
  onGenerate: (lines: GenLine[]) => void
}) {
  const [v, setV] = useState<SiteVars>({ ...EMPTY_SITE_VARS, ...initial })
  const [res, setRes] = useState<Result | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const set = (k: keyof SiteVars, val: number) => setV(prev => ({ ...prev, [k]: val }))

  const firstRun = useRef(true)
  const genRef = useRef(onGenerate); genRef.current = onGenerate
  const varsRef = useRef(onVarsChange); varsRef.current = onVarsChange

  // Debounced: compute via the real engine; show the preview; on user edits also
  // persist the vars + regenerate the Gate Program lines (skip the first mount so
  // loading a saved proposal doesn't rewrite it).
  useEffect(() => {
    const totalGates = v.vehicleGates + v.amenityGates
    const totalCams = v.existingCameras + v.newCameras
    const empty = v.units === 0 && totalGates === 0 && totalCams === 0
    const t = setTimeout(async () => {
      let result: Result | null = null
      if (!empty) {
        setLoading(true)
        try {
          const r = await fetch('/api/pricing/compute', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              livingUnits: v.units,
              entryPoints: totalGates,
              camerasMonitored: totalCams,
              camerasNonMonitored: 0,
              smartPackage: 'none', cellular: 'none', dealerMaintainsEntry: true,
            }),
          })
          const j = await r.json().catch(() => ({}))
          if (j?.result) { result = j.result; setErr(null) } else setErr('Could not price this site.')
        } catch { setErr('Could not price this site.') }
        finally { setLoading(false) }
      }
      setRes(result)
      if (firstRun.current) { firstRun.current = false; return }
      varsRef.current(v)
      genRef.current(result ? buildLines(result, v) : [])
    }, 900)
    return () => clearTimeout(t)
  }, [v])

  const fields: Array<{ k: keyof SiteVars; l: string }> = [
    { k: 'units', l: 'Units' },
    { k: 'vehicleGates', l: 'Vehicle gates' },
    { k: 'amenityGates', l: 'Amenity / pedestrian gates' },
    { k: 'callBoxes', l: 'Current call boxes' },
    { k: 'existingCameras', l: 'Existing cameras (take over)' },
    { k: 'newCameras', l: 'New cameras' },
  ]

  const monthly = Number(res?.customerMonthly) || 0
  const perUnit = Number(res?.perUnit) || 0
  const minBinds = !!res?.propertyMinBinds

  return (
    <div className="rounded-xl p-3 mb-3" style={{ background: 'linear-gradient(180deg,#22384f,#1b2a3b)', border: '1px solid rgba(95,184,224,0.34)' }}>
      <div className="flex items-center gap-2 mb-1">
        <div className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: '#9FD8EC' }}>📋 Site variables</div>
        <span className="ml-auto text-[10px]" style={{ color: '#6f8299' }}>{loading ? 'pricing…' : 'live Gate Guard engine'}</span>
      </div>
      <div className="text-[10.5px] mb-2 leading-relaxed" style={{ color: '#8fa4b8' }}>Key in the counts — the Gate Program section prices itself from the real calculator. Every line stays editable below.</div>

      {err && <div className="text-[11px] mb-2" style={{ color: '#fca5a5' }}>{err}</div>}

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

      {res && monthly > 0 && (
        <>
          <div className="mt-2.5 flex gap-4 text-[12.5px] font-extrabold" style={{ color: '#e7eef7' }}>
            <span>Monthly {money(monthly)}</span>
            <span style={{ color: '#9fb4c9' }}>{money(perUnit)}/unit</span>
          </div>
          {minBinds && <div className="mt-1 text-[11px] font-bold" style={{ color: '#f0a020' }}>Monthly minimum applied ({money(Number(res.propertyMin) || 1500)})</div>}
          <div className="mt-1 text-[10px]" style={{ color: '#6f8299' }}>Call boxes + new-camera installs price on the one-time side (coming).</div>
        </>
      )}
    </div>
  )
}
