/**
 * /api/nexus/internal/user-window/[id]
 *
 * Backend for the Users & Access glass window (Internal admin hub).
 * [id] = profiles.id (UUID).
 *
 * GET  → assembles the target user's identity, org, current role, the org's
 *        feature access cap, the user's explicit overrides, and the CALLER's
 *        grantable ceiling. The window computes role-preset previews client-side
 *        via lib/permissions.
 * POST → { action: 'set_role' | 'set_feature_access' | 'clear_feature_access' }
 *        all guarded by the Phase 1 permission helpers.
 *
 * Authoritative system: feature_catalog / org_feature_flags / user_feature_access
 * + Clerk publicMetadata.role. The legacy can_see_* path is NOT touched here.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { clerkClient } from '@clerk/nextjs/server'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'
import {
  normalizeRole, rolePresetAccess, capAccess, canManageOrg, canInviteUser,
  canAssignFeature, type AccessLevel, type SimpleRole,
} from '@/lib/permissions'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const LEVELS: AccessLevel[] = ['none', 'view', 'edit']
const SIMPLE_ROLES: SimpleRole[] = ['admin', 'supervisor', 'user']

type CatalogRow = { key: string; label: string; section: string; section_label: string; sort_order: number; tier_defaults: Record<string, string> }

/** Org's effective access for every feature: tier default, overridden by non-expired org flags. */
async function computeOrgAccess(orgTier: string, orgId: string, catalog: CatalogRow[]): Promise<Record<string, AccessLevel>> {
  const { data: flags } = await supabase
    .from('org_feature_flags')
    .select('feature_key, access_level, expires_at')
    .eq('org_id', orgId)
  const now = Date.now()
  const flagMap = new Map(
    (flags ?? [])
      .filter((f: any) => !f.expires_at || new Date(f.expires_at).getTime() > now)
      .map((f: any) => [f.feature_key, f.access_level as AccessLevel])
  )
  const out: Record<string, AccessLevel> = {}
  for (const f of catalog) {
    out[f.key] = (flagMap.get(f.key) ?? (f.tier_defaults?.[orgTier] ?? 'none')) as AccessLevel
  }
  return out
}

/** A user's effective access map (role preset over org access, raised by overrides, capped at org). */
async function computeUserEffective(
  clerkUserId: string, orgId: string, role: SimpleRole, orgAccess: Record<string, AccessLevel>, catalog: CatalogRow[],
): Promise<Record<string, AccessLevel>> {
  const { data: overrides } = await supabase
    .from('user_feature_access')
    .select('feature_key, access_level')
    .eq('clerk_user_id', clerkUserId)
    .eq('org_id', orgId)
  const ov = new Map((overrides ?? []).map((o: any) => [o.feature_key, o.access_level as AccessLevel]))
  const out: Record<string, AccessLevel> = {}
  for (const f of catalog) {
    const orgLevel = orgAccess[f.key] ?? 'none'
    const base = rolePresetAccess(role, f.key, orgLevel)
    const cand = ov.get(f.key) ?? base
    out[f.key] = capAccess(cand, orgLevel)
  }
  return out
}

async function loadTarget(profileId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('id, clerk_user_id, first_name, last_name, email, org_id, last_login_at')
    .eq('id', profileId)
    .maybeSingle()
  return data
}

