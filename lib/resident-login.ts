/**
 * Create (or find) the resident's app login ahead of time, when move-in setup completes,
 * so the app is a plain sign-in: email code OR text code to their mobile. No password.
 * - New login: email (+ mobile if we have it), marked verified because the lease / setup
 *   confirmed them; publicMetadata.role = 'resident' (powerless in the staff portal).
 * - Existing login (e.g. a staff member who is also a resident): left as is; we only add the
 *   mobile number if it has none. Never changes an existing role.
 * Never throws — the resident can still sign in by email code and the app creates the login.
 */
import { clerkClient } from '@clerk/nextjs/server'

export function toE164(raw?: string | null): string | null {
  const d = (raw ?? '').replace(/\D/g, '')
  if (d.length === 10) return `+1${d}`
  if (d.length === 11 && d.startsWith('1')) return `+${d}`
  return null
}

export async function ensureResidentLogin(p: { email: string; phone?: string | null; firstName?: string | null; lastName?: string | null }): Promise<string | null> {
  try {
    const clerk = await clerkClient()
    const email = p.email.trim().toLowerCase()
    const phone = toE164(p.phone)
    const found = await clerk.users.getUserList({ emailAddress: [email], limit: 1 })
    const existing = found.data[0]
    if (existing) {
      if (phone && existing.phoneNumbers.length === 0) {
        await clerk.phoneNumbers.createPhoneNumber({ userId: existing.id, phoneNumber: phone, verified: true }).catch(() => null)
      }
      return existing.id
    }
    const base = {
      emailAddress: [email],
      firstName: p.firstName ?? undefined,
      lastName: p.lastName ?? undefined,
      publicMetadata: { role: 'resident' },
      skipPasswordRequirement: true,
    }
    try {
      const u = await clerk.users.createUser(phone ? { ...base, phoneNumber: [phone] } : base)
      return u.id
    } catch {
      // Phone sign-in not enabled in Clerk yet, or that number is on another login → email only.
      const u = await clerk.users.createUser(base)
      return u.id
    }
  } catch (e) {
    console.error('[resident-login] could not create login for', p.email, e)
    return null
  }
}
