/**
 * GET   /api/notifications            — my latest 30 notifications + unread count
 * PATCH /api/notifications { ids }    — mark these read
 * PATCH /api/notifications { all: true } — mark everything read
 * Only ever touches the caller's own rows (user_id = Clerk ID).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { supabaseAdmin as supabase } from '@/lib/todo-activity'

export const dynamic = 'force-dynamic'

export async function GET() {
  const u = await getCurrentUser()
  if (!u.id || u.id === 'anonymous') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [list, unread] = await Promise.all([
    supabase.from('notifications')
      .select('id, type, title, body, link, entity_type, entity_id, actor_name, read_at, created_at')
      .eq('user_id', u.id).order('created_at', { ascending: false }).limit(30),
    supabase.from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', u.id).is('read_at', null),
  ])
  if (list.error) return NextResponse.json({ error: list.error.message }, { status: 500 })
  if (unread.error) return NextResponse.json({ error: unread.error.message }, { status: 500 })
  return NextResponse.json({ notifications: list.data ?? [], unread: unread.count ?? 0 })
}

export async function PATCH(req: NextRequest) {
  const u = await getCurrentUser()
  if (!u.id || u.id === 'anonymous') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { ids?: unknown; all?: unknown }

  let q = supabase.from('notifications').update({ read_at: new Date().toISOString() })
    .eq('user_id', u.id).is('read_at', null)
  if (body.all !== true) {
    const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === 'string').slice(0, 100) : []
    if (!ids.length) return NextResponse.json({ error: 'ids or all required' }, { status: 400 })
    q = q.in('id', ids)
  }
  const { error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
