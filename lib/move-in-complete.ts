/**
 * Finish move-in setup (Part 3 lifecycle step 4): turn access on.
 * Called after Stripe confirms payment, or right away when nothing is owed
 * (property pays / property collects / code covers it). Idempotent.
 *
 *  - app login (Clerk) for each person, with their mobile when we have it (lib/resident-login)
 *  - resident_app_access row for the resident + each included household member (upsert)
 *  - invite → status complete, step done, access_id, payment fields
 *  - redemption code use counted
 *  - add-ons (gate key fob, …) → resident_orders for staff to program + hand over
 *  - key-ready email to each person
 * TODO (Part 6/7): grant Brivo credential / ESP32 access; move photo to site_people.
 */
import { createServiceClient } from '@/lib/supabase'
import { inviteCode, inviteQuote, moveInProducts, priceCart, type MoveInInvite } from '@/lib/move-in'
import { sendResidentWelcome } from '@/lib/resident-welcome-send'
import { ensureResidentLogin } from '@/lib/resident-login'

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
    { email: invite.email, first_name: invite.first_name, last_name: invite.last_name, phone: invite.phone },
    ...(invite.household ?? [])
      .filter((h) => h.include !== false && h.email)
      .map((h) => ({ email: h.email!.toLowerCase(), first_name: h.first_name ?? null, last_name: h.last_name ?? null, phone: h.phone ?? null })),
  ]

  // App logins created now, so the app is a plain sign-in (email or text code, no password).
  const clerkIds = new Map<string, string>()
  for (const p of people) {
    const id = await ensureResidentLogin({ email: p.email, phone: p.phone, firstName: p.first_name, lastName: p.last_name })
    if (id) clerkIds.set(p.email, id)
  }

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

  // Add-on orders (priced from the property's products, snapshotted)
  const cart = priceCart(invite.cart ?? [], await moveInProducts(invite.site_id))
  if (cart.lines.length) {
    await db.from('resident_orders').insert(cart.lines.map((l) => ({
      site_id: invite.site_id,
      invite_id: invite.id,
      product_id: l.product.id,
      sku: l.product.sku,
      name: l.product.name,
      qty: l.qty,
      unit_cents: l.product.price_cents,
      site_share_cents: l.product.site_share_cents,
      email: invite.email,
      unit_number: invite.unit_number,
      status: 'paid',
      stripe_session_id: payment.stripeSessionId ?? null,
    })))
  }

  // Link each access row to its login (only where we have one — never blank out an existing link).
  for (const a of access ?? []) {
    const id = clerkIds.get(a.email)
    if (id) await db.from('resident_app_access').update({ clerk_user_id: id }).eq('id', a.id)
  }

  const residentAccess = access?.find((a) => a.email === invite.email)
  await db
    .from('move_in_invites')
    .update({
      access_id: residentAccess?.id ?? null,
      payment_status: payment.status,
      paid_at: payment.status === 'paid' ? new Date().toISOString() : null,
      stripe_session_id: payment.stripeSessionId ?? invite.stripe_session_id,
      amount_due_cents: quote.dueCents + cart.totalCents,
      property_owes_cents: quote.propertyCoversCents,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invite.id)

  for (const a of access ?? []) {
    await sendResidentWelcome(a.id).catch(() => null)
  }
  return { ok: true }
}
