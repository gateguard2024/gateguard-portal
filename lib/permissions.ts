/**
 * lib/permissions.ts
 *
 * Shared permission + hierarchy guard helpers. Every route that creates orgs,
 * invites users, or assigns feature access should import from here instead of
 * hand-rolling its own checks (see HIERARCHY_USERS_PERMISSIONS_AUDIT.md §5).
 *
 * Two axes (see PERMISSIONS_BUILD_SPEC.md §1):
 *   Axis 1 — org scope: downward only (lib/org-scope.ts).
 *   Axis 2 — in-org record scope: driven by the 3 roles below.
 *
 * Governing invariant: a user/dealer can never be granted more than its parent.
 *   requested <= granter effective <= org <= parent org
 */

import type { PortalUser, PortalRole, OrgTier } from './current-user'

// ─── The 3 canonical roles (the model) ────────────────────────────────────────
export type SimpleRole = 'admin' | 'supervisor' | 'user'

// Legacy Clerk PortalRole → 3-role model.
// admin → admin; supervisor → supervisor; everything operational → user.
// (client stays mapped to user for in-org logic; org-tier handles portal limits.)
export function normalizeRole(role: PortalRole | SimpleRole | null | undefined): SimpleRole {
  switch (role) {
    case 'admin':      return 'admin'
    case 'supervisor': return 'supervisor'
    default:           return 'user' // agent | dealer | rep | client | undefined
  }
}

export const ROLE_RANK: Record<SimpleRole, number> = { admin: 0, supervisor: 1, user: 2 }

// ─── Access levels ─────────────────────────────────────────────────────────────
export type AccessLevel = 'none' | 'view' | 'edit'
export const ACCESS_RANK: Record<AccessLevel, number> = { none: 0, view: 1, edit: 2 }

/** Lower of two access levels (the cap). */
export function capAccess(a: AccessLevel, b: AccessLevel): AccessLevel {
  return ACCESS_RANK[a] <= ACCESS_RANK[b] ? a : b
}

// ─── Org tier rank (who can create whom) ───────────────────────────────────────
// Lower number = higher in the tree. A caller can only create tiers ranked
// strictly BELOW their own.
export const TIER_RANK: Record<string, number> = {
  corporate:          0,
  master_agent:       1,
  master_dealer:      2,
  full_dealer:        3,
  service_dealer:     4,
  install_contractor: 4,
  sales_partner:      4,
  client:             5,
}

// ─── Feature classification for role presets ──────────────────────────────────
// Admin-only features: user/org/feature management. Forced to 'none' for
// supervisor and user regardless of org access.
export const ADMIN_FEATURES = new Set<string>([
  'dealer.platform_users',
  'dealer.dealers',
  'dealer.feature_settings',
])

// "Own-work" features: a User keeps the org's edit level here, but their record
// visibility is row-scoped to items assigned to them (see lib/org-scope.ts
// applyAssignedScope). Everywhere else a User is capped to 'view'.
export const OWN_WORK_FEATURES = new Set<string>([
  'sales.crm',
  'sales.quotes',
  'field.work_orders',
  'field.dispatch',
  'ai.forge', // Quote builder
])

/**
 * Role preset: given the org's access level for a feature, what is the default
 * cap for a user with this role? Advanced per-user overrides can raise this back
 * up to the org level, but never above it.
 *
 *   admin      → inherits org level on everything (incl. admin features)
 *   supervisor → inherits org level, except admin features → none
 *   user       → admin features none; own-work features keep org level
 *                (row-scoped); everything else capped to view
 */
export function rolePresetAccess(
  role: SimpleRole,
  featureKey: string,
  orgLevel: AccessLevel,
): AccessLevel {
  if (role === 'admin') return orgLevel

  if (ADMIN_FEATURES.has(featureKey)) return 'none'

  if (role === 'supervisor') return orgLevel

  // role === 'user'
  if (OWN_WORK_FEATURES.has(featureKey)) return orgLevel
  return capAccess(orgLevel, 'view')
}

/**
 * Compute a user's effective access for one feature.
 *   base       = role preset over the org level
 *   candidate  = advanced per-user override if present, else the base
 *   effective  = candidate capped at the org level (never exceed the org)
 */
export function effectiveAccess(params: {
  role: SimpleRole
  featureKey: string
  orgLevel: AccessLevel
  userOverride?: AccessLevel | null
}): AccessLevel {
  const { role, featureKey, orgLevel, userOverride } = params
  const base = rolePresetAccess(role, featureKey, orgLevel)
  const candidate = userOverride ?? base
  return capAccess(candidate, orgLevel)
}

// ─── Hierarchy guards ──────────────────────────────────────────────────────────

/**
 * Can the caller manage (view/edit) the target org?
 * Corporate → any org. Otherwise the target must be in the caller's downward
 * subtree. Pass the caller's resolved scope ids (from resolveOrgScope).
 */
export function canManageOrg(
  caller: PortalUser,
  targetOrgId: string,
  callerScopeIds: string[],
): boolean {
  if (caller.isCorporate) return true
  if (!caller.org_id) return false
  if (targetOrgId === caller.org_id) return true
  return callerScopeIds.includes(targetOrgId)
}

/** Can the caller create a child org of the given tier? (strictly below own tier) */
export function canCreateChildOrg(caller: PortalUser, targetTier: OrgTier): boolean {
  if (caller.isCorporate) return true
  const callerRank = TIER_RANK[caller.org_tier ?? 'client'] ?? 99
  const targetRank = TIER_RANK[targetTier] ?? 99
  return targetRank > callerRank
}

/**
 * Can the caller invite/manage a user in the target org with the given role?
 * Must be an Admin, must be able to manage the org, and cannot create a role
 * ranked above their own (an admin can make admins/supervisors/users; a
 * supervisor/user cannot manage users at all).
 */
export function canInviteUser(
  caller: PortalUser,
  targetOrgId: string,
  targetRole: SimpleRole,
  callerScopeIds: string[],
): boolean {
  const callerRole = normalizeRole(caller.role)
  if (callerRole !== 'admin') return false
  if (!canManageOrg(caller, targetOrgId, callerScopeIds)) return false
  return ROLE_RANK[targetRole] >= ROLE_RANK[callerRole]
}

/**
 * Can the caller assign `requested` access on a feature?
 * Never above the caller's own effective access for that feature, and never
 * above the target org's cap.
 */
export function canAssignFeature(
  callerEffective: AccessLevel,
  requested: AccessLevel,
  orgCap: AccessLevel,
): boolean {
  const ceiling = capAccess(callerEffective, orgCap)
  return ACCESS_RANK[requested] <= ACCESS_RANK[ceiling]
}
