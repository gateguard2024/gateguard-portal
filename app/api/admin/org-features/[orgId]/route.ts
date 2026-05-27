/**
 * GET   /api/admin/org-features/[orgId]
 *   Returns merged view: feature_catalog + org override (if any) + effective access level
 *   Accessible by: GateGuard corp admin, MSO/Full Dealer (their own network only)
 *
 * PATCH /api/admin/org-features/[orgId]
 *   Body: { updates: [{ feature_key, access_level, is_promo?, expires_at?, notes? }] }
 *   Hierarchy rule: caller cannot grant access_level > their own effective level for that feature
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

const ACCESS_RANK: Record<string, number> = { none: 0, view: 1, edit: 2 }

export async function GET(_req: NextRequest, { params }: { params: { orgId: string } }) {
  const caller = await getCurrentUser()
  const { orgId } = params

  // Corporate: full access. MSO/Full Dealer: own network only.
  if (!caller.isCorporate && !caller.isMasterDealer && !caller.isFullDealer) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch the org to confirm tier
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, org_tier')
    .eq('id', orgId)
    .single()
  if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 })

  // Full feature catalog
  const { data: catalog } = await supabase
    .from('feature_catalog')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  // Org-specific overrides
  const { data: overrides } = await supabase
    .from('org_feature_flags')
    .select('*')
    .eq('org_id', orgId)

  const overrideMap = new Map((overrides ?? []).map((o: any) => [o.feature_key, o]))

  // Merge: if org has an override use it, otherwise derive from tier_defaults
  const features = (catalog ?? []).map((f: any) => {
    const override = overrideMap.get(f.key)
    const tierDefault = (f.tier_defaults ?? {})[org.org_tier] ?? 'none'
    const effectiveLevel = override ? override.access_level : tierDefault
    return {
      ...f,
      tier_default:  tierDefault,
      override:      override ?? null,
      access_level:  effectiveLevel,
      is_overridden: !!override,
    }
  })

  return NextResponse.json({ org, features })
}

export async function PATCH(req: NextRequest, { params }: { params: { orgId: string } }) {
  const caller = await getCurrentUser()
  const { orgId } = params

  if (!caller.isCorporate && !caller.isMasterDealer && !caller.isFullDealer) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { updates }: { updates: Array<Record<string, any>> } = await req.json()
  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: 'updates array required' }, { status: 400 })
  }

  // For non-corporate callers: fetch their own org's feature flags to enforce hierarchy
  let callerOrgFlags: Map<string, string> | null = null
  if (!caller.isCorporate && caller.org_id) {
    const { data: callerFlags } = await supabase
      .from('org_feature_flags')
      .select('feature_key, access_level')
      .eq('org_id', caller.org_id)
    callerOrgFlags = new Map((callerFlags ?? []).map((f: any) => [f.feature_key, f.access_level]))
  }

  const results = []
  for (const u of updates) {
    const { feature_key, access_level, is_promo, expires_at, notes, promo_reason } = u
    if (!feature_key) continue

    // Hierarchy check: can't grant more than you have
    if (callerOrgFlags !== null) {
      const callerLevel = callerOrgFlags.get(feature_key) ?? 'none'
      if ((ACCESS_RANK[access_level] ?? 0) > (ACCESS_RANK[callerLevel] ?? 0)) {
        results.push({ feature_key, ok: false, error: `Cannot grant '${access_level}' — your own access is '${callerLevel}'` })
        continue
      }
    }

    const { error } = await supabase
      .from('org_feature_flags')
      .upsert({
        org_id:       orgId,
        feature_key,
        access_level: access_level ?? 'none',
        is_promo:     is_promo ?? false,
        promo_reason: promo_reason ?? null,
        expires_at:   expires_at ?? null,
        notes:        notes ?? null,
        updated_by:   caller.id,
        updated_at:   new Date().toISOString(),
      }, { onConflict: 'org_id,feature_key' })

    results.push({ feature_key, ok: !error, error: error?.message })
  }

  return NextResponse.json({ results })
}
