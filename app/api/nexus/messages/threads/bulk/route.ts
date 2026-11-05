import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { applyThreadAction, ACTIONS, type Action } from '@/lib/mail-actions'
import { FOLDERS, applyFolder, type Folder } from '@/lib/mail-folders'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const MAX = 300

// POST /api/nexus/messages/threads/bulk
//   { ids: [...], action }                       → the conversations you picked
//   { folder: 'inbox', all: true, action }       → everything in that folder (e.g. Mark all as read)
// Same actions as one conversation (read, unread, archive, inbox, star = flag, unstar,
// trash, untrash, snooze + until). Done here and in Gmail. Only your own mail.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  const body = await req.json().catch(() => ({}))
  const action = body?.action as Action
  if (!ACTIONS.includes(action)) return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let threads: any[] = []
  if (body?.all === true) {
    const folder = (FOLDERS.includes(body.folder) ? body.folder : 'inbox') as Folder
    let q = applyFolder(supabase.from('message_threads').select('*').eq('user_id', user.id), folder, new Date().toISOString())
    if (action === 'read') q = q.gt('unread_count', 0)          // only what needs it
    const { data, error } = await q.order('last_message_at', { ascending: false }).limit(MAX)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    threads = data ?? []
  } else {
    const ids = (Array.isArray(body?.ids) ? body.ids : []).filter((s: unknown) => typeof s === 'string' && /^[0-9a-f-]{36}$/i.test(s)).slice(0, MAX)
    if (!ids.length) return NextResponse.json({ error: 'Pick at least one email.' }, { status: 400 })
    const { data, error } = await supabase.from('message_threads').select('*').eq('user_id', user.id).in('id', ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    threads = data ?? []
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channels = new Map<string, any>()
  let done = 0, failed = 0, needsReconnect = false
  const queue = [...threads]
  await Promise.all(Array.from({ length: Math.min(5, queue.length) }, async () => {
    while (queue.length) {
      const t = queue.shift()!
      const r = await applyThreadAction(supabase, t, action, typeof body?.until === 'string' ? body.until : undefined, channels)
      if (r.ok) done++; else failed++
      if (r.gmail?.needs_reconnect) needsReconnect = true
      if (!r.ok && r.status === 400) { queue.length = 0; return }
    }
  }))
  return NextResponse.json({ ok: failed === 0, done, failed, more: body?.all === true && threads.length === MAX, gmail: { needs_reconnect: needsReconnect } })
}
