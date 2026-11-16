/**
 * "Set up your access" email preview (Part 3, lifecycle step 2).
 *   GET /api/mobile/setup-email?kind=invite|reminder|renewal&fee=resident|property|partial
 * Staff only. Sending is wired once the move-in invite table + setup page exist in the portal.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { renderResidentSetupEmail, type ResidentSetupEmailKind, type ResidentSetupFee } from '@/lib/resident-setup-email'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!(user.isCorporate || user.canViewSites)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const q = req.nextUrl.searchParams
  const kindParam = q.get('kind')
  const kind: ResidentSetupEmailKind = kindParam === 'reminder' || kindParam === 'renewal' ? kindParam : 'invite'
  const feeParam = q.get('fee')
  const fee: ResidentSetupFee =
    feeParam === 'property'
      ? { amountCents: 15000, paidBy: 'property' }
      : feeParam === 'partial'
        ? { amountCents: 15000, paidBy: 'partial', residentCents: 7500 }
        : { amountCents: 15000, paidBy: 'resident' }

  const { html } = renderResidentSetupEmail({
    kind,
    firstName: 'Maya',
    propertyName: 'Elevate Marbella Place',
    unit: '214',
    startDate: '2026-12-04',
    setupUrl: 'https://portal.gateguard.co/move-in/elevate-marbella-place/abc123',
    fee,
    officePhone: '(404) 555-0142',
  })
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
