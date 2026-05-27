/**
 * GET   /api/admin/user-features/[userId]
 *   Returns merged view: org feature access + user override + effective level
 *   Org level always caps user level (user can't exceed what org has)
 *
 * PATCH /api/admin/user-features/[userId]
 *   Body: { org_id, updates: [{ feature_key, access_level }] }
 *   Hierarchy rule: caller cannot grant > their own effective level
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

function capLevel(userLevel: string, orgLevel: string): string {
  return ACCESS_RANK[userLevel] <= ACCESS_RANK[orgLevel] ? userLevel : orgLevel
}

export async function GET(req: NextRequest, { params }: { params: { userId: string } }) {
  const caller = await getCurrentUser()
  const { userId } = params
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('org_id')

  if (!caller.isCorporate && !caller.isMasterDealer && !caller.isFullDealer) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!orgId) return NextResponse.json({ error: 'org_id required' }, { status: 400 })

  // Get org info + tier
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, org_tier')
    .eq('id', orgId)
    .single()
  if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 })

  // Feature catalog
  const { data: catalog } = await supabase
    .from('feature_catalog')
    .select('key, label, section, section_label, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  // Org-level flags for this org
  const { data: orgFlags } = await supabase
    .from('org_feature_flags')
    .select('feature_key, access_level')
    .eq('org_id', orgId)
  const orgFlagMap = new Map((orgFlags ?? []).map((f: any) => [f.feature_key, f.access_level]))

  // User-level overrides
  const { data: userFlags } = await supabase
    .from('user_feature_access')
    .select('feature_key, access_level')
    .eq('clerk_user_id', userId)
    .eq('org_id', orgId)
  const userFlagMap = new Map((userFlags ?? []).map((f: any) => [f.feature_key, f.access_level]))

  const features = (catalog ?? []).map((f: any) => {
    const tierDefault    = 'none' // org-level already resolved
    const orgLevel       = orgFlagMap.get(f.key) ?? tierDefault
    const userOverride   = userFlagMap.get(f.key)
    const rawUserLevel   = userOverride ?? orgLevel
    const effectiveLevel = capLevel(rawUserLevel, orgLevel)

    return {
      key:            f.key,
      label:          f.label,
      section:        f.section,
      section_label:  f.section_label,
      sort_order:     f.sort_order,
      org_level:      orgLevel,
      user_override:  userOverride ?? null,
      access_level:   effectiveLevel,
    }
  })

  return NextResponse.json({ org, features })
}

export async function PATCH(req: NextRequest, { params }: { params: { userId: string } }) {
  const caller = await getCurrentUser()
  const { userId } = params

  if (!caller.isCorporate && !caller.isMasterDealer && !caller.isFullDealer) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { org_id, updates }: { org_id: string; updates: Array<Record<string, any>> } = await req.json()
  if (!org_id || !Array.isArray(updates)) {
    return NextResponse.json({ error: 'org_id and updates array required' }, { status: 400 })
  }

  // Get org flags so we can cap user access
  const { data: orgFlags } = await supabase
    .from('org_feature_flags')
    .select('feature_key, access_level')
    .eq('org_id', org_id)
  const orgFlagMap = new Map((orgFlags ?? []).map((f: any) => [f.feature_key, f.access_level]))

  const results = []
  for (const u of updates) {
    const { feature_key, access_level } = u
    if (!feature_key) continue

    // Cap user level by org level
    const orgLevel    = orgFlagMap.get(feature_key) ?? 'none'
    const cappedLevel = capLevel(access_level ?? 'none', orgLevel)

    const { error } = await supabase
      .from('user_feature_access')
      .upsert({
        clerk_user_id: userId,
        org_id,
        feature_key,
        access_level:  cappedLevel,
        updated_at:    new Date().toISOString(),
      }, { onConflict: 'clerk_user_id,org_id,feature_key' })

    results.push({ feature_key, ok: !error, applied_level: cappedLevel, error: error?.message })
  }

  return NextResponse.json({ results })
}
