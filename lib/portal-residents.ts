/**
 * lib/portal-residents.ts — residents data for the ops portal's Residents screen.
 *
 * Reads GateCard's move-in tables (move-in compliance list, concession code blocks,
 * site settings) from the same Supabase project. Those tables live in the GateCard
 * app and aren't in this repo's migrations yet, so this is the SINGLE swap point:
 * getResidentsData() returns mock data today; wire the real queries here (inside the
 * try block) once the GateCard table + column names are confirmed — no caller changes.
 */
import { createClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export type MoveIn = { id: string; unit: string; resident: string; status: 'scheduled' | 'in_progress' | 'complete'; date: string; email?: string; phone?: string }
export type ComplianceItem = { id: string; unit: string; resident: string; item: string; status: 'ok' | 'pending' | 'missing'; due?: string }
export type ConcessionBlock = { id: string; code: string; units: number; used: number; expires: string; status: 'active' | 'expired' | 'depleted' }
export type SiteSetting = { label: string; value: string }
export interface ResidentsData {
  source: 'live' | 'mock'
  moveIns: MoveIn[]
  compliance: ComplianceItem[]
  concessionBlocks: ConcessionBlock[]
  siteSettings: SiteSetting[]
}

function mock(): ResidentsData {
  return {
    source: 'mock',
    moveIns: [
      { id: 'm1', unit: '204', resident: 'Jordan Ellis', status: 'in_progress', date: '2026-10-08', email: 'jordan.e@example.com', phone: '(770) 555-0182' },
      { id: 'm2', unit: '117', resident: 'Priya Natarajan', status: 'scheduled', date: '2026-10-11', email: 'priya.n@example.com' },
      { id: 'm3', unit: '305', resident: 'Marcus Webb', status: 'complete', date: '2026-09-30', phone: '(770) 555-0147' },
      { id: 'm4', unit: '101', resident: 'Dana Cole', status: 'scheduled', date: '2026-10-14' },
    ],
    compliance: [
      { id: 'c1', unit: '204', resident: 'Jordan Ellis', item: 'Renter’s insurance', status: 'pending', due: '2026-10-08' },
      { id: 'c2', unit: '204', resident: 'Jordan Ellis', item: 'Parking & amenity fee', status: 'ok' },
      { id: 'c3', unit: '117', resident: 'Priya Natarajan', item: 'Signed lease', status: 'ok' },
      { id: 'c4', unit: '117', resident: 'Priya Natarajan', item: 'Renter’s insurance', status: 'missing', due: '2026-10-11' },
      { id: 'c5', unit: '305', resident: 'Marcus Webb', item: 'Gate credential issued', status: 'ok' },
    ],
    concessionBlocks: [
      { id: 'b1', code: 'FALL25', units: 10, used: 4, expires: '2026-12-31', status: 'active' },
      { id: 'b2', code: 'WELCOME', units: 5, used: 5, expires: '2026-11-30', status: 'depleted' },
      { id: 'b3', code: 'SPRING24', units: 8, used: 3, expires: '2026-06-30', status: 'expired' },
    ],
    siteSettings: [
      { label: 'Parking & amenity fee', value: '$125 / unit / yr' },
      { label: 'Move-in credential', value: 'Mobile pass, auto-issued' },
      { label: 'Concession approval', value: 'Property manager' },
      { label: 'PMS sync', value: 'Yardi (nightly)' },
    ],
  }
}

/**
 * Return residents data for a site. Today: mock. To go live, replace the body of
 * the try block below with the real GateCard queries (move_ins / compliance /
 * concession_blocks / site_settings) keyed by site_id, keeping the same return shape.
 */
export async function getResidentsData(siteId: string | null): Promise<ResidentsData> {
  if (!siteId) return mock()
  try {
    // TODO(gatecard): replace with live reads once table + column names are confirmed, e.g.
    //   const { data: moveIns } = await db().from('move_ins').select(...).eq('site_id', siteId)
    //   ...map to MoveIn / ComplianceItem / ConcessionBlock / SiteSetting and return source:'live'.
    return mock()
  } catch {
    return mock()
  }
}
