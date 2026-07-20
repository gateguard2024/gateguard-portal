/**
 * POST /api/pricing/compute — compute GateGuard pricing server-side.
 * The cost model lives in lib/pricing-model.ts (server only) so GG's true
 * Brivo/Eagle Eye costs never reach the browser. Cost + margin fields are
 * returned ONLY to corporate admins; dealers get prices/retail/profit only.
 *
 * Body: PricingInputs + optional { viewAsDealer?: boolean } (admins preview).
 * ->   { result, canViewInternal, internalView }
 * Auth: Clerk session required.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth }            from '@clerk/nextjs/server'
import { getCurrentUser }  from '@/lib/current-user'
import { computePricing }  from '@/lib/pricing-model'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const user = await getCurrentUser()
  const canViewInternal = user.isCorporate && user.role === 'admin'
  const internalView = canViewInternal && body.viewAsDealer !== true

  const result = computePricing({
    livingUnits:    body.livingUnits   as number | string | undefined,
    entryPoints:    (body.entryPoints ?? body.doors) as number | string | undefined,
    cameras:        (body.cameras ?? body.camMon)    as number | string | undefined,
    cameraType:     body.cameraType    as 'new' | 'existing' | undefined,
    smartLockUnits: (body.smartLockUnits ?? body.commonLocks) as number | string | undefined,
    cellular:       body.cellular      as number | string | undefined,
  }, internalView)

  return NextResponse.json({ result, canViewInternal, internalView })
}
