/**
 * Create + send move-in / renewal setup invites (Part 3, lifecycle step 2).
 * Callers: staff route POST /api/move-in/invites today; the Yardi / Brivo PMS sync later.
 */
import { createServiceClient } from '@/lib/supabase'
import { sendEmail } from '@/lib/email-sender'
import { renderResidentSetupEmail, type ResidentSetupEmailKind } from '@/lib/resident-setup-email'
import { setupUrl, type MoveInInvite } from '@/lib/move-in'

export interface NewInvite {
  siteId: string
  kind?: 'move_in' | 'renewal'
  source?: 'portal' | 'yardi' | 'brivo_pms' | 'import'
  email: string
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
  unit?: string | null
  moveInDate?: string | null
  leaseEndDate?: string | null
  household?: MoveInInvite['household']
  feeCents?: number
  feePaidBy?: 'resident' | 'property' | 'partial'
  residentFeeCents?: number | null
  createdBy?: string
}

export async function createInvite(n: NewInvite): Promise<{ invite?: MoveInInvite; error?: string }> {
  const email = n.email.trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'A valid email is required' }
  const db = createServiceClient()
  const { data, error } = await db
    .from('move_in_invites')
    .insert({
      site_id: n.siteId,
      kind: n.kind ?? 'move_in',
      source: n.source ?? 'portal',
      email,
      first_name: n.firstName ?? null,
      last_name: n.lastName ?? null,
      phone: n.phone ?? null,
      unit_number: n.unit ?? null,
      move_in_date: n.moveInDate ?? null,
      lease_end_date: n.leaseEndDate ?? null,
      household: n.household ?? [],
      fee_cents: n.feeCents ?? 15000,
      fee_paid_by: n.feePaidBy ?? 'resident',
      resident_fee_cents: n.residentFeeCents ?? null,
      created_by: n.createdBy ?? 'system',
    })
    .select('*')
    .single()
  if (error || !data) return { error: error?.message ?? 'Could not create invite' }
  return { invite: data as MoveInInvite }
}

/** Send (or resend) the setup email for one invite. kind: invite on first send, reminder after. */
export async function sendSetupInvite(inviteId: string, opts: { reminder?: boolean } = {}): Promise<{ ok: boolean; error?: string }> {
  const db = createServiceClient()
  const { data } = await db.from('move_in_invites').select('*').eq('id', inviteId).maybeSingle()
  const invite = data as MoveInInvite | null
  if (!invite) return { ok: false, error: 'Invite not found' }
  if (['complete', 'cancelled', 'expired'].includes(invite.status)) return { ok: false, error: `Invite is ${invite.status}` }

  const { data: site } = await db.from('sites').select('name, primary_contact_phone').eq('id', invite.site_id).maybeSingle()
  const kind: ResidentSetupEmailKind = invite.kind === 'renewal' ? 'renewal' : opts.reminder || invite.sent_count > 0 ? 'reminder' : 'invite'
  const mail = renderResidentSetupEmail({
    kind,
    firstName: invite.first_name,
    propertyName: site?.name ?? 'your community',
    unit: invite.unit_number,
    startDate: invite.move_in_date,
    setupUrl: setupUrl(invite.token),
    fee: { amountCents: invite.fee_cents, paidBy: invite.fee_paid_by, residentCents: invite.resident_fee_cents ?? undefined },
    officePhone: site?.primary_contact_phone ?? null,
  })
  const sent = await sendEmail({ to: invite.email, subject: mail.subject, html: mail.html })
  if (!sent.success) return { ok: false, error: sent.error }
  await db
    .from('move_in_invites')
    .update({
      sent_count: invite.sent_count + 1,
      last_sent_at: new Date().toISOString(),
      status: invite.status === 'created' ? 'sent' : invite.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invite.id)
  return { ok: true }
}
