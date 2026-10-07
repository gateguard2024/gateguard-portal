/**
 * POST /api/portal/[slug]/manager/verify — personal manager sign-in.
 * Body { pin }. Matches an active portal_managers row by personal-PIN hash and sets
 * the pm_<slug> cookie (manager id) so control actions can name the person.
 * DELETE clears it (sign out).
 */
import { NextRequest, NextResponse } from 'next/server'
import { matchManagerPin } from '@/lib/portal-manager'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const body = await req.json().catch(() => ({}))
  const pin = String(body.pin || '').trim()
  if (!pin) return NextResponse.json({ error: 'Enter your personal PIN.' }, { status: 400 })

  const manager = await matchManagerPin(params.slug, pin)
  if (!manager) return NextResponse.json({ error: 'That PIN was not recognized.' }, { status: 401 })

  const res = NextResponse.json({ ok: true, name: manager.name })
  res.cookies.set(`pm_${params.slug}`, manager.id, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 12,
  })
  return res
}

export async function DELETE(_req: NextRequest, { params }: { params: { slug: string } }) {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(`pm_${params.slug}`, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
  return res
}
