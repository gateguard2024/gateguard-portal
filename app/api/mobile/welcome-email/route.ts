/**
 * Resident app welcome email.
 *   GET  /api/mobile/welcome-email            → HTML preview with sample data (staff only)
 *   POST /api/mobile/welcome-email { access_id } → send it to that resident (staff only)
 * Staff-only (Clerk staff session) — residents can't trigger emails.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { renderResidentWelcomeEmail } from '@/lib/resident-welcome-email'
import { sendResidentWelcome } from '@/lib/resident-welcome-send'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function staffOnly() {
  const user = await getCurrentUser()
  return user.isCorporate || user.canViewSites
}

export async function GET() {
  if (!(await staffOnly())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { html } = renderResidentWelcomeEmail({
    firstName: 'Maya',
    email: 'm.ellison@example.com',
    propertyName: 'Elevate Marbella Place',
    unit: '214',
    officePhone: '(404) 555-0142',
  })
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

export async function POST(req: NextRequest) {
  if (!(await staffOnly())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const accessId = typeof body?.access_id === 'string' ? body.access_id : ''
  if (!accessId) return NextResponse.json({ error: 'access_id is required' }, { status: 400 })
  const r = await sendResidentWelcome(accessId)
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: 400 })
}
