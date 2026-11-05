/**
 * /api/nexus/messages/threads/[id]
 *   GET   → the whole conversation (every email with its formatted body, attachments,
 *           cc), oldest first. Inline pictures point at /api/nexus/messages/attachment.
 *   PATCH → { action: read | unread | archive | inbox | star | unstar | trash | untrash | snooze | unsnooze, until? }
 *           does it here AND in Gmail (two-way), or
 *           { linked_type, linked_id, linked_label } → link the thread to a CRM record, or
 *           { read: true } (older callers).
 * Always scoped to the thread's owner.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { recomputeThread, gmailThreadAction, writeSafe } from '@/lib/mail-fetch'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

async function ownThread(id: string, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const { data } = await supabase.from('message_threads').select('*').eq('id', id).maybeSingle()
  return data && data.user_id === userId ? data : null
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  const thread = await ownThread(params.id, user.id)
  if (!thread) return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 })

  const { data: msgs, error } = await supabase.from('messages').select('*').eq('thread_id', thread.id).order('created_at', { ascending: true }).limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const messages = (msgs ?? []).map((m) => {
    const atts = (Array.isArray(m.attachments) ? m.attachments : []) as { name: string; mime_type: string; size: number; attachment_id: string; content_id?: string | null; inline?: boolean }[]
    const url = (a: { attachment_id: string }, inline = false) =>
      `/api/nexus/messages/attachment?m=${m.id}&a=${encodeURIComponent(a.attachment_id)}${inline ? '&inline=1' : ''}`
    let html: string = m.body_html || ''
    for (const a of atts) if (a.content_id) html = html.split(`cid:${a.content_id}`).join(url(a, true))
    return {
      id: m.id,
      direction: m.direction === 'outbound' ? 'out' : 'in',
      channel: m.source_type === 'sms' || m.source_type === 'twilio' ? 'text' : m.source_type === 'phone' ? 'call' : 'email',
      from_name: m.from_name ?? null,
      from_address: m.from_address ?? null,
      to: Array.isArray(m.to_addresses) ? m.to_addresses : [],
      cc: Array.isArray(m.cc_addresses) ? m.cc_addresses : [],
      subject: m.subject ?? '',
      body: m.body ?? '',
      body_html: html,
      snippet: m.snippet ?? null,
      at: m.created_at,
      unread: m.direction === 'inbound' && !m.read_at,
      failed: m.status === 'failed',
      error: m.status === 'failed' ? (m.error_message ?? 'Not sent') : null,
      bulk: !!m.is_bulk,
      attachments: atts.filter((a) => !a.inline).map((a) => ({ name: a.name, mime_type: a.mime_type, size: a.size, url: a.attachment_id ? url(a) : null, view_url: a.attachment_id ? url(a, true) : null })),
    }
  })

  return NextResponse.json({
    thread: {
      id: thread.id,
      subject: thread.subject ?? '(no subject)',
      participants: Array.isArray(thread.participants) ? thread.participants : [],
      channel_id: thread.channel_id,
      starred: !!thread.is_starred,
      archived: !!thread.is_archived,
      trashed: !!thread.is_trashed,
      snoozed_until: thread.snoozed_until ?? null,
      linked_type: thread.linked_type ?? (thread.linked_opportunity_id ? 'opportunity' : thread.linked_customer_org_id ? 'customer' : null),
      linked_id: thread.linked_id ?? thread.linked_opportunity_id ?? thread.linked_customer_org_id ?? null,
      linked_label: thread.linked_label ?? null,
    },
    messages,
  })
}

type Action = 'read' | 'unread' | 'archive' | 'inbox' | 'star' | 'unstar' | 'trash' | 'untrash' | 'snooze' | 'unsnooze'
const ACTIONS: Action[] = ['read', 'unread', 'archive', 'inbox', 'star', 'unstar', 'trash', 'untrash', 'snooze', 'unsnooze']

// The same label change Gmail will make, applied to our copy so the folders are right
// immediately (the live sync then confirms it from Gmail).
const LABEL_EDIT: Partial<Record<Action, { add?: string; remove?: string }>> = {
  archive: { remove: 'INBOX' }, inbox: { add: 'INBOX' },
  star: { add: 'STARRED' }, unstar: { remove: 'STARRED' },
  trash: { add: 'TRASH' }, untrash: { remove: 'TRASH' },
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  const body = await req.json().catch(() => ({}))
  const thread = await ownThread(params.id, user.id)
  if (!thread) return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 })

  const action: Action | null = body.read === true ? 'read' : ACTIONS.includes(body.action) ? body.action : null

  if (action) {
    const now = new Date().toISOString()
    if (action === 'snooze' || action === 'unsnooze') {
      const until = action === 'snooze' ? clean(body.until) : ''
      if (action === 'snooze' && (!until || isNaN(Date.parse(until)) || Date.parse(until) < Date.now())) {
        return NextResponse.json({ error: 'Pick a time in the future.' }, { status: 400 })
      }
      const { error } = await supabase.from('message_threads').update({ snoozed_until: action === 'snooze' ? new Date(until).toISOString() : null }).eq('id', thread.id)
      if (error) return NextResponse.json({ error: /column|schema/i.test(error.message) ? 'Snooze needs migration 222.' : error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    if (action === 'read' || action === 'unread') {
      if (action === 'read') {
        const { error } = await supabase.from('messages').update({ read_at: now }).eq('thread_id', thread.id).eq('direction', 'inbound').is('read_at', null)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      } else {
        // Unread = the newest email from them goes back to unread.
        const { data: last } = await supabase.from('messages').select('id').eq('thread_id', thread.id).eq('direction', 'inbound')
          .order('created_at', { ascending: false }).limit(1).maybeSingle()
        if (last) {
          const { error } = await supabase.from('messages').update({ read_at: null }).eq('id', last.id)
          if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        }
      }
      const { data: msgs } = await supabase.from('messages').select('id, labels').eq('thread_id', thread.id)
      for (const m of msgs ?? []) {
        if (!Array.isArray(m.labels)) continue
        const has = m.labels.includes('UNREAD')
        if (action === 'read' && has) await supabase.from('messages').update({ labels: m.labels.filter((l: string) => l !== 'UNREAD') }).eq('id', m.id)
      }
    } else {
      const edit = LABEL_EDIT[action]!
      const { data: msgs, error } = await supabase.from('messages').select('id, labels').eq('thread_id', thread.id)
      if (!error) {
        for (const m of msgs ?? []) {
          const cur: string[] = Array.isArray(m.labels) ? m.labels : []
          let next = cur
          if (edit.add && !cur.includes(edit.add)) next = [...cur, edit.add]
          if (edit.remove) next = next.filter((l) => l !== edit.remove)
          if (next !== cur) await supabase.from('messages').update({ labels: next }).eq('id', m.id)
        }
      }
      // Works before migration 222 too (no labels yet): set the thread flag directly.
      const flag: Record<string, unknown> =
        action === 'archive' ? { is_archived: true } : action === 'inbox' ? { is_archived: false, is_trashed: false }
        : action === 'star' ? { is_starred: true } : action === 'unstar' ? { is_starred: false }
        : action === 'trash' ? { is_trashed: true } : { is_trashed: false }
      const { error: fErr } = await supabase.from('message_threads').update(flag).eq('id', thread.id)
      if (fErr && /column|schema/i.test(fErr.message)) return NextResponse.json({ error: 'This needs migration 222.' }, { status: 500 })
    }
    await recomputeThread(supabase, thread.id)
    if (action === 'archive') await supabase.from('message_threads').update({ is_archived: true }).eq('id', thread.id)

    // Same change in Gmail.
    let gmail: { ok: boolean; needs_reconnect?: boolean; error?: string } = { ok: true }
    if (thread.external_thread_id && thread.channel_id) {
      const { data: ch } = await supabase.from('message_channels').select('*').eq('id', thread.channel_id).maybeSingle()
      if (ch?.channel_type === 'gmail' && ch.oauth_refresh_token) gmail = await gmailThreadAction(ch, thread.external_thread_id, action)
    }
    return NextResponse.json({ ok: true, gmail })
  }

  // Assign/clear the linked CRM record.
  const linkedType = clean(body.linked_type)
  const { error } = await writeSafe((row) => supabase.from('message_threads').update(row).eq('id', thread.id), {
    linked_type: linkedType || null,
    linked_id: linkedType ? (clean(body.linked_id) || null) : null,
    linked_label: linkedType ? (clean(body.linked_label) || null) : null,
    updated_at: new Date().toISOString(),
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
