// lib/mail-fetch.ts
// Live two-way Gmail sync for Nexus Mail.
//
// How it stays live:
//   • First run (or after Google forgets where we were): a FULL sync — the last 30 days
//     of Inbox + Sent + Starred (up to 400 messages, newest first), with each message's
//     Gmail labels so read / archived / starred match Gmail exactly.
//   • Every run after that: Gmail's history feed from the last historyId — only what
//     changed (new mail, read/unread, archive, star, trash, deleted). Cheap enough to
//     run every minute (Inngest `nexus-sync-mailboxes`) and whenever the inbox opens.
//
// Thread state is always derived from its messages' labels:
//   unread = inbound messages with UNREAD · archived = no message in INBOX ·
//   starred = any STARRED · trashed = every message in TRASH · bulk = newsletters.
// After each sync the CRM auto-matcher attaches new conversations to deals/customers.
//
// Works before migration 222 too: writes drop the new columns and retry.

import type { SupabaseClient } from '@supabase/supabase-js'
import { getGmailAccessToken, isReconnectError } from './mail-send'
import { autoLinkThread } from './email-match'

const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me'

interface GmailHeader { name: string; value: string }
interface GmailPart {
  partId?: string
  mimeType?: string
  filename?: string
  headers?: GmailHeader[]
  body?: { data?: string; attachmentId?: string; size?: number }
  parts?: GmailPart[]
}
interface GmailMessage {
  id: string
  threadId: string
  labelIds?: string[]
  snippet?: string
  internalDate?: string
  historyId?: string
  payload?: GmailPart & { headers?: GmailHeader[] }
}

export interface MailAttachmentMeta {
  name: string
  mime_type: string
  size: number
  attachment_id: string
  content_id?: string | null   // inline image (cid:…)
  inline?: boolean
}

export interface FetchResult {
  fetched: number              // new messages stored
  updated?: number             // messages whose labels changed
  removed?: number             // messages deleted in Gmail
  mode?: 'full' | 'history' | 'search'
  thread_ids?: string[]        // Nexus thread ids touched (search uses this)
  error?: string
  needs_reconnect?: boolean
}

// Columns added in migration 222 — dropped and retried if the DB doesn't have them yet.
const NEW_COLS = new Set([
  'gmail_history_id', 'last_error', 'last_error_at',
  'snippet', 'last_direction', 'last_from_name', 'last_from_address', 'message_count', 'labels',
  'is_archived', 'is_starred', 'is_trashed', 'is_bulk', 'has_attachments', 'snoozed_until',
  'rfc_message_id', 'cc_addresses',
])
const isMissingCol = (e: { message?: string; code?: string } | null) =>
  !!e && (e.code === 'PGRST204' || e.code === '42703' || /column|schema cache/i.test(e.message ?? ''))
const strip = (row: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(row).filter(([k]) => !NEW_COLS.has(k)))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Q = PromiseLike<{ data: any; error: any }>
export async function writeSafe(run: (row: Record<string, unknown>) => Q, row: Record<string, unknown>) {
  const r = await run(row)
  if (r.error && isMissingCol(r.error)) return run(strip(row))
  return r
}

