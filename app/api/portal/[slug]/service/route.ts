import { NextRequest, NextResponse } from 'next/server'
import { verifyPortal } from '@/lib/portal-auth'
import { getServiceData } from '@/lib/portal-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/portal/[slug]/service — PIN-gated. The property's open service tickets,
// service history (12 months) and what the AI found (lib/portal-service.ts).
// New requests: POST /api/portal/[slug]/request-service.
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status })
  const data = await getServiceData(v.portal.site_id)
  return NextResponse.json(data, { status: data.error ? 500 : 200 })
}
