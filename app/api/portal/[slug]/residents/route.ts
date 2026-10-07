/**
 * GET /api/portal/[slug]/residents — move-in compliance, concession code blocks, and
 * site settings for the ops portal Residents screen. PIN-gated (view-only is fine).
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyPortal } from '@/lib/portal-auth'
import { getResidentsData } from '@/lib/portal-residents'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status })
  const data = await getResidentsData(v.portal.site_id)
  return NextResponse.json(data)
}
