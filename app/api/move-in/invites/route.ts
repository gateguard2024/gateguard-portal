/**
 * Staff: create a move-in (or renewal) setup invite and email it.
 *   POST /api/move-in/invites { site_id, email, first_name?, last_name?, phone?, unit?, move_in_date?,
 *                               lease_end_date?, kind?, fee_cents?, fee_paid_by?, resident_fee_cents?, send? }
 *   → { id, setup_url, sent }
 * Staff only (Clerk session). The PMS sync will call createInvite/sendSetupInvite directly.
 * Middleware only bypasses the public token routes (/api/move-in/{48-hex token}), so this
 * route still runs behind Clerk.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { createInvite, sendSetupInvite } from '@/lib/resident-setup-send'
import { setupUrl } from '@/lib/move-in'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!(user.isCorporate || user.canViewSites)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  if (typeof b?.site_id !== 'string' || typeof b?.email !== 'string') {
    return NextResponse.json({ error: 'site_id and email are required' }, { status: 400 })
  }
  const paidBy = ['resident', 'property', 'partial'].includes(b.fee_paid_by) ? b.fee_paid_by : 'resident'
  const { invite, error } = await createInvite({
    siteId: b.site_id,
    kind: b.kind === 'renewal' ? 'renewal' : 'move_in',
    email: b.email,
    firstName: b.first_name ?? null,
    lastName: b.last_name ?? null,
    phone: b.phone ?? null,
    unit: b.unit ?? null,
    moveInDate: b.move_in_date ?? null,
    leaseEndDate: b.lease_end_date ?? null,
    feeCents: Number.isFinite(b.fee_cents) ? b.fee_cents : undefined,
    feePaidBy: paidBy,
    residentFeeCents: Number.isFinite(b.resident_fee_cents) ? b.resident_fee_cents : null,
    createdBy: user.id,
  })
  if (!invite) return NextResponse.json({ error }, { status: 400 })
  let sent = false
  if (b.send !== false) {
    const r = await sendSetupInvite(invite.id)
    sent = r.ok
    if (!r.ok) return NextResponse.json({ id: invite.id, setup_url: setupUrl(invite.token), sent, error: r.error }, { status: 207 })
  }
  return NextResponse.json({ id: invite.id, setup_url: setupUrl(invite.token), sent })
}
