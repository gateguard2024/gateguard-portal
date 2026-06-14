// lib/mail-fetch.ts
// Inbound mail reader for the Nexus Messages connectors.
//
// Currently implements Gmail (REST API + stored OAuth refresh token). IMAP for
// generic SMTP mailboxes is a future addition — SMTP connectors are send-only today.
//
// fetchGmailInbox() pulls recent INBOX messages, dedupes by Gmail message id,
// groups them into message_threads by Gmail threadId, inserts inbound rows, and
// recomputes each touched thread's last_message_at + unread_count (so it works
// whether or not the 095 thread triggers are present).

import type { SupabaseClient } from '@supabase/supabase-js'
import { getGmailAccessToken } from './mail-send'

interface GmailHeader { name: string; value: string }
interface GmailPart { mimeType?: string; body?: { data?: string }; parts?: GmailPart[] }

function headerValue(headers: GmailHeader[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

// Parse "Display Name <addr@x.com>" into its pieces.
function parseAddress(raw: string): { name: string; address: string } {
  const m = raw.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/)
  if (m) return { name: m[1].trim(), address: m[2].trim() }
  return { name: '', address: raw.trim() }
}

// Recursively pull the best text body out of a Gmail payload.
function extractBody(payload: GmailPart | undefined): string {
  if (!payload) return ''
  const decode = (data?: string) => (data ? Buffer.from(data, 'base64url').toString('utf8') : '')
  if (payload.mimeType === 'text/plain' && payload.body?.data) return decode(payload.body.data)
  if (payload.parts?.length) {
    const plain = payload.parts.find((p) => p.mimeType === 'text/plain')
    if (plain?.body?.data) return decode(plain.body.data)
    for (const p of payload.parts) {
      const nested = extractBody(p)
      if (nested) return nested
    }
  }
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return decode(payload.body.data).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }
  return ''
}

export interface FetchResult { fetched: number; error?: string }

export async function fetchGmailInbox(
  supabase: SupabaseClient,
  channel: any,
  opts: { maxResults?: number; query?: string } = {},
): Promise<FetchResult> {
  if (channel.channel_type !== 'gmail' || !channel.oauth_refresh_token) {
    return { fetched: 0, error: 'not a connected Gmail channel' }
  }
  const { token, error } = await getGmailAccessToken(channel.oauth_refresh_token)
  if (!token) return { fetched: 0, error: error ?? 'no Gmail access token' }

  const q = encodeURIComponent(opts.query ?? 'in:inbox newer_than:7d')
  const max = opts.maxResults ?? 20

  // 1) List recent message ids.
  let ids: { id: string; threadId: string }[] = []
  try {
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=${max}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!listRes.ok) return { fetched: 0, error: `Gmail list failed: ${await listRes.text()}` }
    const data = (await listRes.json()) as { messages?: { id: string; threadId: string }[] }
    ids = data.messages ?? []
  } catch (err) {
    return { fetched: 0, error: err instanceof Error ? err.message : 'Gmail list exception' }
  }
  if (ids.length === 0) return { fetched: 0 }

  // 2) Skip messages we already stored.
  const candidateIds = ids.map((m) => m.id)
  const { data: existing } = await supabase
    .from('messages')
    .select('external_message_id')
    .eq('channel_id', channel.id)
    .in('external_message_id', candidateIds)
  const seen = new Set((existing ?? []).map((r: any) => r.external_message_id))
  const toFetch = ids.filter((m) => !seen.has(m.id))
  if (toFetch.length === 0) return { fetched: 0 }

  const touchedThreads = new Set<string>()
  let fetched = 0

  // 3) Fetch + store each new message.
  for (const { id, threadId } of toFetch) {
    try {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!msgRes.ok) continue
      const msg = (await msgRes.json()) as {
        threadId: string
        snippet?: string
        internalDate?: string
        payload?: { headers?: GmailHeader[] } & GmailPart
      }
      const headers = msg.payload?.headers ?? []
      const from = parseAddress(headerValue(headers, 'From'))
      const subject = headerValue(headers, 'Subject')
      const dateHeader = headerValue(headers, 'Date')
      const receivedAt = msg.internalDate
        ? new Date(Number(msg.internalDate)).toISOString()
        : dateHeader
          ? new Date(dateHeader).toISOString()
          : new Date().toISOString()
      const body = extractBody(msg.payload) || msg.snippet || ''

      // Find or create the thread for this Gmail conversation.
      const gthread = msg.threadId || threadId
      let dbThreadId: string
      const { data: thread } = await supabase
        .from('message_threads')
        .select('id')
        .eq('channel_id', channel.id)
        .eq('external_thread_id', gthread)
        .maybeSingle()
      if (thread) {
        dbThreadId = thread.id
      } else {
        const { data: created, error: cErr } = await supabase
          .from('message_threads')
          .insert({
            user_id: channel.user_id,
            org_id: channel.org_id,
            channel_id: channel.id,
            external_thread_id: gthread,
            subject: subject || '(no subject)',
            participants: [{ name: from.name, address: from.address }],
            last_message_at: receivedAt,
          })
          .select('id')
          .single()
        if (cErr || !created) continue
        dbThreadId = created.id
      }

      await supabase.from('messages').insert({
        thread_id: dbThreadId,
        channel_id: channel.id,
        external_message_id: id,
        direction: 'inbound',
        source_type: 'gmail',
        from_address: from.address,
        from_name: from.name || null,
        to_addresses: [{ name: '', address: channel.config?.from_address ?? '' }],
        subject: subject || null,
        body,
        status: 'delivered',
        created_at: receivedAt,
      })
      touchedThreads.add(dbThreadId)
      fetched++
    } catch {
      /* skip this message, continue */
    }
  }

  // 4) Recompute last_message_at + unread_count for touched threads (trigger-independent).
  for (const tid of touchedThreads) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('created_at, direction, read_at')
      .eq('thread_id', tid)
    if (!msgs?.length) continue
    const last = msgs.reduce((a: string, m: any) => (m.created_at > a ? m.created_at : a), msgs[0].created_at)
    const unread = msgs.filter((m: any) => m.direction === 'inbound' && !m.read_at).length
    await supabase
      .from('message_threads')
      .update({ last_message_at: last, unread_count: unread })
      .eq('id', tid)
  }

  await supabase
    .from('message_channels')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', channel.id)

  return { fetched }
}