async function getClerkRole(clerkUserId: string | null): Promise<SimpleRole> {
  if (!clerkUserId) return 'user'
  try {
    const client = await clerkClient()
    const u = await client.users.getUser(clerkUserId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return normalizeRole(((u.publicMetadata?.role as any) ?? null) as Parameters<typeof normalizeRole>[0])
  } catch {
    return 'user'
  }
}

async function getClerkDeactivated(clerkUserId: string | null): Promise<boolean> {
  if (!clerkUserId) return false
  try {
    const client = await clerkClient()
    const u = await client.users.getUser(clerkUserId)
    return u.publicMetadata?.deactivated === true || (u as { banned?: boolean }).banned === true
  } catch {
    return false
  }
}

// ── GET ────────────────────────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const caller = await getCurrentUser()
    if (!caller.isCorporate && normalizeRole(caller.role) !== 'admin') {
      return NextResponse.json({ success: false, message: 'Only an Admin can manage users.' }, { status: 403 })
    }

    const target = await loadTarget(params.id)
    if (!target) return NextResponse.json({ success: false, message: 'User not found.' }, { status: 404 })

    const scope = await resolveOrgScope(caller)
    if (!canManageOrg(caller, target.org_id, scope.ids)) {
      return NextResponse.json({ success: false, message: 'That user is outside your organization.' }, { status: 403 })
    }

    const { data: org } = await supabase
      .from('organizations')
      .select('id, name, org_tier')
      .eq('id', target.org_id)
      .maybeSingle()
    const orgTier = org?.org_tier ?? 'full_dealer'

    const { data: catalogRaw } = await supabase
      .from('feature_catalog')
      .select('key, label, section, section_label, sort_order, tier_defaults')
      .eq('is_active', true)
      .order('sort_order')
    const catalog = (catalogRaw ?? []) as CatalogRow[]

    const orgAccess = await computeOrgAccess(orgTier, target.org_id, catalog)

    const { data: overridesRaw } = await supabase
      .from('user_feature_access')
      .select('feature_key, access_level')
      .eq('clerk_user_id', target.clerk_user_id)
      .eq('org_id', target.org_id)
    const userOverrides: Record<string, AccessLevel> = {}
    for (const o of overridesRaw ?? []) userOverrides[o.feature_key] = o.access_level as AccessLevel

    // Caller's grantable ceiling per feature = min(caller effective, target org cap).
    let callerCap: Record<string, AccessLevel> = {}
    if (caller.isCorporate) {
      for (const f of catalog) callerCap[f.key] = orgAccess[f.key] // corporate capped only by the org
    } else {
      const callerEff = await computeUserEffective(caller.id, caller.org_id!, normalizeRole(caller.role), orgAccess, catalog)
      for (const f of catalog) callerCap[f.key] = capAccess(callerEff[f.key] ?? 'none', orgAccess[f.key] ?? 'none')
    }

    const role = await getClerkRole(target.clerk_user_id)
    const deactivated = await getClerkDeactivated(target.clerk_user_id)
    const name = [target.first_name, target.last_name].filter(Boolean).join(' ') || target.email || 'User'

    return NextResponse.json({
      success: true,
      user: {
        id: target.id,
        clerk_user_id: target.clerk_user_id,
        name, email: target.email,
        role,
        deactivated,
        org_id: target.org_id,
        org_name: org?.name ?? 'Organization',
        org_tier: orgTier,
        last_login_at: target.last_login_at,
      },
      catalog: catalog.map(c => ({ key: c.key, label: c.label, section_label: c.section_label, sort_order: c.sort_order })),
      orgAccess,
      userOverrides,
      callerCap,
      roles: SIMPLE_ROLES,
    })
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'Could not load user.' }, { status: 500 })
  }
}

