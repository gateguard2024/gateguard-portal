/**
 * GET /api/dealers/locator — PUBLIC "find a dealer" directory for gateguard.co.
 * Returns active dealer organizations (name, city, state, phone, email). Optional
 * ?state=GA or ?q=atlanta filter. No auth — only non-sensitive public fields.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEALER_TIERS = ['master_dealer', 'install_dealer', 'service_dealer', 'sales', 'master_agent']

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const state = (sp.get('state') || '').trim()
    const q = (sp.get('q') || '').trim()

    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    let query = db
      .from('organizations')
      .select('id, name, city, state, zip, primary_phone, contact_phone, primary_email, contact_email, logo_url, slug')
      .in('tier', DEALER_TIERS)
      .neq('status', 'inactive')
      .order('name')

    if (state) query = query.ilike('state', state)
    if (q) query = query.or(`name.ilike.%${q}%,city.ilike.%${q}%`)

    const { data, error } = await query
    if (error) return NextResponse.json({ dealers: [], error: error.message }, { status: 200 })

    const dealers = (data ?? []).map(d => ({
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
