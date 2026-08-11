/**
 * GET /api/quotes/pricing-rates — the gate-program rate card, single source of
 * truth for the proposal builder's Gate Program calculator.
 *
 * Reads the GateGuard program lines from `service_catalog` (is_gateguard_program)
 * + the included-allotment settings from `catalog_pricing_settings` — the exact
 * rows the Pricing Console edits — so changing a rate there changes the builder,
 * no code deploy. Falls back to the seeded migration-157 defaults if a row is
 * missing, so the calculator always works.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Defaults = the seeded values in migration 157 (target prices).
const D = {
  unitRate: 10,               // BASE.UNIT_RATE — $/unit/mo
  includedGates: 8,           // covered by the property base
  includedSystems: 2,
  includedCamerasPerSystem: 1,
  addlGate: 310,              // C1.ADDL_GATE — $/gate/mo beyond included
  setupWorking: 500,          // B1.SETUP_WORKING — one-time / gate
  setupNonWorking: 750,       // B1.SETUP_NONWORKING — one-time / gate
  doorInterior: 100,          // C4.DOOR_INTERIOR — $/door/mo
  doorExterior: 150,          // C4.DOOR_EXTERIOR — $/door/mo
  cameraNew: 100,             // C5.CAMERA_NEW — $/camera/mo (hardware incl.)
  bandTarget: 310,            // BASE.GATE_BAND — MRR/gate should stay ≥ this
  bandFloor: 225,             // …and never below this
  propertyFloor: 1800,        // BASE.PROPERTY minimum
  propertyTarget: 2500,
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user?.canViewCRM) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const rates = { ...D }
  try {
    const [{ data: items }, { data: settings }] = await Promise.all([
      supabase.from('service_catalog').select('item_code, target_price, floor_price, base_price').eq('is_gateguard_program', true),
      supabase.from('catalog_pricing_settings').select('key, value'),
    ])
    const num = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null }
    const byCode = new Map((items ?? []).map(r => [String(r.item_code), r]))
    const t = (code: string) => { const r = byCode.get(code); return r ? num(r.target_price) ?? num(r.base_price) : null }
    const f = (code: string) => { const r = byCode.get(code); return r ? num(r.floor_price) : null }

    rates.unitRate        = t('BASE.UNIT_RATE')        ?? rates.unitRate
    rates.addlGate        = t('C1.ADDL_GATE')          ?? rates.addlGate
    rates.setupWorking    = t('B1.SETUP_WORKING')      ?? rates.setupWorking
    rates.setupNonWorking = t('B1.SETUP_NONWORKING')   ?? rates.setupNonWorking
    rates.doorInterior    = t('C4.DOOR_INTERIOR')      ?? rates.doorInterior
    rates.doorExterior    = t('C4.DOOR_EXTERIOR')      ?? rates.doorExterior
    rates.cameraNew       = t('C5.CAMERA_NEW')         ?? rates.cameraNew
    rates.bandTarget      = t('BASE.GATE_BAND')        ?? rates.bandTarget
    rates.bandFloor       = f('BASE.GATE_BAND')        ?? rates.bandFloor
    rates.propertyFloor   = f('BASE.PROPERTY')         ?? rates.propertyFloor
    rates.propertyTarget  = t('BASE.PROPERTY')         ?? rates.propertyTarget

    const sMap = new Map((settings ?? []).map(s => [String(s.key), s.value]))
    const sn = (k: string): number | null => { const n = Number(sMap.get(k)); return Number.isFinite(n) && n > 0 ? n : null }
    rates.includedGates            = sn('included_gates')             ?? rates.includedGates
    rates.includedSystems          = sn('included_gate_systems')      ?? rates.includedSystems
    rates.includedCamerasPerSystem = sn('included_cameras_per_system')?? rates.includedCamerasPerSystem
  } catch { /* fall back to defaults */ }

  return NextResponse.json({ rates })
}
