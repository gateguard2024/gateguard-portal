/**
 * POST /api/aria/properties/save-base
 * Save selected BASE-FIND results into the Intel DB (aria_properties).
 *
 * Base data only — name, address, city/state, units, and the system presence
 * flags. No deep research, no contacts, no scoring. Deep research is a separate,
 * explicit step that enriches the same row later.
 *
 * Body:  { properties: BaseProperty[] }
 * Reply: { saved, failed, errors[] }   ← always the truth. Never a silent 200.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface Systems {
  internet?: boolean; video?: boolean; bulk?: boolean; gates?: boolean
  cameras?: boolean; smart_lockers?: boolean; smart_rent?: boolean
}
interface BaseIn {
  name: string; address?: string; city?: string; state?: string
  units?: number | null; website?: string | null; management_company?: string | null
  lat?: number | null; lng?: number | null; photo_url?: string | null
  phone?: string | null
  systems?: Systems
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user?.id || user.id === 'anonymous') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const properties: BaseIn[] = Array.isArray(body.properties) ? body.properties : []
    if (!properties.length) return NextResponse.json({ saved: 0, failed: 0, errors: [] })

    let saved = 0
    const errors: string[] = []

    for (const p of properties) {
      const name = (p.name ?? '').trim()
      if (!name) { errors.push('A result had no name.'); continue }
      const sys = p.systems ?? {}

      // facts = Data In. Only what we actually observed.
      const facts = {
        property: {
          name,
          address: p.address ?? '',
          city: p.city ?? '',
          state: p.state ?? '',
          units: p.units ?? null,
          website: p.website ?? null,
          management_company: p.management_company ?? null,
          lat: p.lat ?? null,
          lng: p.lng ?? null,
          // The community's own hero shot, straight off their site. Lives in
          // facts (JSONB) — no new column needed.
          photo_url: p.photo_url ?? null,
        },
        connectivity: {
          internet_present: !!sys.internet,
          video_present: !!sys.video,
          bulk_present: !!sys.bulk,
        },
        proptech_found: {
          gates_present: !!sys.gates,
          cameras_present: !!sys.cameras,
          smart_lockers_present: !!sys.smart_lockers,
          smart_rent_present: !!sys.smart_rent,
        },
        source: 'base_find',
      }

      // Resolve the row ourselves — never rely on ON CONFLICT here (the only
      // unique index is an expression index, which Postgres cannot match to a
      // plain column conflict target; that silently failed every write).
      const { data: existingRows } = await supabase
        .from('aria_properties')
        .select('id, facts')
        .ilike('property_name', name)
        .order('last_researched_at', { ascending: false, nullsFirst: false })
        .limit(1)
      const existing = existingRows?.[0] ?? null

      // Never overwrite good data with a shallow base pass.
      const keep = <T,>(fresh: T | null | undefined, prev: T | null | undefined): T | null =>
        (fresh === null || fresh === undefined || fresh === '' ? (prev ?? null) : fresh)

      const row: Record<string, unknown> = {
        property_name: name,
        address: p.address ?? '',
        city: p.city ?? null,
        state: p.state ?? null,
        units: p.units ?? null,
        property_phone: p.phone ?? null,
        // NOTE: there is NO `website` column on aria_properties — writing one
        // makes Postgres reject the entire row. The website is kept in
        // facts.property.website (JSONB) above, which is where readers look.
        management_company: p.management_company ?? null,
        roe_detected: !!sys.bulk,
        // NOTE: brand columns (isp_providers, gate_operators, cameras, …) are
        // deliberately NOT written here. The base find knows a gate EXISTS, not
        // which gate. Writing "Gate (present — brand unknown)" into the vendor
        // column poisons real data — the deep merge unions arrays, so the fake
        // string would sit next to the real brand forever and read as a finding.
        // Presence lives in facts.* only; deep research fills the brands.
        facts: existing?.facts ? { ...(existing.facts as object), ...facts } : facts,
        last_researched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Don't blank out fields a deeper run already filled in.
      // Every key here MUST be a real column on aria_properties.
      if (existing) {
        for (const k of ['units', 'management_company', 'city', 'state', 'address', 'property_phone'] as const) {
          const prevVal = (existing as Record<string, unknown>)[k]
          row[k] = keep(row[k] as string | number | null, prevVal as string | number | null)
        }
      }

      const { error } = existing?.id
        ? await supabase.from('aria_properties').update(row).eq('id', existing.id)
        : await supabase.from('aria_properties').insert(row)

      if (error) {
        console.error(`[aria/save-base] FAILED "${name}": ${error.message}`)
        errors.push(`${name}: ${error.message}`)
      } else {
        saved++
      }
    }

    // A 200 with saved:0 is how this silently lost data before. Be loud.
    if (errors.length && saved === 0) {
      return NextResponse.json(
        { saved: 0, failed: errors.length, errors, error: `Nothing saved: ${errors[0]}` },
        { status: 500 }
      )
    }
    return NextResponse.json({ saved, failed: errors.length, errors })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Save failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
