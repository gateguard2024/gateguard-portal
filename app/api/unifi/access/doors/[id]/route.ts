/**
 * POST /api/unifi/access/doors/[id]  { site_id, door_name?, confirm }
 * Unlock a UniFi Access door (confirm required). Logged to the site timeline.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { canOperate } from '@/lib/system-access'
import { unlockUnifiAccessDoor } from '@/lib/unifi'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  const body = await req.json().catch(() => ({}))
  const siteId = String(body.site_id ?? '')
  if (!siteId) return NextResponse.json({ error: 'site_id required' }, { status: 400 })
  if (!(await canOperate(user, siteId, 'doors'))) return NextResponse.json({ error: 'No door access.' }, { status: 403 })
  if (body.confirm !== true) return NextResponse.json({ error: 'Unlocking a door needs confirmation.' }, { status: 400 })
  try {
    await unlockUnifiAccessDoor(siteId, params.id)
    const name = String(body.door_name ?? 'Door')
    try {
      await supabase.from('site_events').insert({
        site_id: siteId, event_type: 'door_unlock', event_source: 'unifi',
        title: `Door unlocked: ${name}`, description: `Unlocked remotely by ${user.name} via Nexus (UniFi Access)`,
        summary: `${name} unlocked by ${user.name}`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: { door_id: params.id, door_name: name, by_user_id: user.id, by_name: user.name, vendor: 'unifi' } as any,
      })
    } catch { /* audit best-effort */ }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'UniFi Access unlock failed' }, { status: 502 })
  }
}
