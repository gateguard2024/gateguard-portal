// lib/ringcentral.ts
// RingCentral → Nexus Mail: your texts (SMS/MMS), call log and voicemails show up in the
// same inbox as email, one conversation per phone number, and you can text back from
// your RingCentral number.
//
// Auth: one RingCentral app for Gate Guard (env RINGCENTRAL_CLIENT_ID / _SECRET,
// "JWT auth flow"), and each person pastes their own JWT credential (made in the
// RingCentral Developer Console under their login). The JWT is stored encrypted
// (lib/crypto-creds) in message_channels.config.jwt_enc — channel_type 'phone',
// config.provider 'ringcentral'. Never sent to the browser.
//
// Sync (same minute cron as Gmail): message-sync (texts + voicemail, with read/unread
// changes) and call-log-sync, each continuing from its saved syncToken.

import type { SupabaseClient } from '@supabase/supabase-js'
import { decryptJson } from './crypto-creds'
import { recomputeThread, writeSafe } from './mail-fetch'

export const RC_SERVER = () => (process.env.RINGCENTRAL_SERVER || 'https://platform.ringcentral.com').replace(/\/$/, '')
export const rcConfigured = () => !!(process.env.RINGCENTRAL_CLIENT_ID && process.env.RINGCENTRAL_CLIENT_SECRET)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isRingCentral = (ch: any) => ch?.channel_type === 'phone' && ch?.config?.provider === 'ringcentral'

// ── phone numbers ─────────────────────────────────────────────────────────────
export function e164(raw: string): string | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const digits = s.replace(/[^\d]/g, '')
  if (s.startsWith('+') && digits.length >= 8 && digits.length <= 15) return `+${digits}`
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`
  return null
}
export function prettyPhone(n: string): string {
  const m = String(n).match(/^\+1(\d{3})(\d{3})(\d{4})$/)
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : n
}

// ── auth ──────────────────────────────────────────────────────────────────────
const tokenCache = new Map<string, { token: string; exp: number }>()

export async function rcToken(jwt: string): Promise<{ token?: string; error?: string }> {
  if (!rcConfigured()) return { error: 'RingCentral is not set up (RINGCENTRAL_CLIENT_ID / RINGCENTRAL_CLIENT_SECRET).' }
  const hit = tokenCache.get(jwt)
  if (hit && hit.exp > Date.now()) return { token: hit.token }
  try {
    const basic = Buffer.from(`${process.env.RINGCENTRAL_CLIENT_ID}:${process.env.RINGCENTRAL_CLIENT_SECRET}`).toString('base64')
    const res = await fetch(`${RC_SERVER()}/restapi/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${basic}` },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }).toString(),
    })
    const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string; message?: string }
    if (!res.ok || !data.access_token) return { error: `RingCentral login failed: ${data.error_description ?? data.message ?? res.status}` }
    tokenCache.set(jwt, { token: data.access_token, exp: Date.now() + Math.max(60, (data.expires_in ?? 3600) - 120) * 1000 })
    return { token: data.access_token }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'RingCentral unreachable' }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function channelJwt(ch: any): string | null {
  try { return ch?.config?.jwt_enc ? decryptJson<{ jwt: string }>(ch.config.jwt_enc).jwt : null } catch { return null }
}

export async function rcApi<T>(token: string, path: string, init?: { method?: string; body?: unknown }): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${RC_SERVER()}${path}`, {
      method: init?.method ?? 'GET',
      headers: { Authorization: `Bearer ${token}`, ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    })
    if (res.ok) return { ok: true, data: (res.status === 204 ? {} : await res.json()) as T }
    if (res.status === 429 && attempt === 0) { await new Promise((r) => setTimeout(r, 1500)); continue }
    const t = await res.text()
    let msg = t.slice(0, 300)
    try { const j = JSON.parse(t); msg = j.message ?? j.errors?.[0]?.message ?? msg } catch { /* text */ }
    return { ok: false, status: res.status, error: `RingCentral ${res.status}: ${msg}` }
  }
  return { ok: false, status: 429, error: 'RingCentral is busy — try again in a minute.' }
}

