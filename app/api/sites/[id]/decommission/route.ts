/**
 * /api/sites/[id]/decommission — mark a property inactive / take it offline (CORPORATE ONLY).
 *
 *   GET                                   status, installed + removed devices, removal job, billing task, what's paused
 *   POST { action: 'deactivate', reason, last_day?, take_offline? }
 *   POST { action: 'reactivate' }
 *   POST { action: 'removal_job', date? }  make the Removal work order (one step per device)
 *   POST { action: 'device', asset_id, to: 'stock'|'disposed'|'left_on_site'|null }
 *   POST { action: 'close_out' }           every device accounted for → decommissioned
 *
 * Engine: lib/decommission.ts. Vendor logins are removed in Setup & keys (also corporate-only).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { closeOut, createRemovalJob, deactivateSite, getDecommission, isRemovedTo, reactivateSite, recordRemoval } from '@/lib/decommission'

export const dynamic = 'force-dynamic'
const UUID = /^[0-9a-f-]{36}$/i

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user.isCorporate) return NextResponse.json({ error: 'Only Gate Guard corporate can do this.' }, { status: 403 })
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Bad property.' }, { status: 400 })
  const r = await getDecommission(params.id)
  if (!r.site) return NextResponse.json({ error: r.error }, { status: r.error === 'Property not found.' ? 404 : 500 })
  return NextResponse.json(r)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user.isCorporate) return NextResponse.json({ error: 'Only Gate Guard corporate can do this.' }, { status: 403 })
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Bad property.' }, { status: 400 })
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const who = { id: user.id, name: user.name, org_id: user.org_id }
  const action = String(body.action ?? '')

  let r: { ok: boolean; error?: string; warnings?: string[]; id?: string }
  switch (action) {
    case 'deactivate':
      r = await deactivateSite(params.id, who, { reason: String(body.reason ?? ''), lastDay: body.last_day ? String(body.last_day) : null, takeOffline: !!body.take_offline })
      break
    case 'reactivate':
      r = await reactivateSite(params.id)
      break
    case 'removal_job':
      r = await createRemovalJob(params.id, who, { date: body.date ? String(body.date) : null })
      break
    case 'device': {
      const assetId = String(body.asset_id ?? '')
      if (!UUID.test(assetId)) return NextResponse.json({ error: 'Pick a device.' }, { status: 400 })
      if (body.to !== null && !isRemovedTo(body.to)) return NextResponse.json({ error: 'Pick where it went.' }, { status: 400 })
      const cur = await getDecommission(params.id)
      r = await recordRemoval(params.id, assetId, (body.to as never) ?? null, who, { woId: cur.decommission?.removal_wo_id ?? null })
      break
    }
    case 'close_out':
      r = await closeOut(params.id)
      break
    default:
      return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  }
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
  const fresh = await getDecommission(params.id)
  return NextResponse.json({ ok: true, id: r.id ?? null, warning: [r.error, ...(r.warnings ?? [])].filter(Boolean).join(' ') || null, ...fresh })
}
