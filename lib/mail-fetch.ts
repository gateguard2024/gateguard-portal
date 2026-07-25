// lib/mail-fetch.ts
// Inbound mail reader for the Nexus Messages connectors.
//
// Currently implements Gmail (REST API + stored OAuth refresh token). IMAP for
// generic SMTP mailboxes is a future addition — SMTP connectors are send-only today.
//
// fetchGmailInbox() pulls recent INBOX **and SENT** messages, dedupes by Gmail
// message id, groups them into message_threads by Gmail threadId, inserts rows
// with the correct direction, and recomputes each touched thread's
// last_message_at + unread_count (so it works whether or not the 095 thread
// triggers are present). After each sync it runs the CRM auto-matcher so new
// conversations attach themselves to opportunities/customers (lib/email-match).

import type { SupabaseClient } from '@supabase/supabase-js'
import { getGmailAccessToken } from './mail-send'
import { autoLinkThread } from './email-match'

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

// Parse a full To/Cc header ("A <a@x>, b@y, ...") into address objects.
function parseAddressList(raw: string): { name: string; address: string }[] {
  if (!raw.trim()) return []
  // Split on commas that are not inside quoted display names.
  const parts = raw.match(/(?:[^,"]|"[^"]*")+/g) ?? []
  return parts.map((p) => parseAddress(p)).filter((p) => p.address.includes('@'))
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

// Pull the raw HTML body (formatted) so the reader can show it as a real email,
// not stripped text. Recurses into multipart/alternative + multipart/related.
function extractHtml(payload: GmailPart | undefined): string {
  if (!payload) return ''
  const decode = (data?: string) => (data ? Buffer.from(data, 'base64url').toString('utf8') : '')
  if (payload.mimeType === 'text/html' && payload.body?.data) return decode(payload.body.data)
  if (payload.parts?.length) {
    const htmlPart = payload.parts.find((p) => p.mimeType === 'text/html')
    if (htmlPart?.body?.data) return decode(htmlPart.body.data)
    for (const p of payload.parts) {
      const nested = extractHtml(p)
      if (nested) return nested
    }
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

  // Inbox AND sent — sent mail must sync so it can auto-attach to CRM records.
  const q = encodeURIComponent(opts.query ?? '(in:inbox OR in:sent) newer_than:7d')
  const max = opts.maxResults ?? 40
  const selfAddress: string = (channel.config?.from_address ?? '').toLowerCase()

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
  const threadAddrs = new Map<string, Set<string>>() // dbThreadId → all non-self addresses seen
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
        labelIds?: string[]
        snippet?: string
        internalDate?: string
        payload?: { headers?: GmailHeader[] } & GmailPart
      }
      const headers = msg.payload?.headers ?? []
      const from = parseAddress(headerValue(headers, 'From'))
      const toList = [
        ...parseAddressList(headerValue(headers, 'To')),
        ...parseAddressList(headerValue(headers, 'Cc')),
      ]
      const subject = headerValue(headers, 'Subject')
      const dateHeader = headerValue(headers, 'Date')
      const receivedAt = msg.internalDate
        ? new Date(Number(msg.internalDate)).toISOString()
        : dateHeader
          ? new Date(dateHeader).toISOString()
          : new Date().toISOString()
      const body = extractBody(msg.payload) || msg.snippet || ''
      const bodyHtml = extractHtml(msg.payload)

      // Sent mail syncs too now — direction from Gmail labels (fallback: From = self).
      const isOutbound =
        (msg.labelIds ?? []).includes('SENT') ||
        (!!selfAddress && from.address.toLowerCase() === selfAddress)

      // Every address on the message except our own — participants + CRM matching.
      const others = [from, ...toList].filter(
        (p) => p.address && p.address.toLowerCase() !== selfAddress,
      )

      // Find or create the thread for this Gmail conversation.
      const gthread = msg.threadId || threadId
      let dbThreadId: string
      const { data: thread } = await supabase
        .from('message_threads')
        .select('id, participants')
        .eq('channel_id', channel.id)
        .eq('external_thread_id', gthread)
        .maybeSingle()
      if (thread) {
        dbThreadId = thread.id
        // Union new addresses into the stored participants list.
        const existing = Array.isArray(thread.participants) ? thread.participants : []
        const known = new Set(existing.map((p: any) => String(p?.address ?? '').toLowerCase()))
        const additions = others.filter((p) => !known.has(p.address.toLowerCase()))
        if (additions.length) {
          await supabase
            .from('message_threads')
            .update({ participants: [...existing, ...additions] })
            .eq('id', dbThreadId)
        }
      } else {
        const { data: created, error: cErr } = await supabase
          .from('message_threads')
          .insert({
            user_id: channel.user_id,
            org_id: channel.org_id,
            channel_id: channel.id,
            external_thread_id: gthread,
            subject: subject || '(no subject)',
            participants: others.length ? others : [{ name: from.name, address: from.address }],
            last_message_at: receivedAt,
          })
          .select('id')
          .single()
        if (cErr || !created) continue
        dbThreadId = created.id
      }

      const { error: insErr } = await supabase.from('messages').insert({
        thread_id: dbThreadId,
        channel_id: channel.id,
        external_message_id: id,
        direction: isOutbound ? 'outbound' : 'inbound',
        source_type: 'gmail',
        from_address: from.address,
        from_name: from.name || null,
        to_addresses: toList.length
          ? toList
          : [{ name: '', address: channel.config?.from_address ?? '' }],
        subject: subject || null,
        body,
        body_html: bodyHtml || null,
        status: isOutbound ? 'sent' : 'delivered',
        sent_at: isOutbound ? receivedAt : null,
        created_at: receivedAt,
      })
      if (insErr) continue
      touchedThreads.add(dbThreadId)
      const bag = threadAddrs.get(dbThreadId) ?? new Set<string>()
      for (const p of others) bag.add(p.address.toLowerCase())
      threadAddrs.set(dbThreadId, bag)
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

  // 5) Auto-attach touched threads to opportunities/customers by contact email.
  for (const [tid, addrs] of threadAddrs) {
    try {
      await autoLinkThread(supabase, tid, [...addrs], selfAddress)
    } catch {
      /* matching is best-effort — never fail the sync */
    }
  }

  await supabase
    .from('message_channels')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', channel.id)

  return { fetched }
}

// Backfill formatted HTML for messages stored before HTML capture existed, so
// older emails also render as real letters instead of ugly plain-text + URL dumps.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function backfillGmailHtml(supabase: any, channel: any, limit = 40): Promise<number> {
  if (channel.channel_type !== 'gmail' || !channel.oauth_refresh_token) return 0
  const { token } = await getGmailAccessToken(channel.oauth_refresh_token)
  if (!token) return 0
  const { data: rows } = await supabase
    .from('messages')
    .select('id, external_message_id')
    .eq('channel_id', channel.id)
    .is('body_html', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  let filled = 0
  for (const r of rows ?? []) {
    if (!r.external_message_id) continue
    try {
      const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${r.external_message_id}?format=full`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) continue
      const msg = await res.json() as { payload?: GmailPart }
      const html = extractHtml(msg.payload)
      if (html) { await supabase.from('messages').update({ body_html: html }).eq('id', r.id); filled++ }
    } catch { /* skip */ }
  }
  return filled
}
