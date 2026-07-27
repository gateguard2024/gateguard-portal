/**
 * Shared ARIA property upsert.
 *
 * This used to live inside the POST handler of /api/aria/properties, and the
 * deep research route reached it by fetching `${baseUrl}/api/aria/properties`
 * — an HTTP call the route made TO ITSELF. When NEXT_PUBLIC_APP_URL was unset
 * that baseUrl fell back to http://localhost:3000, which on Vercel connects to
 * nothing; the error was swallowed and NOTHING was ever saved. The write logic
 * lives here now so callers invoke it directly, in-process, with no network hop.
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Constraint guards ────────────────────────────────────────────────────────
// aria_properties has CHECK constraints. Postgres rejects the ENTIRE row if any
// one value falls outside them — so a single out-of-range number silently killed
// every save. This is exactly what happened: the engine scores buy_score on a
// 0–100 scale, the column is `CHECK (buy_score BETWEEN 0 AND 10)`, and every
// deep research write died on `aria_properties_buy_score_check`. Nothing was
// ever stored. Coerce to what the DB actually accepts — never hand it a value
// we haven't validated.

/** buy_score → 0–10. Accepts the engine's 0–100 scale and rescales it. */
function safeBuyScore(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return null
  const scaled = n > 10 ? n / 10 : n          // 85 (0–100) → 8.5
  return Math.max(0, Math.min(10, Math.round(scaled)))
}

/** freshness_score → 1–5 (CHECK BETWEEN 1 AND 5). */
function safeFreshness(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return null
  const scaled = n > 5 ? Math.round((n / 100) * 5) : n   // tolerate a 0–100 scale
  return Math.max(1, Math.min(5, Math.round(scaled) || 1))
}

/** Only let through values the CHECK constraint actually permits. */
function safeEnum(v: unknown, allowed: readonly string[]): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim().toLowerCase()
  return allowed.includes(s) ? s : null
}
const URGENCY_VALUES   = ['critical', 'high', 'medium', 'low'] as const
const TECH_GEN_VALUES  = ['legacy', 'modern', 'hybrid'] as const

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

export interface AriaUpsertResult {
  upserted: number
  failed: number
  errors: string[]
  tech_providers_seen: number
}

/** Merge-upsert ARIA prospects into aria_properties + auto-grow the tech catalog.
 * orgId stamps the researching org so reads can be isolated per-org (never
 * clobbers an org already on the row). */
