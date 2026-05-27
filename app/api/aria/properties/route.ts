/**
 * GET  /api/aria/properties — paginated list of all discovered properties
 *   ?limit=50&offset=0&stage=prospect&urgency=high&expiry_before=2027&search=greystar
 * POST /api/aria/properties — internal upsert called by the deep research route
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    await getCurrentUser()
    const { searchParams } = new URL(req.url)

    const limit         = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)
    const offset        = parseInt(searchParams.get('offset') ?? '0')
    const stage         = searchParams.get('stage')           // 'prospect','contacted',etc
    const urgency       = searchParams.get('urgency')         // 'critical','high','medium','low'
    const expiryBefore  = searchParams.get('expiry_before')   // year e.g. '2027'
    const expiryAfter   = searchParams.get('expiry_after')
    const search        = searchParams.get('search')          // free text (name/mgmt/address)
    const sara          = searchParams.get('sara') === 'true'
    const orderBy       = searchParams.get('order_by') ?? 'last_researched_at'
    const dir           = searchParams.get('dir') === 'asc'

    let query = supabase
      .from('aria_properties')
      .select('*', { count: 'exact' })
      .order(orderBy, { ascending: dir })
      .range(offset, offset + limit - 1)

    if (stage)        query = query.eq('sales_stage', stage)
    if (urgency)      query = query.eq('urgency', urgency)
    if (sara)         query = query.eq('sara_signals', true)
    if (expiryBefore) query = query.lte('contract_expiry_year', parseInt(expiryBefore))
    if (expiryAfter)  query = query.gte('contract_expiry_year', parseInt(expiryAfter))
    if (search) {
      query = query.or(
        `property_name.ilike.%${search}%,management_company.ilike.%${search}%,address.ilike.%${search}%,owner_entity.ilike.%${search}%`
      )
    }

    const { data, error, count } = await query

    if (error) {
      if (error.code === '42P01') return NextResponse.json({ properties: [], total: 0 })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ properties: data ?? [], total: count ?? 0 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── Internal upsert — called by deep research route ──────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const prospects: any[] = body.prospects ?? []

    if (!prospects.length) return NextResponse.json({ upserted: 0 })

    let upserted = 0
    const techProviderUpdates: Map<string, { category: string; names: string[] }> = new Map()

    for (const p of prospects) {
      const prop    = p.property ?? {}
      const dm      = p.decision_maker ?? {}
      const profile = p.profile ?? {}
      const pt      = prop.proptech ?? {}

      // Collect new tech providers discovered (for auto-catalog growth)
      const techCategories: [string, string[]][] = [
        ['gate',           pt.gate_operators     ?? []],
        ['access_control', pt.access_control     ?? []],
        ['intercom',       pt.intercoms          ?? []],
        ['camera',         pt.cameras            ?? []],
        ['smart_lock',     pt.smart_locks        ?? []],
        ['resident_app',   pt.resident_apps      ?? []],
        ['package',        pt.package_solutions  ?? []],
      ]
      for (const [cat, vendors] of techCategories) {
        for (const vendor of vendors) {
          const slug = vendor.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
          if (!techProviderUpdates.has(slug)) {
            techProviderUpdates.set(slug, { category: cat, names: [vendor] })
          }
        }
      }

      // Extract contract expiry year from bulk_agreements or contract_window
      let contractExpiryYear: number | null = null
      const bulkAgreements: any[] = prop.bulk_agreements ?? []
      for (const agreement of bulkAgreements) {
        const expiry = agreement.expiry_estimate ?? ''
        const yearMatch = expiry.match(/\b(202\d|203\d)\b/)
        if (yearMatch) {
          const y = parseInt(yearMatch[1])
          if (!contractExpiryYear || y < contractExpiryYear) contractExpiryYear = y
        }
      }
      // Also try contract_window field like "Q1 2026", "mid-2027", "18 months"
      if (!contractExpiryYear && profile.contract_window) {
        const cw = profile.contract_window as string
        const yearMatch = cw.match(/\b(202\d|203\d)\b/)
        if (yearMatch) contractExpiryYear = parseInt(yearMatch[1])
        else if (/6\s*months?/i.test(cw)) contractExpiryYear = new Date().getFullYear()
        else if (/1\s*year|12\s*months?/i.test(cw)) contractExpiryYear = new Date().getFullYear() + 1
        else if (/2\s*years?|18\s*months?/i.test(cw)) contractExpiryYear = new Date().getFullYear() + 2
      }

      const upsertData: Record<string, any> = {
        property_name:         prop.name ?? 'Unknown Property',
        address:               prop.address ?? '',
        units:                 prop.units ?? null,
        property_type:         prop.property_type ?? null,
        class:                 prop.class ?? null,
        year_built:            prop.year_built ?? null,
        occupancy:             prop.occupancy ?? null,
        management_company:    prop.management_company ?? null,
        owner_entity:          prop.owner_entity ?? null,
        owner_type:            p.ownership?.owner_type ?? null,
        portfolio_size:        p.ownership?.portfolio_size ?? null,
        acquisition_year:      p.ownership?.acquisition_year ? parseInt(p.ownership.acquisition_year) : null,
        hold_period:           p.ownership?.hold_period ?? null,
        capex_signal:          p.ownership?.capex_signal ?? null,
        dnb_duns:              p.ownership?.dnb_duns ?? null,
        isp_providers:         prop.isp_providers ?? null,
        video_providers:       prop.video_providers ?? null,
        bulk_agreements:       bulkAgreements.length ? bulkAgreements : null,
        fcc_verified:          prop._fcc_verified ?? false,
        gate_operators:        pt.gate_operators ?? null,
        access_control:        pt.access_control ?? null,
        intercoms:             pt.intercoms ?? null,
        cameras:               pt.cameras ?? null,
        smart_locks:           pt.smart_locks ?? null,
        resident_apps:         pt.resident_apps ?? null,
        package_solutions:     pt.package_solutions ?? null,
        tech_generation:       pt.tech_generation ?? null,
        sara_signals:          pt.sara_signals ?? false,
        replacement_window:    pt.replacement_window ?? null,
        displacement_targets:  pt.displacement_targets ?? null,
        buy_score:             profile.buy_score ?? null,
        urgency:               profile.urgency ?? null,
        primary_concern:       profile.primary_concern ?? null,
        current_vendor:        profile.current_vendor ?? null,
        contract_window:       profile.contract_window ?? null,
        contract_expiry_year:  contractExpiryYear,
        communication_style:   profile.communication_style ?? null,
        pain_signals:          p.pain_signals ?? null,
        behavioral_profile:    p.behavioral_profile ?? null,
        pitch_strategy:        p.pitch_strategy ?? null,
        freshness_score:       p.freshness_score ?? null,
        dm_name:               dm.name ?? null,
        dm_title:              dm.title ?? null,
        dm_company:            dm.company ?? null,
        dm_email:              dm.email ?? dm.top_email_format ?? null,
        dm_phone:              dm.phone ?? null,
        dm_linkedin_slug:      dm.linkedin_slug ?? null,
        dm_chain:              p.decision_maker_chain ?? null,
        scout_brief:           p.scout_brief ?? null,
        last_researched_at:    new Date().toISOString(),
        updated_at:            new Date().toISOString(),
      }

      // Use a raw RPC for the increment + upsert since Supabase JS can't do
      // "increment times_researched only on conflict"
      const { error: upsertErr } = await supabase
        .from('aria_properties')
        .upsert(upsertData, {
          onConflict: 'property_name,address',
          ignoreDuplicates: false,
        })

      // Bump the counter separately for existing rows
      void (async () => {
        try {
          await supabase.rpc('increment_aria_property_research_count', {
            p_name: upsertData.property_name,
            p_addr: upsertData.address,
          })
        } catch (_) {}
      })()

      if (!upsertErr) upserted++
    }

    // ── Auto-grow the tech provider catalog ─────────────────────────────────
    for (const [slug, { category, names }] of techProviderUpdates) {
      await supabase
        .from('aria_tech_providers')
        .upsert(
          {
            slug,
            name:          names[0],
            category,
            last_seen_at:  new Date().toISOString(),
          },
          { onConflict: 'slug', ignoreDuplicates: false }
        )
      // Increment detection count
      void (async () => {
        try {
          await supabase.rpc('increment_aria_tech_provider_count', { p_slug: slug })
        } catch (_) {}
      })()
    }

    return NextResponse.json({ upserted, tech_providers_seen: techProviderUpdates.size })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
