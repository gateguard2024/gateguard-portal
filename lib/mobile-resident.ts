/**
 * Resident app (Nexus Resident, iOS/Android) — who is calling and what they may open.
 *
 * The app sends its Clerk session token as `Authorization: Bearer …`; clerkMiddleware
 * lets /api/mobile/* through without a redirect and each route calls getMobileCaller().
 * Access comes ONLY from resident_app_access (matched on a VERIFIED login email) and is
 * re-checked on every open, plus a live Brivo check that the person isn't suspended.
 */
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { getBrivoUser, getSiteBrivoToken, listBrivoDoors, type BrivoDoor } from '@/lib/brivo'

export interface MobileCaller {
  userId: string
  name: string
  emails: string[]                       // verified, lowercase
  meta: Record<string, unknown>
}

export interface AccessRow {
  id: string
  site_id: string
  email: string
  first_name: string | null
  last_name: string | null
  unit_number: string | null
  brivo_user_id: string | null
  clerk_user_id: string | null
}

export const db = () => createServiceClient()

export async function getMobileCaller(): Promise<MobileCaller | null> {
  const { userId } = await auth()
  if (!userId) return null
  const clerk = await clerkClient()
  const user = await clerk.users.getUser(userId)
  const emails = user.emailAddresses
    .filter(e => e.verification?.status === 'verified')
    .map(e => e.emailAddress.toLowerCase())
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ')
  return { userId, name, emails, meta: (user.publicMetadata ?? {}) as Record<string, unknown> }
}

/** Active access rows for this caller (by verified email). Links clerk_user_id on first use. */
export async function getAccessRows(caller: MobileCaller): Promise<AccessRow[]> {
  if (caller.emails.length === 0) return []
  const { data, error } = await db()
    .from('resident_app_access')
    .select('id, site_id, email, first_name, last_name, unit_number, brivo_user_id, clerk_user_id')
    .in('email', caller.emails)
    .eq('active', true)
  if (error) throw new Error(`resident_app_access lookup failed: ${error.message}`)
  const rows = (data ?? []) as AccessRow[]
  const toLink = rows.filter(r => r.clerk_user_id !== caller.userId).map(r => r.id)
  if (toLink.length) {
    await db().from('resident_app_access')
      .update({ clerk_user_id: caller.userId, updated_at: new Date().toISOString() })
      .in('id', toLink)
  }
  return rows
}

/**
 * Mark a brand-new Clerk account as a resident so the staff portal treats it as
 * powerless (see lib/current-user.ts). Staff/dealer accounts (already have a role
 * or org tier) are never touched — they can use the app too if they have access rows.
 */
export async function tagResidentIfNew(caller: MobileCaller): Promise<void> {
  if (caller.meta.role || caller.meta.org_tier) return
  const clerk = await clerkClient()
  await clerk.users.updateUserMetadata(caller.userId, { publicMetadata: { role: 'resident' } })
}

/** Is this person currently allowed in, per Brivo? null brivo_user_id = no Brivo check. */
export async function brivoStatus(row: AccessRow, brivo: { token: string; apiKey: string }): Promise<'active' | 'paused'> {
  if (!row.brivo_user_id) return 'active'
  const u = await getBrivoUser(brivo.token, brivo.apiKey, row.brivo_user_id)
  return u?.suspended === true ? 'paused' : 'active'
}

export async function siteDoors(siteId: string): Promise<{ brivo: { token: string; apiKey: string }; doors: BrivoDoor[] }> {
  const { token, apiKey, brivoSiteId } = await getSiteBrivoToken(siteId)
  const doors = await listBrivoDoors(token, apiKey, brivoSiteId)
  return { brivo: { token, apiKey }, doors }
}

export async function logOpen(entry: {
  site_id: string; access_id?: string | null; clerk_user_id: string
  door_id: string; door_name?: string | null; result: 'opened' | 'denied' | 'error'; detail?: string | null
}): Promise<void> {
  const { error } = await db().from('resident_door_opens').insert(entry)
  if (error) console.error('[mobile] could not log door open', error.message)
}
