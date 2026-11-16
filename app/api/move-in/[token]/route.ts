/**
 * Move-in setup — public, token-based (no Clerk). The token in the URL is the credential.
 *   GET   /api/move-in/{token}  → what the setup page needs
 *   PATCH /api/move-in/{token}  → save a step:
 *     { action: 'details', firstName, lastName, phone }
 *     { action: 'skip_photo' }
 *     { action: 'goto', step }            (Back buttons)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getInvite, publicView, updateInvite } from '@/lib/move-in'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const STEPS = ['details', 'photo', 'access', 'services', 'review'] as const

function gone(error: string) {
  const status = error === 'not_found' ? 404 : 410
  return NextResponse.json({ error }, { status })
}

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const r = await getInvite(params.token)
  if ('error' in r) return gone(r.error)
  const { invite } = r
  if (!['opened', 'in_progress', 'complete'].includes(invite.status)) {
    await updateInvite(invite.id, { status: 'opened', opened_at: new Date().toISOString() })
    invite.status = 'opened'
  }
  return NextResponse.json(publicView(invite, r.propertyName, r.officePhone))
}

const clean = (v: unknown, max = 80) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

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
      first_name: firstName,
      last_name: lastName,
      phone: phoneDigits,
      details_confirmed_at: new Date().toISOString(),
      status: 'in_progress',
      step: 'photo',
    })
  } else if (action === 'skip_photo') {
    await updateInvite(invite.id, { photo_skipped: true, step: 'access', status: 'in_progress' })
  } else if (action === 'goto' && STEPS.includes(body.step)) {
    // Only allow going to a step already reached (Back), or photo/access once details are confirmed.
    if (body.step !== 'details' && !invite.details_confirmed_at) return NextResponse.json({ error: 'Confirm your details first.' }, { status: 400 })
    await updateInvite(invite.id, { step: body.step })
  } else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  const fresh = await getInvite(params.token)
  if ('error' in fresh) return gone(fresh.error)
  return NextResponse.json(publicView(fresh.invite, fresh.propertyName, fresh.officePhone))
}
