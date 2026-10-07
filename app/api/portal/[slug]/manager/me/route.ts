/**
 * GET /api/portal/[slug]/manager/me — the currently signed-in manager, or null.
 * Used by the ops shell to show "Signed in as …" and gate control buttons.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPortalManager } from '@/lib/portal-manager'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const manager = await getPortalManager(req, params.slug)
  return NextResponse.json({ manager })
}