export async function upsertAriaProperties(prospects: any[], orgId?: string | null): Promise<AriaUpsertResult> {
  if (!prospects?.length) return { upserted: 0, failed: 0, errors: [], tech_providers_seen: 0 }

  let upserted = 0
  const writeErrors: string[] = []
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
    // NOTE: .maybeSingle() errors to null when 2+ rows share a name, which
    // silently wiped the learning-loop merge (existing → null) and re-emitted
    // empty facts. Take the most recently researched match instead.
    const { data: existingRows } = await supabase
      .from('aria_properties')
      .select('*')
      .ilike('property_name', propName)
      .order('last_researched_at', { ascending: false, nullsFirst: false })
      .limit(1)
    const existing = existingRows?.[0] ?? null

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

    // ── Canonical record: facts (Data In) + deductions (Data Out) ─────────────
    // Uniform shape for every site. Facts = scraped/verified; deductions =
    // reasoning built on the facts. Arrays union with existing (never shrink).
    const exFacts = (existing?.facts ?? {}) as any
    const exDeduc = (existing?.deductions ?? {}) as any
    const unionBy = <T,>(ex: T[] | undefined, fr: T[] | undefined, key: (t: T) => string): T[] => {
      const map = new Map<string, T>()
      for (const it of (ex ?? [])) map.set(key(it), it)
      for (const it of (fr ?? [])) map.set(key(it), it) // fresh overrides same-key
      return Array.from(map.values())
    }
    const freshDMs: any[] = (p.decision_maker_chain?.length
      ? p.decision_maker_chain
      : (dm.name ? [{ name: dm.name, title: dm.title, company: dm.company, role_type: 'unknown', email: dm.email ?? dm.top_email_format, phone: dm.phone, linkedin_slug: dm.linkedin_slug }] : []))
    // Community posts can arrive on the prospect (p.social_posts) OR already be
    // on the row (written by /api/aria/social, which runs after this upsert).
    // Take whichever actually has data so a re-save never blanks Community.
    const freshCommunity: any[] =
      (Array.isArray(p.social_posts) && p.social_posts.length ? p.social_posts : null)
      ?? (Array.isArray(p.community_posts) && p.community_posts.length ? p.community_posts : null)
      ?? (Array.isArray(existing?.social_posts) && existing.social_posts.length ? existing.social_posts : null)
      ?? (Array.isArray(existing?.facts?.community_posts) ? existing.facts.community_posts : [])
    const freshInferred: any[]  = Array.isArray(prop.inferred_proptech) ? prop.inferred_proptech : []

    // Merge the proptech brand arrays once, reused for both the stored arrays and
    // the presence flags below.
    const mGate     = mergeArr(existing?.gate_operators,    pt.gate_operators)    ?? []
    const mAccess   = mergeArr(existing?.access_control,    pt.access_control)    ?? []
    const mIntercom = mergeArr(existing?.intercoms,         pt.intercoms)         ?? []
    const mCameras  = mergeArr(existing?.cameras,           pt.cameras)           ?? []
    const mLocks    = mergeArr(existing?.smart_locks,       pt.smart_locks)       ?? []
    const mApps     = mergeArr(existing?.resident_apps,     pt.resident_apps)     ?? []
    const mPackages = mergeArr(existing?.package_solutions, pt.package_solutions) ?? []
    // EV chargers live only in facts JSONB (no top-level column) — merge from there.
    const mEv       = mergeArr((exFacts?.proptech_found?.ev_chargers as string[] | undefined), pt.ev_chargers) ?? []

    const facts = {
      property: {
        name: propName, address: propAddr,
        city:  mergeVal(exFacts?.property?.city,  prop.city),
        state: mergeVal(exFacts?.property?.state, prop.state),
        units: mergeVal(existing?.units, prop.units),
        year_built: mergeVal(existing?.year_built, prop.year_built),
        occupancy:  mergeVal(existing?.occupancy, prop.occupancy),
        property_type: mergeVal(existing?.property_type, prop.property_type),
        class: mergeVal(existing?.class, prop.class),
        phone: mergeVal(exFacts?.property?.phone, prop.phone),
        website: mergeVal(exFacts?.property?.website, prop.website),
        management_company: mergeVal(existing?.management_company, prop.management_company),
        owner_entity: mergeVal(existing?.owner_entity, prop.owner_entity),
        last_sale: mergeVal(exFacts?.property?.last_sale, own.sale_price ?? null),
        last_sale_date: mergeVal(exFacts?.property?.last_sale_date, own.sale_date ?? null),
      },
      connectivity: {
        isp_providers:   mergedIspProviders ?? [],
        video_providers: mergedVideoProviders ?? [],
        bulk_agreements: mergedBulkAgreements ?? [],
        roe_detected:    prop.roe_detected || existing?.roe_detected || false,
        roe_providers:   mergedRoeProviders ?? [],
        roe_expiry_year: mergeVal(existing?.roe_expiry_year, prop.roe_expiry_year),
        fcc_verified:    prop._fcc_verified || existing?.fcc_verified || false,
        // Presence flags — "present, brand unknown" ≠ "no data found". Deep
        // research rebuilds this block, so preserve the base-find flags and OR in
        // whatever the arrays now prove.
        internet_present: (mergedIspProviders?.length ?? 0) > 0 || !!exFacts?.connectivity?.internet_present,
        video_present:    (mergedVideoProviders?.length ?? 0) > 0 || !!exFacts?.connectivity?.video_present,
        bulk_present:     (mergedBulkAgreements?.length ?? 0) > 0 || !!(prop.roe_detected || existing?.roe_detected) || !!exFacts?.connectivity?.bulk_present,
      },
      proptech_found: {
        gate_operators:    mGate,
        access_control:    mAccess,
        intercoms:         mIntercom,
        cameras:           mCameras,
        smart_locks:       mLocks,
        resident_apps:     mApps,
        package_solutions: mPackages,
        ev_chargers:       mEv,
        tech_generation:   mergeVal(existing?.tech_generation, pt.tech_generation),
        // Presence survives even when no brand was named (see note above). Never
        // let a deep run downgrade a base-find "present" to "unknown".
        gates_present:         mGate.length > 0 || mAccess.length > 0 || !!exFacts?.proptech_found?.gates_present,
        cameras_present:       mCameras.length > 0 || !!exFacts?.proptech_found?.cameras_present,
        smart_lockers_present: mPackages.length > 0 || !!exFacts?.proptech_found?.smart_lockers_present,
        smart_rent_present:    mLocks.length > 0 || !!exFacts?.proptech_found?.smart_rent_present,
        ev_chargers_present:   mEv.length > 0 || !!exFacts?.proptech_found?.ev_chargers_present,
      },
      decision_makers: unionBy<any>(exFacts?.decision_makers, freshDMs, d => (d?.name ?? '').toLowerCase()),
      ownership: {
        owner_entity:     mergeVal(existing?.owner_entity, own.owner_entity ?? prop.owner_entity),
        owner_type:       mergeVal(existing?.owner_type, own.owner_type),
        portfolio_size:   mergeVal(existing?.portfolio_size, own.portfolio_size),
        acquisition_year: mergeVal(existing?.acquisition_year, own.acquisition_year ? parseInt(own.acquisition_year) : null),
        capex_signal:     mergeVal(existing?.capex_signal, own.capex_signal),
      },
      community_posts: unionBy<any>(exFacts?.community_posts, freshCommunity, c => `${c?.quote ?? ''}|${c?.url ?? ''}`),
    }

    const deductions = {
      ai_intel: {
        key_finding:        mergeVal(exDeduc?.ai_intel?.key_finding, p.scout_queue?.key_finding ?? profile.primary_concern),
        buying_trends:      mergeVal(exDeduc?.ai_intel?.buying_trends, p.buying_trends),
        behavioral_profile: mergeVal(existing?.behavioral_profile, p.behavioral_profile),
        primary_concern:    mergeVal(existing?.primary_concern, profile.primary_concern),
        buy_score:          mergeVal(existing?.buy_score, profile.buy_score),
        urgency:            mergeVal(existing?.urgency, profile.urgency),
      },
      scout: {
        scout_brief:       mergeVal(existing?.scout_brief, p.scout_brief),
        pitch_strategy:    mergeVal(existing?.pitch_strategy, p.pitch_strategy),
        outreach_plan:     mergeVal(exDeduc?.scout?.outreach_plan, p.scout_queue?.outreach_plan),
        outreach_sequence: mergeVal(exDeduc?.scout?.outreach_sequence, p.scout_queue?.outreach_sequence),
      },
      proptech_inferred: unionBy<any>(exDeduc?.proptech_inferred, freshInferred, x => `${x?.category ?? ''}:${(x?.name ?? '').toLowerCase()}`),
    }

    const upsertData: Record<string, any> = {
      facts,
      deductions,
      // Stamp the researching org, but never overwrite an org already on the row.
      org_id:                existing?.org_id ?? orgId ?? null,
      property_name:         propName,
      address:               propAddr,
      // city/state were READ in 4 places but never WRITTEN — a phantom column.
      // That left every saved row with city = NULL, which silently disabled the
      // Community/social lookup (it requires a city). Always write them.
      city:                  mergeVal(existing?.city, prop.city),
      state:                 mergeVal(existing?.state, prop.state),
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
      // CHECK (tech_generation IN ('legacy','modern','hybrid')) — anything else kills the row.
      tech_generation:       safeEnum(mergeVal(existing?.tech_generation, pt.tech_generation), TECH_GEN_VALUES),
      sara_signals:          pt.sara_signals || existing?.sara_signals || false,
      replacement_window:    mergeVal(existing?.replacement_window, pt.replacement_window),
      displacement_targets:  mergeArr(existing?.displacement_targets, pt.displacement_targets),
      // Profile
      // CHECK (buy_score BETWEEN 0 AND 10). The engine scores 0–100 — writing 85
      // here threw aria_properties_buy_score_check and rejected the WHOLE row,
      // which is why nothing was ever saved. Rescale, don't trust.
      buy_score:             safeBuyScore(mergeVal(existing?.buy_score, profile.buy_score)),
      // CHECK (urgency IN ('critical','high','medium','low'))
      urgency:               safeEnum(mergeVal(existing?.urgency, profile.urgency), URGENCY_VALUES),
      primary_concern:       mergeVal(existing?.primary_concern, profile.primary_concern),
      current_vendor:        mergeVal(existing?.current_vendor, profile.current_vendor),
      contract_window:       mergeVal(existing?.contract_window, profile.contract_window),
      contract_expiry_year:  contractExpiryYear,
      communication_style:   mergeVal(existing?.communication_style, profile.communication_style),
      // Intelligence
      pain_signals:          (p.pain_signals?.length > 0) ? p.pain_signals : (existing?.pain_signals ?? null),
      behavioral_profile:    mergeVal(existing?.behavioral_profile, p.behavioral_profile),
      pitch_strategy:        mergeVal(existing?.pitch_strategy, p.pitch_strategy),
      // CHECK (freshness_score BETWEEN 1 AND 5)
      freshness_score:       safeFreshness(mergeVal(existing?.freshness_score, p.freshness_score)),
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

    // ── Write ────────────────────────────────────────────────────────────
    // NOTE: do NOT use .upsert({ onConflict: 'property_name,address' }) here.
    // The only unique index is an EXPRESSION index —
    //   (lower(trim(property_name)), lower(trim(address)))
    // — which Postgres cannot match to `ON CONFLICT (property_name, address)`.
    // That threw 42P10 on every write, and the error was swallowed, so this
    // route returned 200 { upserted: 0 } and nothing was ever saved. Resolve
    // the target row ourselves and do an explicit update/insert instead.
    let upsertErr: { message: string; code?: string } | null = null
    if (existing?.id) {
      const { error } = await supabase.from('aria_properties').update(upsertData).eq('id', existing.id)
      upsertErr = error
    } else {
      const { error } = await supabase.from('aria_properties').insert(upsertData)
      // 23505 = someone inserted the same identity concurrently → update it.
      if (error?.code === '23505') {
        const { data: raced } = await supabase
          .from('aria_properties').select('id')
          .ilike('property_name', propName).limit(1)
        if (raced?.[0]?.id) {
          const { error: e2 } = await supabase.from('aria_properties').update(upsertData).eq('id', raced[0].id)
          upsertErr = e2
        } else { upsertErr = error }
      } else {
        upsertErr = error
      }
    }

    if (upsertErr) {
      console.error(`[aria/properties] save FAILED for "${propName}": ${upsertErr.message}`)
      writeErrors.push(`${propName}: ${upsertErr.message}`)
    } else {
      upserted++
      // Bump the research counter (best-effort, must not fail the save).
      try {
        await supabase.rpc('increment_aria_property_research_count', {
          p_name: upsertData.property_name,
          p_addr: upsertData.address,
        })
      } catch { /* counter is non-critical */ }
    }
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

  return {
    upserted,
    failed: writeErrors.length,
    errors: writeErrors,
    tech_providers_seen: techProviderUpdates.size,
  }
}