// Who you are + which of your numbers can send texts.
export async function rcWhoAmI(token: string): Promise<{ name: string; extension: string | null; email: string | null; numbers: { number: string; sms: boolean; label: string }[] } | { error: string }> {
  const [ext, nums] = await Promise.all([
    rcApi<{ name?: string; extensionNumber?: string; contact?: { email?: string } }>(token, '/restapi/v1.0/account/~/extension/~'),
    rcApi<{ records?: { phoneNumber: string; features?: string[]; usageType?: string; label?: string }[] }>(token, '/restapi/v1.0/account/~/extension/~/phone-number?perPage=100'),
  ])
  if (!ext.ok) return { error: ext.error }
  const numbers = nums.ok ? (nums.data.records ?? []).map((r) => ({
    number: r.phoneNumber, sms: (r.features ?? []).includes('SmsSender'),
    label: [r.label, r.usageType === 'MainCompanyNumber' ? 'company main' : r.usageType === 'DirectNumber' ? 'direct' : r.usageType].filter(Boolean).join(' · '),
  })) : []
  return { name: ext.data.name ?? 'RingCentral', extension: ext.data.extensionNumber ?? null, email: ext.data.contact?.email ?? null, numbers }
}

// ── storing ───────────────────────────────────────────────────────────────────
type Party = { phoneNumber?: string; extensionNumber?: string; name?: string }
type RcMessage = {
  id: number | string
  type: string                       // SMS | VoiceMail | Fax | Pager
  direction: 'Inbound' | 'Outbound'
  readStatus?: 'Read' | 'Unread'
  availability?: 'Alive' | 'Deleted' | 'Purged'
  messageStatus?: string
  subject?: string
  creationTime: string
  from?: Party
  to?: Party[]
  attachments?: { id: number | string; uri: string; type: string; contentType?: string; vmDuration?: number; fileName?: string }[]
  vmTranscriptionStatus?: string
}
type RcCall = {
  id: string
  startTime: string
  duration?: number
  direction: 'Inbound' | 'Outbound'
  result?: string                    // Missed | Accepted | Call connected | Voicemail | Busy | No Answer | …
  from?: Party
  to?: Party
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ctx = { supabase: SupabaseClient; channel: any; own: Set<string>; touched: Set<string>; threadCache: Map<string, string> }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ownNumbers(ch: any): Set<string> {
  return new Set<string>((ch.config?.numbers ?? []).map((n: { number: string }) => e164(n.number)).filter(Boolean) as string[])
}

async function threadFor(ctx: Ctx, number: string, name: string | null, at: string): Promise<string | null> {
  const key = `rc:${number}`
  const hit = ctx.threadCache.get(key)
  if (hit) return hit
  const look = async () => {
    const { data } = await ctx.supabase.from('message_threads').select('id, participants')
      .eq('channel_id', ctx.channel.id).eq('external_thread_id', key).order('created_at').limit(1).maybeSingle()
    return data as { id: string; participants: { name?: string; address?: string }[] } | null
  }
  const found = await look()
  if (found) {
    // Fill in a name once RingCentral knows it.
    const p = Array.isArray(found.participants) ? found.participants : []
    if (name && !p[0]?.name) await ctx.supabase.from('message_threads').update({ participants: [{ name, address: number }] }).eq('id', found.id)
    ctx.threadCache.set(key, found.id)
    return found.id
  }
  const label = name || prettyPhone(number)
  const { data, error } = await writeSafe((row) => ctx.supabase.from('message_threads').insert(row).select('id').single(), {
    user_id: ctx.channel.user_id, org_id: ctx.channel.org_id, channel_id: ctx.channel.id,
    external_thread_id: key, subject: `Texts & calls · ${label}`,
    participants: [{ name: name ?? '', address: number }], last_message_at: at,
  })
  if (error) {
    if (error.code === '23505') { const again = await look(); if (again) { ctx.threadCache.set(key, again.id); return again.id } }
    console.error('ringcentral: thread insert failed', error.message)
    return null
  }
  ctx.threadCache.set(key, data.id)
  return data.id
}

const fmtDur = (s?: number) => (!s ? '' : s < 60 ? `${s} sec` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`)

async function storeMessage(ctx: Ctx, m: RcMessage): Promise<'new' | 'updated' | 'skip'> {
  if (m.type !== 'SMS' && m.type !== 'VoiceMail' && m.type !== 'Pager') return 'skip'
  const extId = `rc:msg:${m.id}`
  const { data: existing } = await ctx.supabase.from('messages').select('id, thread_id, read_at, direction')
    .eq('channel_id', ctx.channel.id).eq('external_message_id', extId).maybeSingle()
  if (m.availability && m.availability !== 'Alive') {
    if (existing) { await ctx.supabase.from('messages').delete().eq('id', existing.id); ctx.touched.add(existing.thread_id); return 'updated' }
    return 'skip'
  }
  const inbound = m.direction === 'Inbound'
  const unread = inbound && m.readStatus === 'Unread'
  if (existing) {
    // Read / unread changed (in the RingCentral app or here).
    if (inbound && !!existing.read_at === unread) {
      const { error } = await writeSafe((row) => ctx.supabase.from('messages').update(row).eq('id', existing.id),
        { read_at: unread ? null : new Date().toISOString(), labels: unread ? ['INBOX', 'UNREAD'] : ['INBOX'] })
      if (!error) { ctx.touched.add(existing.thread_id); return 'updated' }
    }
    return 'skip'
  }
  const other = inbound ? m.from : (m.to ?? [])[0]
  const number = e164(other?.phoneNumber ?? '') ?? (other?.extensionNumber ? `ext ${other.extensionNumber}` : null)
  if (!number) return 'skip'
  const threadId = await threadFor(ctx, number, other?.name ?? null, m.creationTime)
  if (!threadId) return 'skip'
  const vm = m.type === 'VoiceMail'
  const audio = (m.attachments ?? []).find((a) => a.type === 'AudioRecording')
  const files = (m.attachments ?? []).filter((a) => a.type === 'MmsAttachment' || a.type === 'AudioRecording')
    .map((a) => ({ name: a.fileName || (a.type === 'AudioRecording' ? 'Voicemail.mp3' : `picture.${(a.contentType ?? 'image/jpeg').split('/')[1]}`), mime_type: a.contentType ?? 'application/octet-stream', size: 0, attachment_id: `rc:${m.id}:${a.id}`, rc_uri: a.uri }))
  const body = vm ? `Voicemail${audio?.vmDuration ? ` · ${fmtDur(audio.vmDuration)}` : ''}${m.subject && !/^voice ?message/i.test(m.subject) ? `\n${m.subject}` : ''}` : (m.subject ?? '')
  const me = inbound ? (m.to ?? [])[0] : m.from
  const { error } = await writeSafe((row) => ctx.supabase.from('messages').insert(row), {
    thread_id: threadId, channel_id: ctx.channel.id, external_message_id: extId,
    direction: inbound ? 'inbound' : 'outbound',
    source_type: vm ? 'phone' : 'sms',
    from_address: inbound ? number : (e164(me?.phoneNumber ?? '') ?? 'me'),
    from_name: inbound ? (other?.name ?? null) : null,
    to_addresses: [{ name: inbound ? '' : (other?.name ?? ''), address: inbound ? (e164(me?.phoneNumber ?? '') ?? '') : number }],
    subject: vm ? 'Voicemail' : null,
    body, snippet: body.replace(/\s+/g, ' ').slice(0, 240) || null,
    attachments: files,
    labels: unread ? ['INBOX', 'UNREAD'] : inbound ? ['INBOX'] : ['INBOX', 'SENT'],
    status: m.messageStatus === 'SendingFailed' || m.messageStatus === 'DeliveryFailed' ? 'failed' : inbound ? 'delivered' : 'sent',
    sent_at: inbound ? null : m.creationTime,
    read_at: unread ? null : m.creationTime,
    created_at: m.creationTime,
  })
  if (error) {
    if (error.code !== '23505') console.error('ringcentral: message insert failed', error.message)
    return 'skip'
  }
  ctx.touched.add(threadId)
  return 'new'
}

async function storeCall(ctx: Ctx, c: RcCall): Promise<boolean> {
  const inbound = c.direction === 'Inbound'
  const other = inbound ? c.from : c.to
  const number = e164(other?.phoneNumber ?? '')
  if (!number || ctx.own.has(number)) return false
  if (inbound && c.result === 'Voicemail') return false // the voicemail itself comes through message-sync
  const threadId = await threadFor(ctx, number, other?.name ?? null, c.startTime)
  if (!threadId) return false
  const missed = inbound && /missed|no answer|hang ?up|busy|rejected/i.test(c.result ?? '')
  const body = inbound ? (missed ? 'Missed call' : `Incoming call${c.duration ? ` · ${fmtDur(c.duration)}` : ''}`) : `Outgoing call${c.duration ? ` · ${fmtDur(c.duration)}` : c.result && !/connected|accepted/i.test(c.result) ? ` · ${c.result}` : ''}`
  const { error } = await writeSafe((row) => ctx.supabase.from('messages').insert(row), {
    thread_id: threadId, channel_id: ctx.channel.id, external_message_id: `rc:call:${c.id}`,
    direction: inbound ? 'inbound' : 'outbound', source_type: 'phone',
    from_address: inbound ? number : 'me', from_name: inbound ? (other?.name ?? null) : null,
    to_addresses: [{ name: '', address: inbound ? 'me' : number }],
    subject: missed ? 'Missed call' : 'Call', body, snippet: body,
    labels: missed ? ['INBOX', 'UNREAD'] : ['INBOX'],
    status: 'delivered', read_at: missed ? null : c.startTime, created_at: c.startTime,
  })
  if (error) {
    if (error.code === '22P02') console.error('ringcentral: run migration 223 to store calls')
    else if (error.code !== '23505') console.error('ringcentral: call insert failed', error.message)
    return false
  }
  ctx.touched.add(threadId)
  return true
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function saveConfig(supabase: SupabaseClient, ch: any, patch: Record<string, unknown>, cols: Record<string, unknown> = {}) {
  const config = { ...(ch.config ?? {}), ...patch }
  ch.config = config
  const { error } = await writeSafe((row) => supabase.from('message_channels').update(row).eq('id', ch.id), { config, ...cols })
  if (error) console.error('ringcentral: channel update failed', error.message)
}

// ── the sync ──────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function syncRingCentral(supabase: SupabaseClient, channel: any): Promise<{ fetched: number; updated: number; error?: string; needs_reconnect?: boolean }> {
  const jwt = channelJwt(channel)
  if (!jwt) return { fetched: 0, updated: 0, error: 'RingCentral not connected', needs_reconnect: true }
  const { token, error } = await rcToken(jwt)
  if (!token) {
    const needs = /invalid|expired|revoked|unauthor/i.test(error ?? '')
    await writeSafe((row) => supabase.from('message_channels').update(row).eq('id', channel.id), { last_error: needs ? 'RingCentral ended the login — paste a new JWT in Mail settings.' : error, last_error_at: new Date().toISOString() })
    return { fetched: 0, updated: 0, error, needs_reconnect: needs }
  }
  const ctx: Ctx = { supabase, channel, own: ownNumbers(channel), touched: new Set(), threadCache: new Map() }
  let fetched = 0, updated = 0
  const since = new Date(Date.now() - 30 * 86400_000).toISOString()
  try {
    // Texts + voicemail (with read/unread changes).
    const ms = channel.config?.rc_msg_sync as string | undefined
    let r = await rcApi<{ records?: RcMessage[]; syncInfo?: { syncToken?: string } }>(token,
      ms ? `/restapi/v1.0/account/~/extension/~/message-sync?syncType=ISync&syncToken=${encodeURIComponent(ms)}`
        : `/restapi/v1.0/account/~/extension/~/message-sync?syncType=FSync&dateFrom=${encodeURIComponent(since)}&recordCount=250`)
    if (!r.ok && ms && (r.status === 400 || r.status === 404)) {
      r = await rcApi(token, `/restapi/v1.0/account/~/extension/~/message-sync?syncType=FSync&dateFrom=${encodeURIComponent(since)}&recordCount=250`)
    }
    if (!r.ok) throw new Error(r.error)
    const msgs = [...(r.data.records ?? [])].sort((a, b) => (a.creationTime < b.creationTime ? -1 : 1))
    for (const m of msgs) { const s = await storeMessage(ctx, m); if (s === 'new') fetched++; else if (s === 'updated') updated++ }
    const msgToken = r.data.syncInfo?.syncToken ?? ms

    // Calls.
    const cs = channel.config?.rc_call_sync as string | undefined
    let c = await rcApi<{ records?: RcCall[]; syncInfo?: { syncToken?: string } }>(token,
      cs ? `/restapi/v1.0/account/~/extension/~/call-log-sync?syncType=ISync&syncToken=${encodeURIComponent(cs)}`
        : `/restapi/v1.0/account/~/extension/~/call-log-sync?syncType=FSync&dateFrom=${encodeURIComponent(since)}&recordCount=250`)
    if (!c.ok && cs && (c.status === 400 || c.status === 404)) {
      c = await rcApi(token, `/restapi/v1.0/account/~/extension/~/call-log-sync?syncType=FSync&dateFrom=${encodeURIComponent(since)}&recordCount=250`)
    }
    let callToken = cs
    if (c.ok) {
      for (const call of [...(c.data.records ?? [])].sort((a, b) => (a.startTime < b.startTime ? -1 : 1))) if (await storeCall(ctx, call)) fetched++
      callToken = c.data.syncInfo?.syncToken ?? cs
    } else console.error('ringcentral: call log', c.error)

    for (const tid of ctx.touched) await recomputeThread(supabase, tid)
    // Text threads are named after the person, not "Re: …".
    for (const tid of ctx.touched) {
      const { data: t } = await supabase.from('message_threads').select('participants').eq('id', tid).maybeSingle()
      const p = (t?.participants as { name?: string; address?: string }[] | undefined)?.[0]
      if (p?.address) await supabase.from('message_threads').update({ subject: `Texts & calls · ${p.name || prettyPhone(p.address)}` }).eq('id', tid)
    }
    await saveConfig(supabase, channel, { rc_msg_sync: msgToken, rc_call_sync: callToken }, { last_synced_at: new Date().toISOString(), last_error: null, last_error_at: null })
    return { fetched, updated }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'RingCentral sync failed'
    for (const tid of ctx.touched) await recomputeThread(supabase, tid)
    await writeSafe((row) => supabase.from('message_channels').update(row).eq('id', channel.id), { last_error: msg.slice(0, 400), last_error_at: new Date().toISOString() })
    return { fetched, updated, error: msg, needs_reconnect: /401|unauthor|invalid_grant/i.test(msg) }
  }
}

// ── actions ───────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function rcSendText(channel: any, to: string, text: string, from?: string): Promise<{ ok: boolean; id?: string; error?: string; created?: string; from?: string }> {
  const jwt = channelJwt(channel)
  if (!jwt) return { ok: false, error: 'RingCentral not connected' }
  const { token, error } = await rcToken(jwt)
  if (!token) return { ok: false, error }
  const sender = e164(from ?? channel.config?.sms_from ?? '')
  if (!sender) return { ok: false, error: 'Pick which RingCentral number to text from (Mail settings).' }
  const toNum = e164(to)
  if (!toNum) return { ok: false, error: 'That phone number doesn’t look right.' }
  const r = await rcApi<{ id?: number; creationTime?: string; messageStatus?: string }>(token, '/restapi/v1.0/account/~/extension/~/sms', {
    method: 'POST', body: { from: { phoneNumber: sender }, to: [{ phoneNumber: toNum }], text: text.slice(0, 1000) },
  })
  if (!r.ok) return { ok: false, error: r.error }
  return { ok: true, id: String(r.data.id), created: r.data.creationTime, from: sender }
}

// Mark texts / voicemails read (or unread) in RingCentral too.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function rcSetRead(channel: any, rcMessageIds: string[], read: boolean): Promise<{ ok: boolean; error?: string }> {
  const jwt = channelJwt(channel)
  if (!jwt || !rcMessageIds.length) return { ok: !rcMessageIds.length }
  const { token, error } = await rcToken(jwt)
  if (!token) return { ok: false, error }
  let firstErr: string | undefined
  for (const id of rcMessageIds.slice(0, 50)) {
    const r = await rcApi(token, `/restapi/v1.0/account/~/extension/~/message-store/${encodeURIComponent(id)}`, { method: 'PUT', body: { readStatus: read ? 'Read' : 'Unread' } })
    if (!r.ok && !firstErr) firstErr = r.error
  }
  return { ok: !firstErr, error: firstErr }
}

// Voicemail audio / MMS picture — needs the RingCentral login, so it streams through us.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function rcFile(channel: any, uri: string): Promise<{ data?: Buffer; type?: string; error?: string }> {
  if (!uri.startsWith(RC_SERVER() + '/') && !/^https:\/\/[a-z0-9.-]+\.ringcentral\.com\//i.test(uri)) return { error: 'Bad file link' }
  const jwt = channelJwt(channel)
  if (!jwt) return { error: 'RingCentral not connected' }
  const { token, error } = await rcToken(jwt)
  if (!token) return { error }
  const res = await fetch(uri, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return { error: `RingCentral ${res.status}` }
  return { data: Buffer.from(await res.arrayBuffer()), type: res.headers.get('content-type') ?? 'application/octet-stream' }
}
