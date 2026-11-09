/**
 * GET /api/dealers/locator — PUBLIC "find a dealer" directory for gateguard.co.
 * Returns active dealer organizations (name, city, state, phone, email). Optional
 * ?state=GA or ?q=atlanta filter. No auth — only non-sensitive public fields.
 *
 * Tier column is `org_tier` (renamed from `tier` in migration 034). Lists local
 * dealers (master / full / service) in the chosen state, then Gate Guard corporate
 * last for every state (`corporate: true`). Master agents, install contractors,
 * sales partners and clients are never listed.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LOCAL_TIERS = ['master_dealer', 'full_dealer', 'service_dealer']
// Fallbacks when the corporate org row has no phone/email filled in.
const CORPORATE_PHONE = '844-469-4283' // 844-4MY-GATE
const CORPORATE_EMAIL = 'info@gateguard.co'

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
  IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
  ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas',
  UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia',
  WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia',
}

// PostgREST filter strings treat , ( ) as syntax — strip them from user input.
const safe = (s: string) => s.replace(/[^A-Za-z0-9 .'-]/g, '').slice(0, 60)

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const state = safe((sp.get('state') || '').trim()).toUpperCase()
    const q = safe((sp.get('q') || '').trim())

    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const COLS = 'id, name, org_tier, city, state, zip, primary_phone, contact_phone, primary_email, contact_email, logo_url, slug'

    // 1) Local dealers in the chosen state.
    let query = db
      .from('organizations')
      .select(COLS)
      .in('org_tier', LOCAL_TIERS)
      .neq('status', 'inactive')
      .order('name')

    // Orgs store state as "GA" or "Georgia" — match either.
    if (state) {
      const name = STATE_NAMES[state]
      query = name ? query.or(`state.ilike.${state},state.ilike.${name}`) : query.ilike('state', state)
    }
    if (q) query = query.or(`name.ilike.%${q}%,city.ilike.%${q}%`)

    // 2) Gate Guard corporate — always listed last, for every state, so a
    //    search never comes back empty.
    const [{ data, error }, { data: corp }] = await Promise.all([
      query,
      db.from('organizations').select(COLS).eq('org_tier', 'corporate').neq('status', 'inactive').order('created_at').limit(1),
    ])
    if (error) {
      console.error('dealer locator query error:', error)
      return NextResponse.json({ dealers: [], error: 'lookup failed' }, { status: 200 })
    }

    // Drop duplicate org rows that share a name (keeps the one with the most contact info).
    type Row = NonNullable<typeof data>[number]
    const score = (r: Row) => [r.city, r.state, r.primary_phone ?? r.contact_phone, r.primary_email ?? r.contact_email].filter(Boolean).length
    const byName = new Map<string, Row>()
    for (const r of data ?? []) {
      const k = String(r.name || '').trim().toLowerCase()
      const prev = byName.get(k)
      if (!prev || score(r) > score(prev)) byName.set(k, r)
    }

    const dealers = [...byName.values()].map(d => ({
      id: d.id,
      name: d.name,
      city: d.city ?? null,
      state: d.state ?? null,
      zip: d.zip ?? null,
      phone: d.primary_phone ?? d.contact_phone ?? null,
      email: d.primary_email ?? d.contact_email ?? null,
      logo_url: d.logo_url ?? null,
      corporate: false,
    }))

    const c = corp?.[0]
    dealers.push({
      id: c?.id ?? 'gateguard-corporate',
      name: c?.name || 'Gate Guard, LLC',
      city: c?.city || 'Atlanta',
      state: c?.state || 'GA',
      zip: c?.zip ?? null,
      phone: c?.primary_phone || c?.contact_phone || CORPORATE_PHONE,
      email: c?.primary_email || c?.contact_email || CORPORATE_EMAIL,
      logo_url: c?.logo_url ?? null,
      corporate: true,
    })

    return NextResponse.json({ dealers })
  } catch (e) {
    console.error('dealer locator error:', e)
    return NextResponse.json({ dealers: [], error: 'lookup failed' }, { status: 200 })
  }
}
