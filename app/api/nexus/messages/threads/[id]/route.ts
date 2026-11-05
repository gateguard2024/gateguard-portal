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
import { writeSafe } from '@/lib/mail-fetch'
import { applyThreadAction, ACTIONS, type Action } from '@/lib/mail-actions'

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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  const body = await req.json().catch(() => ({}))
  const thread = await ownThread(params.id, user.id)
  if (!thread) return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 })

  const action: Action | null = body.read === true ? 'read' : ACTIONS.includes(body.action) ? body.action : null

  if (action) {
    const r = await applyThreadAction(supabase, thread, action, clean(body.until))
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status ?? 500 })
    return NextResponse.json({ ok: true, gmail: r.gmail })
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