// ─── small helpers ────────────────────────────────────────────────────────────
function headerValue(headers: GmailHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}
// RFC 2047 decode ("=?UTF-8?B?…?=" / "=?utf-8?Q?…?=") for names + subjects.
function decodeWords(v: string): string {
  return v.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_m, _cs, enc, txt) => {
    try {
      if (enc.toUpperCase() === 'B') return Buffer.from(txt, 'base64').toString('utf8')
      return Buffer.from(txt.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (_x: string, h: string) => String.fromCharCode(parseInt(h, 16))), 'latin1').toString('utf8')
    } catch { return txt }
  })
}
export function parseAddress(raw: string): { name: string; address: string } {
  const v = decodeWords(raw)
  const m = v.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/)
  if (m) return { name: m[1].trim(), address: m[2].trim() }
  return { name: '', address: v.trim() }
}
export function parseAddressList(raw: string): { name: string; address: string }[] {
  if (!raw.trim()) return []
  const parts = raw.match(/(?:[^,"]|"[^"]*")+/g) ?? []
  return parts.map((p) => parseAddress(p)).filter((p) => p.address.includes('@'))
}
const decode = (data?: string) => (data ? Buffer.from(data, 'base64url').toString('utf8') : '')

function extractBody(payload: GmailPart | undefined): string {
  if (!payload) return ''
  if (payload.mimeType === 'text/plain' && payload.body?.data && !payload.filename) return decode(payload.body.data)
  if (payload.parts?.length) {
    const plain = payload.parts.find((p) => p.mimeType === 'text/plain' && !p.filename)
    if (plain?.body?.data) return decode(plain.body.data)
    for (const p of payload.parts) {
      const nested = extractBody(p)
      if (nested) return nested
    }
  }
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return decode(payload.body.data).replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }
  return ''
}
function extractHtml(payload: GmailPart | undefined): string {
  if (!payload) return ''
  if (payload.mimeType === 'text/html' && payload.body?.data && !payload.filename) return decode(payload.body.data)
  if (payload.parts?.length) {
    const htmlPart = payload.parts.find((p) => p.mimeType === 'text/html' && !p.filename)
    if (htmlPart?.body?.data) return decode(htmlPart.body.data)
    for (const p of payload.parts) {
      const nested = extractHtml(p)
      if (nested) return nested
    }
  }
  return ''
}
export function extractAttachments(payload: GmailPart | undefined, out: MailAttachmentMeta[] = []): MailAttachmentMeta[] {
  if (!payload) return out
  if (payload.body?.attachmentId && (payload.filename || payload.mimeType?.startsWith('image/'))) {
    const cid = headerValue(payload.headers, 'Content-ID').replace(/[<>]/g, '') || null
    const disp = headerValue(payload.headers, 'Content-Disposition').toLowerCase()
    out.push({
      name: payload.filename || `image.${(payload.mimeType ?? 'image/png').split('/')[1]}`,
      mime_type: payload.mimeType ?? 'application/octet-stream',
      size: payload.body.size ?? 0,
      attachment_id: payload.body.attachmentId,
      content_id: cid,
      inline: !!cid && !disp.startsWith('attachment'),
    })
  }
  for (const p of payload.parts ?? []) extractAttachments(p, out)
  return out
}

// Newsletters, notifications, receipts → "Other". Real people → "Priority".
const BULK_FROM = /(^|[._+-])(no-?reply|do-?not-?reply|notifications?|notify|alerts?|mailer|news(letter)?|marketing|updates?|digest|info|hello|team|support|billing|receipts?|accounts?)@/i
const BULK_LABELS = ['CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS']
// Senders that are machines, not people (receipts, alerts, Nexus's own notices…).
const AUTOMATED = /^(no-?reply|do-?not-?reply|donotreply|notifications?|notify|alerts?|mailer(-daemon)?|bounces?|news(letter)?s?|marketing|digest|reports?|updates?|automated|system|postmaster|invitations?|calendar-notification|feedback|surveys?|promo(tions)?|deals|offers)([+._-][^@]*)?@/i
export const automatedAddress = (addr: string | null | undefined) => AUTOMATED.test(String(addr ?? '').trim())
const CATEGORY_BULK = ['CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS']

export function looksBulk(headers: GmailHeader[] | undefined, fromAddress: string, labels: string[]): boolean {
  if (labels.some((l) => BULK_LABELS.includes(l))) return true
  if (headerValue(headers, 'List-Unsubscribe') || headerValue(headers, 'List-Id')) return true
  const prec = headerValue(headers, 'Precedence').toLowerCase()
  if (prec === 'bulk' || prec === 'list' || prec === 'junk') return true
  const auto = headerValue(headers, 'Auto-Submitted').toLowerCase()
  if (auto && auto !== 'no') return true
  return /^(no-?reply|do-?not-?reply|notifications?|mailer-daemon)@/i.test(fromAddress) || (BULK_FROM.test(fromAddress) && /^(no-?reply|do-?not-?reply|notifications?|notify|alerts?|mailer|news(letter)?|marketing|digest)/i.test(fromAddress))
}

async function gget<T>(token: string, path: string): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${GMAIL}${path}`, { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) return { ok: true, data: (await res.json()) as T }
    if ((res.status === 429 || res.status >= 500) && attempt < 2) { await new Promise((r) => setTimeout(r, 400 * (attempt + 1))); continue }
    return { ok: false, status: res.status, error: `Gmail ${res.status}: ${(await res.text()).slice(0, 300)}` }
  }
  return { ok: false, status: 0, error: 'Gmail unreachable' }
}
async function pmap<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]) }
  }))
  return out
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function noteChannel(supabase: SupabaseClient, channel: any, patch: Record<string, unknown>) {
  const r = await writeSafe((row) => supabase.from('message_channels').update(row).eq('id', channel.id), patch)
  if (r.error) console.error('mail sync: channel update failed', r.error.message)
}

// ─── storing one Gmail message ────────────────────────────────────────────────
interface Ctx {
  supabase: SupabaseClient
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  channel: any
  selfAddress: string
  touched: Set<string>                       // Nexus thread ids to recompute
  newThreadAddrs: Map<string, Set<string>>   // thread → addresses for CRM matching
  threadCache: Map<string, string>           // gmail threadId → Nexus thread id
  heavy?: boolean                            // background run: allowed to do big one-time jobs
}

async function findOrCreateThread(ctx: Ctx, gthread: string, subject: string, others: { name: string; address: string }[], from: { name: string; address: string }, at: string): Promise<string | null> {
  const cached = ctx.threadCache.get(gthread)
  if (cached) return cached
  const { supabase, channel } = ctx
  const lookup = async () => {
    const { data } = await supabase.from('message_threads').select('id, participants')
      .eq('channel_id', channel.id).eq('external_thread_id', gthread).order('created_at').limit(1).maybeSingle()
    return data as { id: string; participants: unknown } | null
  }
  const found = await lookup()
  if (found) {
    const existing = Array.isArray(found.participants) ? (found.participants as { name?: string; address?: string }[]) : []
    const known = new Set(existing.map((p) => String(p?.address ?? '').toLowerCase()))
    const additions = others.filter((p) => !known.has(p.address.toLowerCase()))
    if (additions.length) await supabase.from('message_threads').update({ participants: [...existing, ...additions] }).eq('id', found.id)
    ctx.threadCache.set(gthread, found.id)
    return found.id
  }
  const { data: created, error } = await writeSafe((row) => supabase.from('message_threads').insert(row).select('id').single(), {
    user_id: channel.user_id,
    org_id: channel.org_id,
    channel_id: channel.id,
    external_thread_id: gthread,
    subject: subject || '(no subject)',
    participants: others.length ? others : [{ name: from.name, address: from.address }],
    last_message_at: at,
  })
  if (error) {
    // Another sync made it a moment ago (unique index) → use that one.
    if (error.code === '23505') { const again = await lookup(); if (again) { ctx.threadCache.set(gthread, again.id); return again.id } }
    console.error('mail sync: thread insert failed', error.message)
    return null
  }
  ctx.threadCache.set(gthread, created.id)
  return created.id
}

async function storeMessage(ctx: Ctx, msg: GmailMessage): Promise<boolean> {
  const { supabase, channel, selfAddress } = ctx
  const headers = msg.payload?.headers ?? []
  const labels = msg.labelIds ?? []
  if (labels.includes('SPAM') || labels.includes('CHAT') || labels.includes('DRAFT')) return false
  const from = parseAddress(headerValue(headers, 'From'))
  const to = parseAddressList(headerValue(headers, 'To'))
  const cc = parseAddressList(headerValue(headers, 'Cc'))
  const subject = decodeWords(headerValue(headers, 'Subject'))
  const dateHeader = headerValue(headers, 'Date')
  const at = msg.internalDate ? new Date(Number(msg.internalDate)).toISOString()
    : dateHeader && !isNaN(Date.parse(dateHeader)) ? new Date(dateHeader).toISOString() : new Date().toISOString()
  const isOutbound = labels.includes('SENT') || (!!selfAddress && from.address.toLowerCase() === selfAddress)
  const others = [from, ...to, ...cc].filter((p) => p.address && p.address.toLowerCase() !== selfAddress)
  const threadId = await findOrCreateThread(ctx, msg.threadId, subject, others, from, at)
  if (!threadId) return false
  const atts = extractAttachments(msg.payload)
  const row = {
    thread_id: threadId,
    channel_id: channel.id,
    external_message_id: msg.id,
    direction: isOutbound ? 'outbound' : 'inbound',
    source_type: 'gmail',
    from_address: from.address || selfAddress || 'unknown',
    from_name: from.name || null,
    to_addresses: to.length ? to : [{ name: '', address: selfAddress }],
    cc_addresses: cc,
    subject: subject || null,
    body: extractBody(msg.payload) || msg.snippet || '',
    body_html: extractHtml(msg.payload) || null,
    snippet: (msg.snippet ?? '').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').slice(0, 300) || null,
    attachments: atts,
    labels,
    rfc_message_id: headerValue(headers, 'Message-ID') || headerValue(headers, 'Message-Id') || null,
    is_bulk: !isOutbound && looksBulk(headers, from.address, labels),
    status: isOutbound ? 'sent' : 'delivered',
    sent_at: isOutbound ? at : null,
    read_at: isOutbound || !labels.includes('UNREAD') ? at : null,
    created_at: at,
  }
  const { error } = await writeSafe((r) => supabase.from('messages').insert(r), row)
  if (error) {
    if (error.code !== '23505') console.error('mail sync: message insert failed', error.message)
    return false
  }
  ctx.touched.add(threadId)
  const bag = ctx.newThreadAddrs.get(threadId) ?? new Set<string>()
  for (const p of others) bag.add(p.address.toLowerCase())
  ctx.newThreadAddrs.set(threadId, bag)
  return true
}

// Our copy of a message we sent from Nexus (stored before Gmail gave it back).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function applyLabels(ctx: Ctx, rows: { id: string; thread_id: string; direction: string; read_at: string | null; created_at: string }[], labels: string[]) {
  for (const r of rows) {
    const patch: Record<string, unknown> = { labels }
    if (r.direction === 'inbound') patch.read_at = labels.includes('UNREAD') ? null : (r.read_at ?? new Date().toISOString())
    const { error } = await writeSafe((row) => ctx.supabase.from('messages').update(row).eq('id', r.id), patch)
    if (error) console.error('mail sync: label update failed', error.message)
    ctx.touched.add(r.thread_id)
  }
}

// Re-derive a thread's list fields from its messages.
export async function recomputeThread(supabase: SupabaseClient, threadId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let res: { data: any[] | null; error: any } = await supabase.from('messages')
    .select('created_at, direction, read_at, labels, snippet, body, subject, from_name, from_address, attachments, is_bulk')
    .eq('thread_id', threadId)
  if (res.error && isMissingCol(res.error)) {
    res = await supabase.from('messages').select('created_at, direction, read_at, body, subject, from_name, from_address, attachments').eq('thread_id', threadId)
  }
  if (res.error) { console.error('mail sync: recompute read failed', res.error.message); return }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const msgs = (res.data ?? []) as any[]
  if (!msgs.length) {
    // Every message was deleted in Gmail → the conversation is gone too.
    await supabase.from('message_threads').delete().eq('id', threadId).not('external_thread_id', 'is', null)
    return
  }
  msgs.sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
  const last = msgs[msgs.length - 1]
  const lab = (m: { labels?: string[] }) => (Array.isArray(m.labels) ? m.labels : [])
  const all = new Set<string>(msgs.flatMap(lab))
  const inbound = msgs.filter((m) => m.direction === 'inbound')
  const bulkMsg = (m: { is_bulk?: boolean; labels?: string[]; from_address?: string }) =>
    !!m.is_bulk || lab(m).some((l) => CATEGORY_BULK.includes(l)) || automatedAddress(m.from_address)
  const unread = inbound.filter((m) => !m.read_at).length
  const hasLabels = msgs.some((m) => lab(m).length > 0)
  // The conversation's name = the first email's subject, without "Re:" / "Fwd:".
  const firstSubject = String(msgs.find((m) => m.subject)?.subject ?? '').replace(/^\s*((re|fwd?|aw|wg)\s*:\s*)+/i, '').trim()
  const patch: Record<string, unknown> = {
    ...(firstSubject ? { subject: firstSubject } : {}),
    last_message_at: last.created_at,
    unread_count: unread,
    snippet: String(last.snippet || last.body || '').replace(/\s+/g, ' ').trim().slice(0, 240) || null,
    last_direction: last.direction,
    last_from_name: last.from_name ?? null,
    last_from_address: last.from_address ?? null,
    message_count: msgs.length,
    labels: [...all],
    has_attachments: msgs.some((m) => Array.isArray(m.attachments) && m.attachments.some((a: MailAttachmentMeta) => !a.inline)),
    is_bulk: inbound.length > 0 && !msgs.some((m) => m.direction === 'outbound') && inbound.every(bulkMsg),
  }
  if (hasLabels) {
    patch.is_archived = !all.has('INBOX')
    patch.is_starred = all.has('STARRED')
    patch.is_trashed = msgs.every((m) => lab(m).includes('TRASH'))
  }
  const { error } = await writeSafe((row) => supabase.from('message_threads').update(row).eq('id', threadId), patch)
  if (error) console.error('mail sync: thread update failed', error.message)
}

async function fetchFull(token: string, id: string): Promise<GmailMessage | null> {
  const r = await gget<GmailMessage>(token, `/messages/${id}?format=full`)
  return r.ok ? r.data : null
}

async function storeIds(ctx: Ctx, token: string, ids: string[]): Promise<number> {
  if (!ids.length) return 0
  // Skip what we already have.
  const have = new Set<string>()
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await ctx.supabase.from('messages').select('external_message_id')
      .eq('channel_id', ctx.channel.id).in('external_message_id', ids.slice(i, i + 200))
    for (const r of data ?? []) have.add((r as { external_message_id: string }).external_message_id)
  }
  const todo = ids.filter((id) => !have.has(id))
  const results = await pmap(todo, 8, async (id) => {
    const m = await fetchFull(token, id)
    return m ? storeMessage(ctx, m) : false
  })
  return results.filter(Boolean).length
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function listIds(token: string, q: string, max: number): Promise<{ ids: { id: string; threadId: string }[]; error?: string; status?: number }> {
  const ids: { id: string; threadId: string }[] = []
  let page: string | undefined
  while (ids.length < max) {
    const r = await gget<{ messages?: { id: string; threadId: string }[]; nextPageToken?: string }>(
      token, `/messages?q=${encodeURIComponent(q)}&maxResults=${Math.min(500, max - ids.length)}${page ? `&pageToken=${page}` : ''}`)
    if (!r.ok) return { ids, error: r.error, status: r.status }
    ids.push(...(r.data.messages ?? []))
    page = r.data.nextPageToken
    if (!page) break
  }
  return { ids }
}

// ─── reconcile: make every stored message match Gmail ─────────────────────────
// Asks Gmail for the full lists of what's in the Inbox, unread, starred and in Trash
// (cheap: ids only, 500 per call) and fixes any stored message that disagrees —
// e.g. mail you read in Gmail weeks ago that still showed unread here.
const SET_MAX = 3000
async function reconcileLabels(ctx: Ctx, token: string): Promise<{ fixed: number; inbox_unread: number | null; at: string; bulk_v?: number }> {
  const at = new Date().toISOString()
  const [inbox, unread, starred, trash, inboxUnread, promo, social, upd, forums] = await Promise.all([
    listIds(token, 'in:inbox', SET_MAX), listIds(token, 'is:unread -in:spam', SET_MAX),
    listIds(token, 'is:starred', SET_MAX), listIds(token, 'in:trash', 1000),
    listIds(token, 'in:inbox is:unread', SET_MAX),
    // Gmail's own sorting (newsletters, social, receipts/notices, groups) → "Other".
    listIds(token, 'category:promotions newer_than:90d', SET_MAX), listIds(token, 'category:social newer_than:90d', 1000),
    listIds(token, 'category:updates newer_than:90d', SET_MAX), listIds(token, 'category:forums newer_than:90d', 1000),
  ])
  if (inbox.error || unread.error || starred.error || trash.error) return { fixed: 0, inbox_unread: null, at }
  const sets = {
    INBOX: { ids: new Set(inbox.ids.map((m) => m.id)), full: inbox.ids.length < SET_MAX },
    UNREAD: { ids: new Set(unread.ids.map((m) => m.id)), full: unread.ids.length < SET_MAX },
    STARRED: { ids: new Set(starred.ids.map((m) => m.id)), full: starred.ids.length < SET_MAX },
    TRASH: { ids: new Set(trash.ids.map((m) => m.id)), full: trash.ids.length < 1000 },
    // Only ever added (the lists are limited to 90 days).
    CATEGORY_PROMOTIONS: { ids: new Set((promo.error ? [] : promo.ids).map((m) => m.id)), full: false },
    CATEGORY_SOCIAL: { ids: new Set((social.error ? [] : social.ids).map((m) => m.id)), full: false },
    CATEGORY_UPDATES: { ids: new Set((upd.error ? [] : upd.ids).map((m) => m.id)), full: false },
    CATEGORY_FORUMS: { ids: new Set((forums.error ? [] : forums.ids).map((m) => m.id)), full: false },
  }
  // What each stored message should look like.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groups = new Map<string, { labels: string[]; read: boolean | null; ids: string[]; threads: string[] }>()
  let fixed = 0
  for (let page = 0; page < 15; page++) {
    let r = await ctx.supabase.from('messages').select('id, thread_id, direction, read_at, labels, external_message_id')
      .eq('channel_id', ctx.channel.id).not('external_message_id', 'is', null)
      .order('created_at', { ascending: false }).range(page * 1000, page * 1000 + 999)
    if (r.error && isMissingCol(r.error)) {
      r = await ctx.supabase.from('messages').select('id, thread_id, direction, read_at, external_message_id')
        .eq('channel_id', ctx.channel.id).not('external_message_id', 'is', null)
        .order('created_at', { ascending: false }).range(page * 1000, page * 1000 + 999) as typeof r
    }
    if (r.error) break
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (r.data ?? []) as any[]
    for (const row of rows) {
      const gid = row.external_message_id as string
      const cur: string[] = Array.isArray(row.labels) ? row.labels : []
      const next = new Set(cur)
      for (const [label, set] of Object.entries(sets)) {
        if (set.ids.has(gid)) next.add(label)
        else if (set.full) next.delete(label)
      }
      if (row.direction === 'outbound') next.add('SENT')
      const nextArr = [...next].sort()
      const labelsChanged = nextArr.join(',') !== [...cur].sort().join(',')
      let read: boolean | null = null
      if (row.direction === 'inbound') {
        const shouldUnread = sets.UNREAD.ids.has(gid)
        if (shouldUnread && row.read_at) read = false
        else if (!shouldUnread && !row.read_at && sets.UNREAD.full) read = true
      }
      if (!labelsChanged && read === null) continue
      const key = `${nextArr.join(',')}|${read}|${labelsChanged}`
      const g = groups.get(key) ?? { labels: nextArr, read, ids: [], threads: [] }
      g.ids.push(row.id); g.threads.push(row.thread_id)
      ;(g as { changed?: boolean }).changed = labelsChanged
      groups.set(key, g)
    }
    if (rows.length < 1000) break
  }
  for (const g of groups.values()) {
    const patch: Record<string, unknown> = {}
    if ((g as { changed?: boolean }).changed) patch.labels = g.labels
    if (g.read === true) patch.read_at = at
    if (g.read === false) patch.read_at = null
    for (let i = 0; i < g.ids.length; i += 200) {
      const { error } = await writeSafe((row) => ctx.supabase.from('messages').update(row).in('id', g.ids.slice(i, i + 200)), patch)
      if (error) { console.error('mail reconcile: update failed', error.message); continue }
    }
    fixed += g.ids.length
    for (const t of g.threads) ctx.touched.add(t)
  }
  // One time: re-sort every recent conversation with the better newsletter rules
  // (mail stored before them never got checked). Only on the background run.
  let bulk_v: number | undefined
  if (ctx.heavy && ctx.channel.config?.bulk_v !== 2) {
    const { data } = await ctx.supabase.from('message_threads').select('id').eq('channel_id', ctx.channel.id)
      .gte('last_message_at', new Date(Date.now() - 120 * 86400_000).toISOString()).limit(3000)
    for (const t of data ?? []) ctx.touched.add((t as { id: string }).id)
    bulk_v = 2
  }
  return { fixed, inbox_unread: inboxUnread.error ? null : inboxUnread.ids.length, at, ...(bulk_v ? { bulk_v } : {}) }
}

// ─── the sync ─────────────────────────────────────────────────────────────────
export async function fetchGmailInbox(
  supabase: SupabaseClient,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  channel: any,
  opts: { maxResults?: number; query?: string; full?: boolean; heavy?: boolean } = {},
): Promise<FetchResult> {
  if (channel.channel_type !== 'gmail' || !channel.oauth_refresh_token) {
    return { fetched: 0, error: 'not a connected Gmail channel' }
  }
  const { token, error } = await getGmailAccessToken(channel.oauth_refresh_token)
  if (!token) {
    const needs = isReconnectError(error)
    await noteChannel(supabase, channel, { last_error: needs ? 'Google ended the Gmail login — reconnect Gmail.' : (error ?? 'no Gmail access token'), last_error_at: new Date().toISOString() })
    return { fetched: 0, error: error ?? 'no Gmail access token', needs_reconnect: needs }
  }

  const ctx: Ctx = {
    supabase, channel,
    selfAddress: String(channel.config?.from_address ?? channel.display_name ?? '').toLowerCase(),
    touched: new Set(), newThreadAddrs: new Map(), threadCache: new Map(), heavy: !!opts.heavy,
  }
  let fetched = 0, updated = 0, removed = 0
  let mode: FetchResult['mode'] = 'history'
  let newHistoryId: string | null = null
  let reconcile: { fixed: number; inbox_unread: number | null; at: string; bulk_v?: number } | null = null

  try {
    if (opts.query) {
      // Search all of Gmail — bring in what matches so it opens in Nexus.
      mode = 'search'
      const l = await listIds(token, opts.query, opts.maxResults ?? 50)
      if (l.error) throw new Error(l.error)
      fetched = await storeIds(ctx, token, l.ids.map((m) => m.id))
      const gthreads = [...new Set(l.ids.map((m) => m.threadId))]
      const { data } = gthreads.length
        ? await supabase.from('message_threads').select('id').eq('channel_id', channel.id).in('external_thread_id', gthreads.slice(0, 200))
        : { data: [] }
      for (const t of data ?? []) ctx.touched.add((t as { id: string }).id)
    } else {
      let doFull = !!opts.full || !channel.gmail_history_id
      if (!doFull) {
        // Incremental: only what changed since last time.
        const added: string[] = []
        const labelNow = new Map<string, string[]>()   // message id → current labels
        const deleted: string[] = []
        let page: string | undefined
        let pages = 0
        while (pages++ < 10) {
          const r = await gget<{
            history?: {
              messagesAdded?: { message: GmailMessage }[]
              messagesDeleted?: { message: GmailMessage }[]
              labelsAdded?: { message: GmailMessage }[]
              labelsRemoved?: { message: GmailMessage }[]
            }[]
            historyId?: string
            nextPageToken?: string
          }>(token, `/history?startHistoryId=${channel.gmail_history_id}&maxResults=500${page ? `&pageToken=${page}` : ''}`)
          if (!r.ok) {
            if (r.status === 404) { doFull = true; break } // Google forgot that point → start over
            throw new Error(r.error)
          }
          for (const h of r.data.history ?? []) {
            for (const a of h.messagesAdded ?? []) { added.push(a.message.id); if (a.message.labelIds) labelNow.set(a.message.id, a.message.labelIds) }
            for (const a of [...(h.labelsAdded ?? []), ...(h.labelsRemoved ?? [])]) if (a.message.labelIds) labelNow.set(a.message.id, a.message.labelIds)
            for (const d of h.messagesDeleted ?? []) deleted.push(d.message.id)
          }
          newHistoryId = r.data.historyId ?? newHistoryId
          page = r.data.nextPageToken
          if (!page) break
        }
        if (!doFull) {
          const del = new Set(deleted)
          const keep = (id: string) => !del.has(id)
          // New mail (only messages that are in Inbox / Sent / Starred / Archived — not drafts or spam).
          const wanted = added.filter((id) => keep(id) && !(labelNow.get(id) ?? []).some((l) => l === 'DRAFT' || l === 'SPAM' || l === 'CHAT'))
          fetched = await storeIds(ctx, token, [...new Set(wanted)])
          // Read / unread, archive, star, trash done in Gmail (or by us — same result).
          const changed = [...labelNow.keys()].filter(keep)
          for (let i = 0; i < changed.length; i += 200) {
            const chunk = changed.slice(i, i + 200)
            const { data } = await supabase.from('messages').select('id, thread_id, direction, read_at, created_at, external_message_id')
              .eq('channel_id', channel.id).in('external_message_id', chunk)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const row of (data ?? []) as any[]) {
              const labels = labelNow.get(row.external_message_id)
              if (!labels) continue
              if (labels.includes('SPAM')) { await supabase.from('messages').delete().eq('id', row.id); ctx.touched.add(row.thread_id); removed++; continue }
              await applyLabels(ctx, [row], labels)
              updated++
            }
          }
          // Deleted forever in Gmail.
          if (deleted.length) {
            const { data } = await supabase.from('messages').select('id, thread_id').eq('channel_id', channel.id).in('external_message_id', deleted.slice(0, 500))
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const row of (data ?? []) as any[]) {
              await supabase.from('messages').delete().eq('id', row.id)
              ctx.touched.add(row.thread_id)
              removed++
            }
          }
        }
      }
      // Every 10 minutes, double-check read / archived / starred against Gmail itself
      // (catches anything the history feed missed, and mail older than 30 days).
      if (!doFull) {
        const last = Date.parse(channel.config?.reconcile?.at ?? '') || 0
        if (Date.now() - last > 10 * 60_000 || (opts.heavy && channel.config?.bulk_v !== 2)) { const rec = await reconcileLabels(ctx, token); updated += rec.fixed; reconcile = rec }
      }
      if (doFull) {
        mode = 'full'
        const prof = await gget<{ historyId?: string; emailAddress?: string }>(token, '/profile')
        if (!prof.ok) throw new Error(prof.error)
        newHistoryId = prof.data.historyId ?? null
        if (prof.data.emailAddress && !ctx.selfAddress) ctx.selfAddress = prof.data.emailAddress.toLowerCase()
        const max = opts.maxResults ?? 400
        const l = await listIds(token, '(in:inbox OR in:sent OR is:starred) newer_than:30d', max)
        if (l.error) throw new Error(l.error)
        fetched = await storeIds(ctx, token, l.ids.map((m) => m.id))
        // Remember where Gmail is now, so even if this request is cut short the next
        // run continues from here instead of starting over.
        if (newHistoryId) await noteChannel(supabase, channel, { gmail_history_id: newHistoryId })
        const rec = await reconcileLabels(ctx, token)
        updated += rec.fixed
        reconcile = rec
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gmail sync failed'
    const needs = isReconnectError(msg)
    await noteChannel(supabase, channel, { last_error: needs ? 'Gmail needs to be reconnected.' : msg.slice(0, 500), last_error_at: new Date().toISOString() })
    // Still recompute what we managed to store.
    for (const tid of ctx.touched) await recomputeThread(supabase, tid)
    return { fetched, updated, removed, mode, error: msg, needs_reconnect: needs }
  }

  await pmap([...ctx.touched], 6, (tid) => recomputeThread(supabase, tid))

  // Attach new conversations to deals / customers by who's on them.
  for (const [tid, addrs] of ctx.newThreadAddrs) {
    try { await autoLinkThread(supabase, tid, [...addrs], ctx.selfAddress) } catch { /* best-effort */ }
  }

  const patch: Record<string, unknown> = { last_synced_at: new Date().toISOString(), last_error: null, last_error_at: null }
  if (newHistoryId && mode !== 'search') patch.gmail_history_id = newHistoryId
  if (reconcile) {
    const { bulk_v, ...rec } = reconcile
    patch.config = { ...(channel.config ?? {}), reconcile: rec, ...(bulk_v ? { bulk_v } : {}) }
  }
  await noteChannel(supabase, channel, patch)

  return { fetched, updated, removed, mode, thread_ids: [...ctx.touched] }
}

// ─── two-way actions (Nexus → Gmail) ──────────────────────────────────────────
export function canModifyGmail(channel: { oauth_scope?: string | null }): boolean {
  return /gmail\.modify|mail\.google\.com/.test(channel.oauth_scope ?? '')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function gmailThreadAction(channel: any, gthread: string, action: 'read' | 'unread' | 'archive' | 'inbox' | 'star' | 'unstar' | 'trash' | 'untrash'): Promise<{ ok: boolean; error?: string; needs_reconnect?: boolean }> {
  if (!canModifyGmail(channel)) return { ok: false, needs_reconnect: true, error: 'Reconnect Gmail to keep Gmail in step.' }
  const { token, error } = await getGmailAccessToken(channel.oauth_refresh_token)
  if (!token) return { ok: false, error, needs_reconnect: isReconnectError(error) }
  const mod: Record<string, { add?: string[]; remove?: string[] }> = {
    read: { remove: ['UNREAD'] }, unread: { add: ['UNREAD'] },
    archive: { remove: ['INBOX'] }, inbox: { add: ['INBOX'] },
    star: { add: ['STARRED'] }, unstar: { remove: ['STARRED'] },
  }
  const url = action === 'trash' || action === 'untrash'
    ? `${GMAIL}/threads/${gthread}/${action}`
    : `${GMAIL}/threads/${gthread}/modify`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: action === 'trash' || action === 'untrash' ? undefined : JSON.stringify({ addLabelIds: mod[action].add ?? [], removeLabelIds: mod[action].remove ?? [] }),
  })
  if (!res.ok) { const t = await res.text(); return { ok: false, error: `Gmail ${res.status}: ${t.slice(0, 200)}`, needs_reconnect: res.status === 401 || res.status === 403 } }
  return { ok: true }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function gmailAttachment(channel: any, messageId: string, attachmentId: string): Promise<{ data?: Buffer; error?: string }> {
  const { token, error } = await getGmailAccessToken(channel.oauth_refresh_token)
  if (!token) return { error }
  const r = await gget<{ data?: string }>(token, `/messages/${messageId}/attachments/${attachmentId}`)
  if (!r.ok) return { error: r.error }
  return { data: Buffer.from(r.data.data ?? '', 'base64url') }
}

// An inline picture (cid:…) by its Content-ID. Gmail hands small pictures (signature
// icons, logos) over inside the message instead of as attachments, so they were never
// saved — fetch the message and find the part. Also matches Outlook's
// "image001.png@01DC…" style by file name.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function gmailInlineImage(channel: any, messageId: string, cid: string): Promise<{ data?: Buffer; mime?: string; error?: string }> {
  const { token, error } = await getGmailAccessToken(channel.oauth_refresh_token)
  if (!token) return { error }
  const m = await fetchFull(token, messageId)
  if (!m) return { error: 'Message not found in Gmail.' }
  const want = cid.replace(/[<>]/g, '').trim().toLowerCase()
  const wantFile = want.split('@')[0]
  let hit: GmailPart | null = null
  const walk = (p: GmailPart | undefined) => {
    if (!p || hit) return
    const id = headerValue(p.headers, 'Content-ID').replace(/[<>]/g, '').trim().toLowerCase()
    const xid = headerValue(p.headers, 'X-Attachment-Id').trim().toLowerCase()
    if ((id && id === want) || (xid && xid === want) || (!!p.filename && p.filename.toLowerCase() === wantFile && (p.mimeType ?? '').startsWith('image/'))) { hit = p; return }
    for (const c of p.parts ?? []) walk(c)
  }
  walk(m.payload as GmailPart | undefined)
  const part = hit as GmailPart | null
  if (!part) return { error: 'Picture not found.' }
  const mime = part.mimeType ?? 'image/png'
  if (part.body?.data) return { data: Buffer.from(part.body.data, 'base64url'), mime }
  if (part.body?.attachmentId) {
    const r = await gget<{ data?: string }>(token, `/messages/${messageId}/attachments/${part.body.attachmentId}`)
    if (!r.ok) return { error: r.error }
    return { data: Buffer.from(r.data.data ?? '', 'base64url'), mime }
  }
  return { error: 'Picture has no data.' }
}

// Backfill formatted HTML for messages stored before HTML capture existed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function backfillGmailHtml(supabase: any, channel: any, limit = 20): Promise<number> {
  if (channel.channel_type !== 'gmail' || !channel.oauth_refresh_token) return 0
  const { token } = await getGmailAccessToken(channel.oauth_refresh_token)
  if (!token) return 0
  const { data: rows } = await supabase
    .from('messages')
    .select('id, external_message_id')
    .eq('channel_id', channel.id)
    .is('body_html', null)
    .eq('attachments', '[]')
    .order('created_at', { ascending: false })
    .limit(limit)
  let filled = 0
  for (const r of rows ?? []) {
    if (!r.external_message_id) continue
    const m = await fetchFull(token, r.external_message_id)
    if (!m) continue
    const html = extractHtml(m.payload)
    const atts = extractAttachments(m.payload)
    const patch: Record<string, unknown> = { attachments: atts }
    if (html) patch.body_html = html
    const { error } = await supabase.from('messages').update(patch).eq('id', r.id)
    if (!error && html) filled++
  }
  return filled
}
