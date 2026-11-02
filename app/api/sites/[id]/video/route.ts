/**
 * GET /api/sites/[id]/video?view=cameras|events|timeline|pass
 * One camera API for a property across Eagle Eye (cloud) and Gate Guard Edge
 * (Jetson + Frigate). Cameras capability required (canOperate).
 * The logic lives in lib/video.ts (shared with the property portal's
 * /api/portal/[slug]/video); see that file for the views and camera keys.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { canOperate } from '@/lib/system-access'
import { siteVideo } from '@/lib/video'

export type { VideoEvent } from '@/lib/video'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const siteId = params.id
  const user = await getCurrentUser()
  if (!(await canOperate(user, siteId, 'cameras'))) return NextResponse.json({ error: 'You don’t have camera access for this property.' }, { status: 403 })
  const r = await siteVideo(siteId, req.nextUrl.searchParams, { userId: user.id })
  return NextResponse.json(r.body, { status: r.status })
}
