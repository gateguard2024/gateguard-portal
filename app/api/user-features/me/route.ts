/**
 * GET /api/user-features/me
 *
 * Returns the current user's effective feature access map — used by the Sidebar
 * to filter which nav items are visible.
 *
 * Response: { features: Record<string, 'none' | 'view' | 'edit'> }
 * Example:  { features: { "sales.crm": "edit", "field.dispatch": "view", "business.billing": "none" } }
 *
 * Logic:
 *   1. Get org_id + org_tier from Clerk publicMetadata
 *   2. Get org feature flags (or derive from tier_defaults if no override)
 *   3. Get user feature access overrides for this user+org
 *   4. Effective = min(org_level, user_override ?? org_level)
 *
 * No auth required beyond Clerk session — returns empty map for unauthenticated.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

const ACCESS_RANK: Record<string, number> = { none: 0, view: 1, edit: 2 }

function capLevel(a: string, b: string): string {
  return ACCESS_RANK[a] <= ACCESS_RANK[b] ? a : b
}

export async function GET() {
  try {
    const caller = await getCurrentUser()

    // Corporate admins get full edit access to everything
    if (caller.isCorporate) {
      const { data: catalog } = await supabase
        .from('feature_catalog')
        .select('key')
        .eq('is_active', true)
      const features: Record<string, string> = {}
      for (const f of catalog ?? []) features[f.key] = 'edit'
      return NextResponse.json({ features })
    }

    const orgId   = caller.org_id
    const orgTier = caller.org_tier ?? 'full_dealer'

    if (!orgId) return NextResponse.json({ features: {} })

    // Full feature catalog (key + tier_defaults only — lightweight)
    const { data: catalog } = await supabase
      .from('feature_catalog')
      .select('key, tier_defaults')
      .eq('is_active', true)

    // Org feature flags
    const { data: orgFlags } = await supabase
      .from('org_feature_flags')
      .select('feature_key, access_level, expires_at')
      .eq('org_id', orgId)

    // Filter out expired flags
    const now = Date.now()
    const orgFlagMap = new Map(
      (orgFlags ?? [])
        .filter((f: any) => !f.expires_at || new Date(f.expires_at).getTime() > now)
        .map((f: any) => [f.feature_key, f.access_level])
    )

    // User overrides
    const { data: userFlags } = await supabase
      .from('user_feature_access')
      .select('feature_key, access_level')
      .eq('clerk_user_id', caller.id)
      .eq('org_id', orgId)
    const userFlagMap = new Map((userFlags ?? []).map((f: any) => [f.feature_key, f.access_level]))

    const features: Record<string, string> = {}
    for (const f of catalog ?? []) {
      const tierDefault = (f.tier_defaults ?? {})[orgTier] ?? 'none'
      const orgLevel    = orgFlagMap.has(f.key) ? orgFlagMap.get(f.key)! : tierDefault
      const userLevel   = userFlagMap.get(f.key) ?? orgLevel
      features[f.key]   = capLevel(userLevel, orgLevel)
    }

    return NextResponse.json({ features })
  } catch {
    return NextResponse.json({ features: {} })
  }
}
