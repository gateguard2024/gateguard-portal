/**
 * GET  /api/aria/properties — paginated list of all discovered properties
 * ?limit=50&offset=0&stage=prospect&urgency=high&expiry_before=2027&search=greystar
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

// ── Merge helpers (learning loop — never destroy confirmed data) ──────────────

/** Take fresh value unless it's empty/null, then fall back to existing */
function mergeVal<T>(existing: T | null | undefined, fresh: T | null | undefined): T | null {
  if (fresh !== null && fresh !== undefined) {
    if (Array.isArray(fresh) && (fresh as unknown[]).length === 0) return (existing as T | null) ?? null
    if (typeof fresh === 'string' && fresh.trim() === '') return (existing as T | null) ?? null
    return fresh
  }
  return (existing as T | null) ?? null
}

/** Union two string arrays, deduplicated — never shrink */
function mergeArr(existing: string[] | null | undefined, fresh: string[] | null | undefined): string[] | null {
  const e = (existing ?? []).filter(Boolean)
  const f = (fresh ?? []).filter(Boolean)
  const merged = [...new Set([...e, ...f])]
  return merged.length > 0 ? merged : null
}

/** Merge bulk_agreements: keep existing entries, add new ones not already present */
function mergeBulkAgreements(existing: any[] | null | undefined, fresh: any[] | null | undefined): any[] | null {
  const e = existing ?? []
  const f = fresh ?? []
  if (f.length === 0) return e.length > 0 ? e : null
  if (e.length === 0) return f.length > 0 ? f : null
  // Merge: fresh entries take precedence for same provider+service_type
  const result = [...e]
  for (const freshItem of f) {
    const key = `${(freshItem.provider ?? '').toLowerCase()}:${freshItem.service_type ?? ''}`
    const existingIdx = result.findIndex(ei =>
      `${(ei.provider ?? '').toLowerCase()}:${ei.service_type ?? ''}` === key
    )
    if (existingIdx >= 0) {
      // Merge: keep higher-confidence version, prefer user-verified
      const ex = result[existingIdx]
      const fConfidence = freshItem.confidence === 'high' ? 3 : freshItem.confidence === 'medium' ? 2 : 1
      const eConfidence = ex.confidence === 'high' ? 3 : ex.confidence === 'medium' ? 2 : 1
      // Prefer expiry_estimate with an actual year
      const freshHasYear = /20\d{2}/.test(freshItem.expiry_estimate ?? '')
      const existingHasYear = /20\d{2}/.test(ex.expiry_estimate ?? '')
      result[existingIdx] = {
        ...ex,
        ...freshItem,
        // Preserve expiry year if existing has one and fresh doesn't
        expiry_estimate: (freshHasYear ? freshItem.expiry_estimate : null) ?? (existingHasYear ? ex.expiry_estimate : null) ?? freshItem.expiry_estimate ?? ex.expiry_estimate,
        // Preserve user_verified flag
        user_verified: ex.user_verified ?? freshItem.user_verified ?? false,
        // Keep higher confidence
        confidence: fConfidence >= eConfidence ? freshItem.confidence : ex.confidence,
      }
    } else {
      result.push(freshItem)
    }
  }
  return result
}

