/**
 * Finish move-in setup (Part 3 lifecycle step 4): turn access on.
 * Called after Stripe confirms payment, or right away when nothing is owed
 * (property pays / property collects / code covers it). Idempotent.
 *
 *  - resident_app_access row for the resident + each included household member (upsert)
 *  - invite → status complete, step done, access_id, payment fields
 *  - redemption code use counted
 *  - key-ready email to each person
 * TODO (Part 6/7): grant Brivo credential / ESP32 access; move photo to site_people.
 */
import { createServiceClient } from '@/lib/supabase'
import { inviteCode, inviteQuote, type MoveInInvite } from '@/lib/move-in'
import { sendResidentWelcome } from '@/lib/resident-welcome-send'

export async function completeInvite(
  inviteId: string,
  payment: { status: 'paid' | 'not_required'; stripeSessionId?: string | null },
): Promise<{ ok: boolean; error?: string; alreadyDone?: boolean }> {
  const db = createServiceClient()
  const { data } = await db.from('move_in_invites').select('*').eq('id', inviteId).maybeSingle()
  const invite = data as MoveInInvite | null
  if (!invite) return { ok: false, error: 'Invite not found' }
  if (invite.status === 'complete') return { ok: true, alreadyDone: true }

  // Claim it first so two callers (webhook + return page) don't both run.
  const { data: claimed } = await db
    .from('move_in_invites')
    .update({ status: 'complete', step: 'done', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', invite.id)
    .neq('status', 'complete')
    .select('id')
  if (!claimed?.length) return { ok: true, alreadyDone: true }

  const code = await inviteCode(invite)
  const quote = inviteQuote(invite, code)
  if (code) await db.rpc('use_access_fee_code', { p_code_id: code.id })

  const people = [
    { email: invite.email, first_name: invite.first_name, last_name: invite.last_name },
    ...(invite.household ?? [])
      .filter((h) => h.include !== false && h.email)
      .map((h) => ({ email: h.email!.toLowerCase(), first_name: h.first_name ?? null, last_name: h.last_name ?? null })),
  ]

  const rows = people.map((p) => ({
    site_id: invite.site_id,
    email: p.email,
    first_name: p.first_name,
    last_name: p.last_name,
    unit_number: invite.unit_number,
    active: true,
    updated_at: new Date().toISOString(),
  }))
  const { data: access, error } = await db
    .from('resident_app_access')
    .upsert(rows, { onConflict: 'site_id,email' })
    .select('id, email')
  if (error) {
    // Put the invite back so it can be retried; payment is recorded either way.
    await db.from('move_in_invites').update({ status: 'in_progress', step: 'review' }).eq('id', invite.id)
    return { ok: false, error: error.message }
  }

  const residentAccess = access?.find((a) => a.email === invite.email)
  await db
    .from('move_in_invites')
    .update({
      access_id: residentAccess?.id ?? null,
      payment_status: payment.status,
      paid_at: payment.status === 'paid' ? new Date().toISOString() : null,
      stripe_session_id: payment.stripeSessionId ?? invite.stripe_session_id,
      amount_due_cents: quote.dueCents,
      property_owes_cents: quote.propertyCoversCents,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invite.id)

  for (const a of access ?? []) {
    await sendResidentWelcome(a.id).catch(() => null)
  }
  return { ok: true }
}
