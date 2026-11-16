/**
 * Move-in setup (Part 3) — server helpers. The URL token is the credential.
 * Everything here uses the service client; callers must look the invite up by token first.
 */
import { createServiceClient } from '@/lib/supabase'

export interface MoveInInvite {
  id: string
  token: string
  site_id: string
  kind: 'move_in' | 'renewal'
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  unit_number: string | null
  move_in_date: string | null
  lease_end_date: string | null
  household: Array<{ first_name?: string; last_name?: string; email?: string; phone?: string }>
  fee_cents: number
  fee_paid_by: 'resident' | 'property' | 'partial'
  resident_fee_cents: number | null
  status: string
  step: string
  details_confirmed_at: string | null
  photo_path: string | null
  photo_skipped: boolean
  completed_at: string | null
  expires_at: string
  sent_count: number
}

export const PHOTO_BUCKET = 'resident-photos'
export const TOKEN_RE = /^[a-f0-9]{48}$/

export function setupUrl(token: string) {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://portal.gateguard.co').replace(/\/$/, '')
  return `${base}/move-in/${token}`
}

/** Look up a live invite by token. Returns null for bad, expired or cancelled links. */
export async function getInvite(token: string): Promise<{ invite: MoveInInvite; propertyName: string; officePhone: string | null } | { error: 'not_found' | 'expired' | 'cancelled' }> {
  if (!TOKEN_RE.test(token)) return { error: 'not_found' }
  const db = createServiceClient()
  const { data } = await db.from('move_in_invites').select('*').eq('token', token).maybeSingle()
  if (!data) return { error: 'not_found' }
  const invite = data as MoveInInvite
  if (invite.status === 'cancelled') return { error: 'cancelled' }
  if (invite.status !== 'complete' && new Date(invite.expires_at).getTime() < Date.now()) return { error: 'expired' }
  const { data: site } = await db.from('sites').select('name, primary_contact_phone').eq('id', invite.site_id).maybeSingle()
  return { invite, propertyName: site?.name ?? 'your community', officePhone: site?.primary_contact_phone ?? null }
}

/** What the resident's browser is allowed to see — no ids beyond what it needs. */
export function publicView(invite: MoveInInvite, propertyName: string, officePhone: string | null) {
  return {
    kind: invite.kind,
    propertyName,
    officePhone,
    email: invite.email,
    firstName: invite.first_name,
    lastName: invite.last_name,
    phone: invite.phone,
    unit: invite.unit_number,
    moveInDate: invite.move_in_date,
    household: invite.household,
    fee: { cents: invite.fee_cents, paidBy: invite.fee_paid_by, residentCents: invite.resident_fee_cents },
    step: invite.step,
    status: invite.status,
    hasPhoto: !!invite.photo_path,
    photoSkipped: invite.photo_skipped,
  }
}

export async function updateInvite(id: string, patch: Partial<MoveInInvite> & Record<string, unknown>) {
  const db = createServiceClient()
  return db.from('move_in_invites').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
}
