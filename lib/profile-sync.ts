/**
 * lib/profile-sync.ts
 *
 * Clerk → Supabase `profiles` sync. Clerk owns identity/login; `profiles` is the
 * internal mirror the rest of the app joins on (opportunities.rep_id,
 * work_orders.assigned_to, the glass user editor, assigned-only scoping).
 *
 * Nothing else in the codebase creates profiles rows, so without this the table
 * stays empty and Platform Users shows 0. Used by the Clerk webhook (going
 * forward) and the backfill route (existing users).
 */
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Minimal shape both Clerk's SDK User and webhook payloads can be mapped to.
export interface ClerkUserLike {
  id: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  publicMetadata?: Record<string, unknown> | null
}

let corporateOrgIdCache: string | null = null
async function getCorporateOrgId(): Promise<string | null> {
  if (corporateOrgIdCache) return corporateOrgIdCache
  const { data } = await db().from('organizations').select('id').eq('org_tier', 'corporate').limit(1).maybeSingle()
  corporateOrgIdCache = data?.id ?? null
  return corporateOrgIdCache
}

// profiles.role is the legacy `user_role` enum (NOT NULL). The app's runtime role
// comes from Clerk publicMetadata, so this is just a valid enum value to satisfy
// the column — map the simple role/tier to the closest enum member.
function toUserRole(portalRole: string | null, orgTier: string | null): string {
  if (orgTier === 'corporate') return 'corporate_admin'
  if (portalRole === 'admin') return 'dealer_admin'
  if (portalRole === 'client') return 'client_admin'
  return 'dealer_staff'
}

export interface SyncResult { ok: boolean; reason?: string }

/**
 * Upsert a profiles row from a Clerk user. Idempotent (onConflict clerk_user_id).
 * Also links a technician record when the user was invited as one
 * (publicMetadata.technician_id).
 */
export async function upsertProfileFromClerk(user: ClerkUserLike): Promise<SyncResult> {
  const meta = user.publicMetadata ?? {}
  const email = user.email ?? null
  if (!email) return { ok: false, reason: 'no email' }

  const orgId = (meta.org_id as string) || (await getCorporateOrgId()) // corporate logins historically had no org_id
  if (!orgId) return { ok: false, reason: 'no org_id and no corporate org seeded' }

  const portalRole = (meta.role as string) ?? null
  const orgTier = (meta.org_tier as string) ?? null

  const { error } = await db().from('profiles').upsert({
    clerk_user_id: user.id,
    org_id: orgId,
    role: toUserRole(portalRole, orgTier),
    email,
    first_name: user.firstName ?? null,
    last_name: user.lastName ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'clerk_user_id' })
  if (error) return { ok: false, reason: error.message }

  // If invited as a technician, link the login to that technician record.
  const technicianId = (meta.technician_id as string) ?? null
  if (technicianId) {
    await db().from('technicians')
      .update({ clerk_user_id: user.id, can_access_portal: true })
      .eq('id', technicianId)
  }
  return { ok: true }
}

/** Map a Clerk webhook `user.*` payload (snake_case) to ClerkUserLike. */
export function fromWebhookData(data: any): ClerkUserLike {
  const emails: any[] = data?.email_addresses ?? []
  const primaryId = data?.primary_email_address_id
  const primary = emails.find(e => e.id === primaryId) ?? emails[0]
  return {
    id: data.id,
    firstName: data.first_name ?? null,
    lastName: data.last_name ?? null,
    email: primary?.email_address ?? null,
    publicMetadata: data.public_metadata ?? {},
  }
}