// ── Internal upsert — called by deep research route ──────────────────────────
export async function POST(req: NextRequest) {
  try {
    // Auth: accept either a valid Clerk session OR the internal service key
    const serviceKey = req.headers.get('x-service-key')
    const validServiceKey = process.env.ARIA_SERVICE_KEY
    if (!serviceKey || !validServiceKey || serviceKey !== validServiceKey) {
      // Fall back to Clerk auth for portal calls
      try { await getCurrentUser() } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const body = await req.json()
    const prospects: any[] = body.prospects ?? []

    if (!prospects.length) return NextResponse.json({ upserted: 0 })

    let upserted = 0
    const techProviderUpdates: Map<string, { category: string; names: string[] }> = new Map()

    for (const p of prospects) {
      // Robust fallbacks to prevent mapping errors from partial AI payloads
      const prop    = p.property ?? {}
      const dm      = p.decision_maker ?? {}
      const profile = p.profile ?? {}
      const pt      = prop.proptech ?? {}
      const own     = p.ownership ?? {}

      // ── Fetch existing record first (learning loop: never overwrite good data) ──
      const propName = prop.name ?? 'Unknown Property'
      const propAddr = prop.address ?? ''
      const { data: existing } = await supabase
        .from('aria_properties')
        .select('*')
        .ilike('property_name', propName)
        .maybeSingle()

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
          if (!vendor) continue
          const slug = vendor.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
          if (!techProviderUpdates.has(slug)) {
            techProviderUpdates.set(slug, { category: cat, names: [vendor] })
          }
        }
      }

      // Extract contract expiry year — prefer roe_expiry_year, then bulk_agreements
      let contractExpiryYear: number | null = prop.roe_expiry_year ?? null
      const bulkAgreements: any[] = prop.bulk_agreements ?? []

      if (!contractExpiryYear) {
        for (const agreement of bulkAgreements) {
          const expiry = agreement?.expiry_estimate ?? ''
          const yearMatch = expiry.match(/\b(202\d|203\d)\b/)
          if (yearMatch) {
            const y = parseInt(yearMatch[1])
            if (!contractExpiryYear || y < contractExpiryYear) contractExpiryYear = y
          }
        }
      }

      // Also try contract_window field
      if (!contractExpiryYear && profile.contract_window) {
        const cw = profile.contract_window as string
        const yearMatch = cw.match(/\b(202\d|203\d)\b/)
        if (yearMatch) contractExpiryYear = parseInt(yearMatch[1])
        else if (/6\s*months?/i.test(cw)) contractExpiryYear = new Date().getFullYear()
        else if (/1\s*year|12\s*months?/i.test(cw)) contractExpiryYear = new Date().getFullYear() + 1
        else if (/2\s*years?|18\s*months?/i.test(cw)) contractExpiryYear = new Date().getFullYear() + 2
      }

      // Prefer existing confirmed contract expiry year unless new search found one
      if (!contractExpiryYear && existing?.contract_expiry_year) {
        contractExpiryYear = existing.contract_expiry_year
      }

      // ── Smart merge: new data takes precedence, but NEVER shrink arrays or null confirmed fields ──
      const mergedBulkAgreements = mergeBulkAgreements(existing?.bulk_agreements, bulkAgreements.length ? bulkAgreements : null)
      const mergedIspProviders   = mergeArr(existing?.isp_providers, prop.isp_providers)
      const mergedVideoProviders = mergeArr(existing?.video_providers, prop.video_providers)
      const mergedRoeProviders   = mergeArr(existing?.roe_providers, prop.roe_providers)

      const upsertData: Record<string, any> = {
        property_name:         propName,
        address:               propAddr,
        units:                 mergeVal(existing?.units, prop.units),
        property_type:         mergeVal(existing?.property_type, prop.property_type),
        class:                 mergeVal(existing?.class, prop.class),
        year_built:            mergeVal(existing?.year_built, prop.year_built),
        occupancy:             mergeVal(existing?.occupancy, prop.occupancy),
        management_company:    mergeVal(existing?.management_company, prop.management_company),
        owner_entity:          mergeVal(existing?.owner_entity, prop.owner_entity),
        owner_type:            mergeVal(existing?.owner_type, own.owner_type),
        portfolio_size:        mergeVal(existing?.portfolio_size, own.portfolio_size),
        acquisition_year:      mergeVal(existing?.acquisition_year, own.acquisition_year ? parseInt(own.acquisition_year) : null),
        hold_period:           mergeVal(existing?.hold_period, own.hold_period),
        capex_signal:          mergeVal(existing?.capex_signal, own.capex_signal),
        dnb_duns:              mergeVal(existing?.dnb_duns, own.dnb_duns),
        // ISP/video/ROE — always union, never shrink
        isp_providers:         mergedIspProviders,
        video_providers:       mergedVideoProviders,
        bulk_agreements:       mergedBulkAgreements,
        roe_detected:          prop.roe_detected || existing?.roe_detected || false,
        roe_providers:         mergedRoeProviders,
        roe_expiry_year:       mergeVal(existing?.roe_expiry_year, prop.roe_expiry_year),
        fcc_verified:          prop._fcc_verified || existing?.fcc_verified || false,
        // PropTech — union arrays
        gate_operators:        mergeArr(existing?.gate_operators, pt.gate_operators),
        access_control:        mergeArr(existing?.access_control, pt.access_control),
        intercoms:             mergeArr(existing?.intercoms, pt.intercoms),
        cameras:               mergeArr(existing?.cameras, pt.cameras),
        smart_locks:           mergeArr(existing?.smart_locks, pt.smart_locks),
        resident_apps:         mergeArr(existing?.resident_apps, pt.resident_apps),
        package_solutions:     mergeArr(existing?.package_solutions, pt.package_solutions),
        tech_generation:       mergeVal(existing?.tech_generation, pt.tech_generation),
        sara_signals:          pt.sara_signals || existing?.sara_signals || false,
        replacement_window:    mergeVal(existing?.replacement_window, pt.replacement_window),
        displacement_targets:  mergeArr(existing?.displacement_targets, pt.displacement_targets),
        // Profile
        buy_score:             mergeVal(existing?.buy_score, profile.buy_score),
        urgency:               mergeVal(existing?.urgency, profile.urgency),
        primary_concern:       mergeVal(existing?.primary_concern, profile.primary_concern),
        current_vendor:        mergeVal(existing?.current_vendor, profile.current_vendor),
        contract_window:       mergeVal(existing?.contract_window, profile.contract_window),
        contract_expiry_year:  contractExpiryYear,
        communication_style:   mergeVal(existing?.communication_style, profile.communication_style),
        // Intelligence
        pain_signals:          (p.pain_signals?.length > 0) ? p.pain_signals : (existing?.pain_signals ?? null),
        behavioral_profile:    mergeVal(existing?.behavioral_profile, p.behavioral_profile),
        pitch_strategy:        mergeVal(existing?.pitch_strategy, p.pitch_strategy),
        freshness_score:       mergeVal(existing?.freshness_score, p.freshness_score),
        // Decision maker — only update if new data has a name (don't clobber user-verified contacts)
        dm_name:               existing?.dm_name_user_verified ? existing.dm_name : mergeVal(existing?.dm_name, dm.name),
        dm_title:              existing?.dm_name_user_verified ? existing.dm_title : mergeVal(existing?.dm_title, dm.title),
        dm_company:            existing?.dm_name_user_verified ? existing.dm_company : mergeVal(existing?.dm_company, dm.company),
        dm_email:              existing?.dm_email_user_verified ? existing.dm_email : mergeVal(existing?.dm_email, dm.email ?? dm.top_email_format),
        dm_phone:              existing?.dm_phone_user_verified ? existing.dm_phone : mergeVal(existing?.dm_phone, dm.phone),
        dm_linkedin_slug:      mergeVal(existing?.dm_linkedin_slug, dm.linkedin_slug),
        dm_chain:              (p.decision_maker_chain?.length > 0) ? p.decision_maker_chain : (existing?.dm_chain ?? null),
        scout_brief:           mergeVal(existing?.scout_brief, p.scout_brief),
        last_researched_at:    new Date().toISOString(),
        updated_at:            new Date().toISOString(),
      }

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