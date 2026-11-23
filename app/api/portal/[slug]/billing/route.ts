import { NextRequest, NextResponse } from 'next/server'
import { verifyPortal } from '@/lib/portal-auth'
import { getBillingData, getInvoiceLines } from '@/lib/portal-billing'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/portal/[slug]/billing — PIN-gated. The property's real invoices
// (Nexus + QuickBooks), balance, overdue, next due, paid in 90 days.
// ?invoice=<id> → that invoice's lines (only if it's this property's).
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status })
  const invoiceId = req.nextUrl.searchParams.get('invoice')
  if (invoiceId) {
    const r = await getInvoiceLines(invoiceId, v.portal.site_id, v.portal.org_id)
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status })
    return NextResponse.json(r)
  }
  const data = await getBillingData(v.portal.site_id, v.portal.org_id)
  return NextResponse.json(data, { status: data.error ? 500 : 200 })
}
