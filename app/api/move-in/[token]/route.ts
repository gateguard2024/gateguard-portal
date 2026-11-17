/**
 * Move-in setup — public, token-based (no Clerk). The token in the URL is the credential.
 *   GET   /api/move-in/{token}  → what the setup page needs
 *   PATCH /api/move-in/{token}  → save a step:
 *     { action: 'details', firstName, lastName, phone }
 *     { action: 'skip_photo' }
 *     { action: 'access', household: [{ include, email }], vehicles: [...] }
 *         household is matched by position to the people ON THE LEASE (from the office / PMS).
 *         Residents can switch lease members on/off and fill in a missing email — never add people.
 *     { action: 'cart', cart: [{ product_id, qty }] }     (step 4 add-ons → review)
 *     { action: 'code', code } / { action: 'remove_code' }   (redemption code on review)
 *     { action: 'goto', step }            (Back / Edit)
 */
import { NextRequest, NextResponse } from 'next/server'
import { checkFeeCode } from '@/lib/access-fee'
import {
  getInvite, inviteView, moveInProducts, updateInvite,
  MAX_VEHICLES, type CartLine, type HouseholdMember, type Vehicle,
} from '@/lib/move-in'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const STEPS = ['details', 'photo', 'access', 'services', 'review'] as const
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

function gone(error: string) {
  return NextResponse.json({ error }, { status: error === 'not_found' ? 404 : 410 })
}
const clean = (v: unknown, max = 80) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const r = await getInvite(params.token)
  if ('error' in r) return gone(r.error)
  const { invite } = r
  if (!['opened', 'in_progress', 'complete'].includes(invite.status)) {
    await updateInvite(invite.id, { status: 'opened', opened_at: new Date().toISOString() })
    invite.status = 'opened'
  }
  return NextResponse.json(await inviteView(invite, r.propertyName, r.officePhone))
}

export async function PATCH(req: NextRequest, { params }: { params: { token: string } }) {
  const r = await getInvite(params.token)
  if ('error' in r) return gone(r.error)
  const { invite } = r
  if (invite.status === 'complete') return NextResponse.json({ error: 'already_complete' }, { status: 409 })

  const body = await req.json().catch(() => ({}))
  const action = body?.action

  if (action === 'details') {
    const firstName = clean(body.firstName)
    const lastName = clean(body.lastName)
    const phoneDigits = clean(body.phone, 30).replace(/\D/g, '')
    if (!firstName || !lastName) return NextResponse.json({ error: 'Please enter your first and last name.' }, { status: 400 })
    if (phoneDigits.length < 10 || phoneDigits.length > 15) return NextResponse.json({ error: 'Please enter a mobile number we can text.' }, { status: 400 })
    await updateInvite(invite.id, {
      first_name: firstName, last_name: lastName, phone: phoneDigits,
      details_confirmed_at: new Date().toISOString(), status: 'in_progress', step: 'photo',
    })
  } else if (action === 'skip_photo') {
    await updateInvite(invite.id, { photo_skipped: true, step: 'access', status: 'in_progress' })
  } else if (action === 'access') {
    if (!invite.details_confirmed_at) return NextResponse.json({ error: 'Confirm your details first.' }, { status: 400 })
    const lease: HouseholdMember[] = invite.lease_household ?? invite.household ?? []
    const sent: unknown[] = Array.isArray(body.household) ? body.household : []
    const seen = new Set<string>([invite.email])
    const household: HouseholdMember[] = []
    for (let i = 0; i < lease.length; i++) {
      const base = lease[i]
      const h = (sent[i] ?? {}) as Record<string, unknown>
      const include = h.include !== false
      // Email: the lease's email wins; the resident may only fill one in when the lease has none.
      const email = (base.email || clean(h.email, 120)).toLowerCase()
      if (include) {
        if (!EMAIL_RE.test(email)) return NextResponse.json({ error: `${base.first_name ?? 'Each person'} needs an email — it's how they sign in to the app.` }, { status: 400 })
        if (seen.has(email)) return NextResponse.json({ error: `${email} is already used. Each person needs their own email.` }, { status: 400 })
        seen.add(email)
      }
      household.push({ ...base, email: email || undefined, include, from_lease: true })
    }
    const cars: unknown[] = Array.isArray(body.vehicles) ? body.vehicles : []
    if (cars.length > MAX_VEHICLES) return NextResponse.json({ error: `Up to ${MAX_VEHICLES} vehicles can be added.` }, { status: 400 })
    const vehicles: Vehicle[] = []
    for (const raw of cars) {
      const v = (raw ?? {}) as Record<string, unknown>
      const plate = clean(v.plate, 12).toUpperCase().replace(/[^A-Z0-9 -]/g, '')
      const make = clean(v.make, 40)
      if (!plate && !make) continue
      if (!plate) return NextResponse.json({ error: 'Each vehicle needs a license plate.' }, { status: 400 })
      vehicles.push({ make, model: clean(v.model, 40), color: clean(v.color, 30), plate, state: clean(v.state, 2).toUpperCase() })
    }
    await updateInvite(invite.id, { household, vehicles, access_confirmed_at: new Date().toISOString(), step: 'services', status: 'in_progress' })
  } else if (action === 'cart' || action === 'services') {
    if (!invite.access_confirmed_at) return NextResponse.json({ error: 'Choose who gets access first.' }, { status: 400 })
    const products = await moveInProducts(invite.site_id)
    const raw: unknown[] = Array.isArray(body.cart) ? body.cart : []
    const cart: CartLine[] = []
    for (const x of raw) {
      const c = (x ?? {}) as Record<string, unknown>
      const p = products.find((pp) => pp.id === c.product_id)
      const qty = Math.floor(Number(c.qty))
      if (!p || !Number.isFinite(qty) || qty < 1) continue
      if (qty > p.max_per_unit) return NextResponse.json({ error: `Up to ${p.max_per_unit} ${p.name.toLowerCase()}s per home.` }, { status: 400 })
      cart.push({ product_id: p.id, qty })
    }
    await updateInvite(invite.id, { cart, step: 'review' })
  } else if (action === 'code') {
    const c = await checkFeeCode(invite.site_id, clean(body.code, 40))
    if (!c.ok) return NextResponse.json({ error: c.error }, { status: 400 })
    await updateInvite(invite.id, { code_id: c.code.id })
  } else if (action === 'remove_code') {
    await updateInvite(invite.id, { code_id: null })
  } else if (action === 'goto' && STEPS.includes(body.step)) {
    if (body.step !== 'details' && !invite.details_confirmed_at) return NextResponse.json({ error: 'Confirm your details first.' }, { status: 400 })
    await updateInvite(invite.id, { step: body.step })
  } else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  const fresh = await getInvite(params.token)
  if ('error' in fresh) return gone(fresh.error)
  return NextResponse.json(await inviteView(fresh.invite, fresh.propertyName, fresh.officePhone))
}
