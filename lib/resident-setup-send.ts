/**
 * Create + send move-in / renewal setup invites (Part 3, lifecycle step 2).
 * Callers: staff route POST /api/move-in/invites today; the Yardi / Brivo PMS sync later.
 */
import { createServiceClient } from '@/lib/supabase'
import { sendEmail } from '@/lib/email-sender'
import { renderResidentSetupEmail, type ResidentSetupEmailKind } from '@/lib/resident-setup-email'
import { setupUrl, type MoveInInvite } from '@/lib/move-in'
import { getSiteFeeRules, type PaidBy } from '@/lib/access-fee'

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
  /** Overrides the property's fee rules for this one invite (rare). Leave out to use the property's rules. */
  feePaidBy?: PaidBy
  residentFeeCents?: number | null
  createdBy?: string
}

export async function createInvite(n: NewInvite): Promise<{ invite?: MoveInInvite; error?: string }> {
  const email = n.email.trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'A valid email is required' }
  const db = createServiceClient()
  const rules = await getSiteFeeRules(n.siteId)
  const feeCents = n.feeCents ?? (rules.enabled ? rules.amountCents : 0)
  const paidBy = n.feePaidBy ?? rules.paidBy
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
      household: (n.household ?? []).map((h) => ({ ...h, include: true, from_lease: true })),
      lease_household: (n.household ?? []).map((h) => ({ ...h, from_lease: true })),
      fee_cents: feeCents,
      fee_paid_by: paidBy,
      fee_charge_per: rules.chargePer,
      property_covers_cents: rules.propertyCoversCents,
      term_months: rules.termMonths,
      resident_fee_cents: n.residentFeeCents ?? (paidBy === 'partial' ? Math.max(0, feeCents - rules.propertyCoversCents) : null),
      created_by: n.createdBy ?? 'system',
    })
    .select('*')
    .single()
  if (error || !data) return { error: error?.message ?? 'Could not create invite' }
  return { invite: data as MoveInInvite }
}

/** Send (or resend) the setup email for one invite. kind: invite on first send, reminder after. */
export async function sendSetupInvite(inviteId: string, opts: { reminder?: boolean; baseUrl?: string } = {}): Promise<{ ok: boolean; error?: string }> {
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
    setupUrl: setupUrl(invite.token, opts.baseUrl),
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
