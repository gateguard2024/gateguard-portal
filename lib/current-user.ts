import { currentUser } from "@clerk/nextjs/server";

// ─── Org tiers that match the org_tier enum in Supabase ───────────────────────
export type OrgTier =
  | 'corporate'
  | 'master_agent'
  | 'master_dealer'
  | 'sales'
  | 'install_dealer'
  | 'service_dealer'
  | 'client'

// ─── Portal roles (Clerk role, controls UI access level) ──────────────────────
export type PortalRole = 'admin' | 'supervisor' | 'agent' | 'dealer' | 'rep' | 'client'

export interface PortalUser {
  id:         string
  name:       string
  initials:   string
  email:      string
  // Org context — set via publicMetadata when onboarding a dealer
  org_id:     string | null   // their organization's UUID in Supabase
  org_tier:   OrgTier | null  // where they sit in the 6-tier hierarchy
  role:       PortalRole      // portal access level (controls what they can see/do)
  // Convenience flags
  isCorporate:    boolean     // sees all data, no org filter
  isMasterAgent:  boolean
  isMasterDealer: boolean
  isDealer:       boolean     // install_dealer | service_dealer | sales
  isClient:       boolean
  canViewSensitive: boolean   // gate codes, access notes, contact phones
  canViewFinancials: boolean  // billing amounts, invoice details
}

// ─── Fallback for development / unauthenticated server calls ─────────────────
const SYSTEM_USER: PortalUser = {
  id:               'system',
  name:             'Russel Feldman',
  initials:         'RF',
  email:            'rfeldman@gateguard.co',
  org_id:           null,
  org_tier:         'corporate',
  role:             'admin',
  isCorporate:      true,
  isMasterAgent:    false,
  isMasterDealer:   false,
  isDealer:         false,
  isClient:         false,
  canViewSensitive:  true,
  canViewFinancials: true,
}

export async function getCurrentUser(): Promise<PortalUser> {
  try {
    const user = await currentUser()
    if (!user) return SYSTEM_USER

    const meta      = user.publicMetadata ?? {}
    const name      = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Unknown'
    const initials  = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    const email     = user.emailAddresses[0]?.emailAddress ?? ''
    const org_id    = (meta.org_id  as string)     ?? null
    const org_tier  = (meta.org_tier as OrgTier)   ?? null
    const role      = (meta.role    as PortalRole)  ?? 'dealer'

    const isCorporate    = org_tier === 'corporate'
    const isMasterAgent  = org_tier === 'master_agent'
    const isMasterDealer = org_tier === 'master_dealer'
    const isDealer       = ['sales', 'install_dealer', 'service_dealer'].includes(org_tier ?? '')
    const isClient       = org_tier === 'client'

    // Who can see gate codes, access notes, personal phone numbers:
    // - GateGuard corporate, admins, supervisors
    // - Master dealers and their dealers (they service the property)
    // - NOT sales reps, NOT clients
    const canViewSensitive =
      isCorporate || isMasterAgent || isMasterDealer || isDealer
        ? ['admin', 'supervisor', 'agent', 'dealer'].includes(role)
        : false

    // Who can see invoice amounts, billing, commission details:
    const canViewFinancials =
      isCorporate || isMasterAgent || isMasterDealer ||
      ['admin', 'supervisor'].includes(role)

    return {
      id, name, initials, email,
      org_id, org_tier, role,
      isCorporate, isMasterAgent, isMasterDealer, isDealer, isClient,
      canViewSensitive, canViewFinancials,
    }
  } catch {
    return SYSTEM_USER
  }
}
