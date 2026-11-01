/**
 * /api/unifi/net?site_id=  — the property's UniFi console through Ubiquiti's cloud
 * (lib/unifi-net.ts). 'network' capability required for everything here.
 *
 * GET  view=devices | device&id= | clients | vouchers | history&range=24h|7d|30d
 * POST { action: 'restart', device_id, device_name? }
 *      { action: 'power_cycle', device_id, port, device_name? }
 *      { action: 'create_vouchers', count, minutes, name?, guest_limit?, data_mb? }
 *      { action: 'delete_voucher', id }
 * Restarts and power-cycles are written to site_events (who, what, when).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { canOperate } from '@/lib/system-access'
import { NetError, createVouchers, deleteVoucher, getNetCtx, getNetDevice, ispHistory, listNetClients, listNetDevices, listVouchers, powerCyclePort, restartDevice } from '@/lib/unifi-net'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const fail = (e: unknown) => NextResponse.json({ error: e instanceof Error ? e.message : 'UniFi request failed' }, { status: e instanceof NetError ? (e.status >= 400 && e.status < 600 ? (e.status === 404 ? 409 : e.status) : 502) : 502 })

async function gate(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get('site_id') ?? ''
  if (!siteId) return { res: NextResponse.json({ error: 'site_id required' }, { status: 400 }) }
  const user = await getCurrentUser()
  if (!(await canOperate(user, siteId, 'network'))) return { res: NextResponse.json({ error: 'No network access.' }, { status: 403 }) }
  return { siteId, user }
}

export async function GET(req: NextRequest) {
  const g = await gate(req); if ('res' in g) return g.res
  const view = req.nextUrl.searchParams.get('view') ?? 'devices'
  try {
    if (view === 'history') {
      const r = req.nextUrl.searchParams.get('range')
      const range = r === '7d' || r === '30d' ? r : '24h'
      return NextResponse.json({ range, ...(await ispHistory(g.siteId, range)) })
    }
    const c = await getNetCtx(g.siteId)
    if (!c.ok) return NextResponse.json({ error: c.error }, { status: 409 })
    if (view === 'devices') return NextResponse.json({ devices: await listNetDevices(c.ctx) })
    if (view === 'device') {
      const id = req.nextUrl.searchParams.get('id') ?? ''
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      return NextResponse.json({ device: await getNetDevice(c.ctx, id) })
    }
    if (view === 'clients') return NextResponse.json({ clients: await listNetClients(c.ctx) })
    if (view === 'vouchers') return NextResponse.json({ vouchers: await listVouchers(c.ctx) })
    return NextResponse.json({ error: 'Unknown view' }, { status: 400 })
  } catch (e) { return fail(e) }
}

export async function POST(req: NextRequest) {
  const g = await gate(req); if ('res' in g) return g.res
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }) }
  const c = await getNetCtx(g.siteId)
  if (!c.ok) return NextResponse.json({ error: c.error }, { status: 409 })
  const action = String(body.action ?? '')
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  try {
    if (action === 'restart' || action === 'power_cycle') {
      const deviceId = str(body.device_id)
      if (!deviceId) return NextResponse.json({ error: 'device_id required' }, { status: 400 })
      const port = Number(body.port)
      if (action === 'power_cycle' && (!Number.isInteger(port) || port < 0 || port > 128)) return NextResponse.json({ error: 'A valid port number is required' }, { status: 400 })
      if (action === 'restart') await restartDevice(c.ctx, deviceId); else await powerCyclePort(c.ctx, deviceId, port)
      const name = str(body.device_name).slice(0, 80) || 'device'
      const title = action === 'restart' ? `Restarted ${name}` : `Power-cycled port ${port} on ${name}`
      const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      const { error } = await db.from('site_events').insert({
        site_id: g.siteId, event_type: action === 'restart' ? 'network_restart' : 'network_power_cycle', event_source: 'unifi',
        title, description: `${g.user.name} ${action === 'restart' ? 'restarted' : 'power-cycled a PoE port on'} ${name} via Nexus`, summary: `${title} by ${g.user.name}`,
        metadata: { device_id: deviceId, port: action === 'power_cycle' ? port : null, by_name: g.user.name },
      })
      // The action already happened on the console; a failed log line must not report it as failed.
      if (error) console.error('[unifi/net] site_events insert failed:', error.message)
      return NextResponse.json({ ok: true, logged: !error })
    }
    if (action === 'create_vouchers') {
      const count = Math.round(Number(body.count)), minutes = Math.round(Number(body.minutes))
      if (!(count >= 1 && count <= 100)) return NextResponse.json({ error: 'Make between 1 and 100 codes.' }, { status: 400 })
      if (!(minutes >= 1 && minutes <= 1_000_000)) return NextResponse.json({ error: 'Pick how long each code lasts.' }, { status: 400 })
      const guestLimit = body.guest_limit != null && body.guest_limit !== '' ? Math.round(Number(body.guest_limit)) : null
      const dataMB = body.data_mb != null && body.data_mb !== '' ? Math.round(Number(body.data_mb)) : null
      const vouchers = await createVouchers(c.ctx, { count, minutes, name: str(body.name).slice(0, 60) || `Guest Wi-Fi (${g.user.name})`, guestLimit: guestLimit && guestLimit > 0 ? guestLimit : null, dataMB: dataMB && dataMB > 0 ? dataMB : null })
      return NextResponse.json({ ok: true, vouchers })
    }
    if (action === 'delete_voucher') {
      const id = str(body.id)
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      await deleteVoucher(c.ctx, id)
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) { return fail(e) }
}
