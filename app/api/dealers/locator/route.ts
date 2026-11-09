/**
 * GET /api/dealers/locator — PUBLIC "find a dealer" directory for gateguard.co.
 * Returns active dealer organizations (name, city, state, phone, email). Optional
 * ?state=GA or ?q=atlanta filter. No auth — only non-sensitive public fields.
 *
 * Tier column is `org_tier` (renamed from `tier` in migration 034). Only
 * customer-facing dealer tiers plus Gate Guard corporate are listed — not master agents,
 * install contractors, sales partners or clients.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Corporate (Gate Guard itself) is listed too, after the local dealers.
const DEALER_TIERS = ['master_dealer', 'full_dealer', 'service_dealer', 'corporate']

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
    let query = db
      .from('organizations')
      .select('id, name, org_tier, city, state, zip, primary_phone, contact_phone, primary_email, contact_email, logo_url, slug')
      .in('org_tier', DEALER_TIERS)
      .neq('status', 'inactive')
      .order('name')

    // Orgs store state as "GA" or "Georgia" — match either.
    if (state) {
      const name = STATE_NAMES[state]
      query = name ? query.or(`state.ilike.${state},state.ilike.${name}`) : query.ilike('state', state)
    }
    if (q) query = query.or(`name.ilike.%${q}%,city.ilike.%${q}%`)

    const { data, error } = await query
    if (error) {
      console.error('dealer locator query error:', error)
      return NextResponse.json({ dealers: [], error: 'lookup failed' }, { status: 200 })
    }

    // Local dealers first (A–Z), Gate Guard corporate last.
    const rows = [...(data ?? [])].sort((a, b) =>
      Number(a.org_tier === 'corporate') - Number(b.org_tier === 'corporate'))

    const dealers = rows.map(d => ({
      id: d.id,
      name: d.name,
      city: d.city ?? null,
      state: d.state ?? null,
      zip: d.zip ?? null,
      phone: d.primary_phone ?? d.contact_phone ?? null,
      email: d.primary_email ?? d.contact_email ?? null,
      logo_url: d.logo_url ?? null,
    }))
    return NextResponse.json({ dealers })
  } catch (e) {
    console.error('dealer locator error:', e)
    return NextResponse.json({ dealers: [], error: 'lookup failed' }, { status: 200 })
  }
}
