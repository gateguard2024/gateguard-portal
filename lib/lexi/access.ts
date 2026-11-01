/**
 * Who can use Lexi, and how much.
 *
 *   Gate Guard corporate → always 'edit' (full Lexi).
 *   Everyone else        → the 'ai.lexi' feature (migration 203), resolved exactly
 *                          like the sidebar does (tier default → company override →
 *                          per-user override, capped by role — lib/permissions.ts).
 *                          Off ('none') by default for every dealer tier, so Gate
 *                          Guard turns it on dealer by dealer (Dealer → Features tab).
 *
 *   'view' = Lexi can look things up and answer, but can't make changes.
 *   'edit' = full Lexi, including actions (each still scoped + undoable).
 */
import { createClient } from '@supabase/supabase-js'
import type { PortalUser } from '@/lib/current-user'
import { effectiveAccess, normalizeRole, type AccessLevel } from '@/lib/permissions'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export const LEXI_FEATURE = 'ai.lexi'
export const LEXI_OFF_MESSAGE = 'Lexi isn’t turned on for your company yet. Ask Gate Guard to enable it.'

export async function lexiAccess(user: PortalUser): Promise<AccessLevel> {
  if (!user.id || user.id === 'anonymous') return 'none'
  if (user.isCorporate) return 'edit'
  if (!user.org_id) return 'none'
  const tier = user.org_tier ?? 'full_dealer'
  const [cat, org, usr] = await Promise.all([
    sb.from('feature_catalog').select('tier_defaults, is_active').eq('key', LEXI_FEATURE).maybeSingle(),
    sb.from('org_feature_flags').select('access_level, expires_at').eq('org_id', user.org_id).eq('feature_key', LEXI_FEATURE).maybeSingle(),
    sb.from('user_feature_access').select('access_level').eq('clerk_user_id', user.id).eq('org_id', user.org_id).eq('feature_key', LEXI_FEATURE).maybeSingle(),
  ])
  // Fail closed: if the feature isn't in the catalog (migration not run) or a read fails, no Lexi.
  if (cat.error || !cat.data || cat.data.is_active === false) return 'none'
  const tierDefault = (((cat.data.tier_defaults ?? {}) as Record<string, AccessLevel>)[tier] ?? 'none') as AccessLevel
  const live = org.data && (!org.data.expires_at || new Date(org.data.expires_at).getTime() > Date.now())
  const orgLevel = (live ? org.data!.access_level : tierDefault) as AccessLevel
  const userOverride = (usr.data?.access_level ?? null) as AccessLevel | null
  return effectiveAccess({ role: normalizeRole(user.role), featureKey: LEXI_FEATURE, orgLevel, userOverride })
}