// ── POST ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const caller = await getCurrentUser()
    if (!caller.isCorporate && normalizeRole(caller.role) !== 'admin') {
      return NextResponse.json({ success: false, message: 'Only an Admin can manage users.' }, { status: 403 })
    }

    const target = await loadTarget(params.id)
    if (!target || !target.clerk_user_id) {
      return NextResponse.json({ success: false, message: 'User not found.' }, { status: 404 })
    }

    const scope = await resolveOrgScope(caller)
    if (!canManageOrg(caller, target.org_id, scope.ids)) {
      return NextResponse.json({ success: false, message: 'That user is outside your organization.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const action = body.action as string

    // ── set_role ──
    if (action === 'set_role') {
      const role = body.role as SimpleRole
      if (!SIMPLE_ROLES.includes(role)) {
        return NextResponse.json({ success: false, message: 'Invalid role.' }, { status: 400 })
      }
      if (!canInviteUser(caller, target.org_id, role, scope.ids)) {
        return NextResponse.json({ success: false, message: 'You cannot assign a role at or above your own.' }, { status: 403 })
      }
      const client = await clerkClient()
      const existing = await client.users.getUser(target.clerk_user_id)
      await client.users.updateUserMetadata(target.clerk_user_id, {
        publicMetadata: { ...existing.publicMetadata, role },
      })
      return NextResponse.json({ success: true, role })
    }

    // ── set / clear feature access (advanced override) ──
    if (action === 'set_feature_access' || action === 'clear_feature_access') {
      const featureKey = body.feature_key as string
      if (!featureKey) return NextResponse.json({ success: false, message: 'Missing feature_key.' }, { status: 400 })

      // Clearing an override → delete the row (revert to role preset).
      if (action === 'clear_feature_access') {
        await supabase.from('user_feature_access').delete()
          .eq('clerk_user_id', target.clerk_user_id).eq('org_id', target.org_id).eq('feature_key', featureKey)
        return NextResponse.json({ success: true, cleared: featureKey })
      }

      const requested = body.access_level as AccessLevel
      if (!LEVELS.includes(requested)) return NextResponse.json({ success: false, message: 'Invalid access level.' }, { status: 400 })

      // Recompute the caller's grantable ceiling for this feature (never trust client).
      const { data: org } = await supabase.from('organizations').select('org_tier').eq('id', target.org_id).maybeSingle()
      const orgTier = org?.org_tier ?? 'full_dealer'
      const { data: catalogRaw } = await supabase
        .from('feature_catalog').select('key, tier_defaults').eq('is_active', true)
      const catalog = (catalogRaw ?? []) as CatalogRow[]
      const orgAccess = await computeOrgAccess(orgTier, target.org_id, catalog)
      const orgCap = orgAccess[featureKey] ?? 'none'

      let ceiling: AccessLevel = orgCap
      if (!caller.isCorporate) {
        const callerEff = await computeUserEffective(caller.id, caller.org_id!, normalizeRole(caller.role), orgAccess, catalog)
        ceiling = capAccess(callerEff[featureKey] ?? 'none', orgCap)
      }
      if (!canAssignFeature(ceiling, requested, orgCap)) {
        return NextResponse.json({ success: false, message: 'That exceeds your own access for this feature.' }, { status: 403 })
      }

      await supabase.from('user_feature_access').upsert({
        clerk_user_id: target.clerk_user_id,
        org_id: target.org_id,
        feature_key: featureKey,
        access_level: requested,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'clerk_user_id,org_id,feature_key' })
      return NextResponse.json({ success: true, feature_key: featureKey, access_level: requested })
    }

    // ── deactivate / reactivate (soft) ──
    if (action === 'set_active') {
      const active = body.active === true
      // Don't let an admin lock themselves out.
      if (target.clerk_user_id === caller.id) {
        return NextResponse.json({ success: false, message: 'You cannot deactivate your own account.' }, { status: 400 })
      }
      const client = await clerkClient()
      const existing = await client.users.getUser(target.clerk_user_id)
      await client.users.updateUserMetadata(target.clerk_user_id, {
        publicMetadata: { ...existing.publicMetadata, deactivated: !active, deactivated_at: active ? null : new Date().toISOString() },
      })
      // Enforce sign-in block too (reversible). Best-effort across Clerk versions.
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c = client.users as any
        if (active) { if (typeof c.unbanUser === 'function') await c.unbanUser(target.clerk_user_id) }
        else { if (typeof c.banUser === 'function') await c.banUser(target.clerk_user_id) }
      } catch { /* metadata flag still applied */ }
      return NextResponse.json({ success: true, deactivated: !active })
    }

    // ── move to another org (hierarchy-gated) ──
    if (action === 'move_org') {
      const destOrgId = body.dest_org_id as string
      if (!destOrgId) return NextResponse.json({ success: false, message: 'Missing destination org.' }, { status: 400 })
      // Caller must be able to manage the destination org too.
      if (!canManageOrg(caller, destOrgId, scope.ids)) {
        return NextResponse.json({ success: false, message: 'That organization is outside your network.' }, { status: 403 })
      }
      const { data: destOrg } = await supabase.from('organizations').select('id, org_tier').eq('id', destOrgId).maybeSingle()
      if (!destOrg) return NextResponse.json({ success: false, message: 'Destination org not found.' }, { status: 404 })

      // Update profile + Clerk metadata so org context follows the user everywhere.
      const { error: profErr } = await supabase.from('profiles').update({ org_id: destOrgId }).eq('id', target.id)
      if (profErr) return NextResponse.json({ success: false, message: profErr.message }, { status: 500 })
      try {
        const client = await clerkClient()
        const existing = await client.users.getUser(target.clerk_user_id)
        await client.users.updateUserMetadata(target.clerk_user_id, {
          publicMetadata: { ...existing.publicMetadata, org_id: destOrgId, org_tier: destOrg.org_tier },
        })
      } catch { /* profile is source of truth; metadata best-effort */ }
      // Old-org feature overrides are keyed by org_id and no longer apply — clean them up.
      try { await supabase.from('user_feature_access').delete().eq('clerk_user_id', target.clerk_user_id).eq('org_id', target.org_id) } catch { /* non-fatal */ }
      return NextResponse.json({ success: true, org_id: destOrgId })
    }

    return NextResponse.json({ success: false, message: 'Unknown action.' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'Could not update user.' }, { status: 500 })
  }
}
