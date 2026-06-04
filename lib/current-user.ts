import { currentUser } from "@clerk/nextjs/server";

// ─── Org tiers that match the org_tier enum in Supabase ───────────────────────
export type OrgTier =
  | 'corporate'
  | 'master_agent'
  | 'master_dealer'
  | 'full_dealer'
  | 'service_dealer'
  | 'install_contractor'
  | 'sales_partner'
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
  org_tier:   OrgTier | null  // where they sit in the 7-tier hierarchy
  role:       PortalRole      // portal access level (controls what they can see/do)
  // Convenience flags
  isCorporate:    boolean     // sees all data, no org filter
  isMasterAgent:  boolean
  isMasterDealer: boolean
  isDealer:       boolean     // backward-compat: any dealer sub-type
  isClient:       boolean
  // New 7-tier flags
  isFullDealer:         boolean  // full_dealer — self-performs or subcontracts
  isServiceDealer:      boolean  // service_dealer — services only
  isInstallContractor:  boolean  // install_contractor — installs only
  isSalesPartner:       boolean  // sales_partner — sells only, earns lifetime commission
  // Visibility scopes
  canViewWOs:           boolean  // can see work orders
  canViewSites:         boolean  // can see property list
  canViewCRM:           boolean  // can see CRM pipeline
  canViewCommissions:   boolean  // can see commission dashboard
  canViewNetwork:       boolean  // can see dealer network (sub-dealers)
  canViewDispatch:      boolean  // can see dispatch board
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
  isCorporate:           true,
  isMasterAgent:         false,
  isMasterDealer:        false,
  isDealer:              false,
  isClient:              false,
  isFullDealer:          false,
  isServiceDealer:       false,
  isInstallContractor:   false,
  isSalesPartner:        false,
  canViewWOs:            true,
  canViewSites:          true,
  canViewCRM:            true,
  canViewCommissions:    true,
  canViewNetwork:        true,
  canViewDispatch:       true,
  canViewSensitive:      true,
  canViewFinancials:     true,
}

export async function getCurrentUser(): Promise<PortalUser> {
  try {
    const user = await currentUser()
    if (!user) return SYSTEM_USER

    const meta      = user.publicMetadata ?? {}
    const id        = user.id
    const name      = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Unknown'
    const initials  = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    const email     = user.emailAddresses[0]?.emailAddress ?? ''
    const org_id    = (meta.org_id  as string)     ?? null
    const org_tier  = (meta.org_tier as OrgTier)   ?? null
    const role      = (meta.role    as PortalRole)  ?? 'dealer'

    const isCorporate         = org_tier === 'corporate'
    const isMasterAgent       = org_tier === 'master_agent'
    const isMasterDealer      = org_tier === 'master_dealer'
    const isFullDealer        = org_tier === 'full_dealer'
    const isServiceDealer     = org_tier === 'service_dealer'
    const isInstallContractor = org_tier === 'install_contractor'
    const isSalesPartner      = org_tier === 'sales_partner'
    const isClient            = org_tier === 'client'

    // Legacy isDealer flag — keep for backward compat
    const isDealer = isFullDealer || isServiceDealer || isInstallContractor || isSalesPartner

    // Visibility scopes
    const canViewWOs =
      isCorporate || isMasterDealer || isFullDealer || isServiceDealer || isInstallContractor
    const canViewSites =
      isCorporate || isMasterDealer || isFullDealer || isServiceDealer
    const canViewCRM =
      isCorporate || isMasterDealer || isFullDealer || isSalesPartner || isServiceDealer
    const canViewCommissions =
      isCorporate || isMasterAgent || isMasterDealer || isFullDealer || isSalesPartner || isServiceDealer
    const canViewNetwork =
      isCorporate || isMasterAgent || isMasterDealer || isFullDealer
    const canViewDispatch =
      isCorporate || isMasterDealer || isFullDealer

    // Who can see gate codes, access notes, personal phone numbers:
    // - GateGuard corporate, admins, supervisors
    // - Master dealers and their dealers (they service the property)
    // - NOT sales partners, NOT clients
    const canViewSensitive =
      isCorporate || isMasterDealer || isFullDealer || isServiceDealer
        ? ['admin', 'supervisor', 'agent', 'dealer'].includes(role)
        : false

    // Who can see invoice amounts, billing, commission details:
    const canViewFinancials =
      isCorporate || isMasterAgent || isMasterDealer || isFullDealer ||
      ['admin', 'supervisor'].includes(role)

    return {
      id, name, initials, email,
      org_id, org_tier, role,
      isCorporate, isMasterAgent, isMasterDealer, isDealer, isClient,
      isFullDealer, isServiceDealer, isInstallContractor, isSalesPartner,
      canViewWOs, canViewSites, canViewCRM, canViewCommissions,
      canViewNetwork, canViewDispatch,
      canViewSensitive, canViewFinancials,
    }
  } catch {
    return SYSTEM_USER
  }
}
