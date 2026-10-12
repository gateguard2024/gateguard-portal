import { NextRequest, NextResponse } from 'next/server'
import { verifyPortal } from '@/lib/portal-auth'
import { getBillingData } from '@/lib/portal-billing'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/portal/[slug]/billing — PIN-gated. Balance owed (bulk + setup),
// funding model, and unpaid residents for resident-funded sites.
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status })
  return NextResponse.json(await getBillingData(v.portal.site_id))
}
