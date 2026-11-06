import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { prettyPhone } from '@/lib/ringcentral'
import { FOLDERS, LIST_COLS, OLD_COLS, applyFolder, term, type Folder } from '@/lib/mail-folders'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

type UiChannel = 'call' | 'text' | 'email'
function uiChannel(sourceType: string | null | undefined): UiChannel {
  if (sourceType === 'sms' || sourceType === 'twilio') return 'text'
  if (sourceType === 'phone') return 'call'
  return 'email'
}

// GET /api/nexus/messages/threads?folder=inbox&q=&before=<iso>&limit=50&ids=a,b
// The signed-in user's conversations for one folder — newest first, list fields only
// (the full emails load when one is opened: /threads/[id]). Also returns folder counts.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  const sp = new URL(req.url).searchParams
  const folder = (FOLDERS.includes(sp.get('folder') as Folder) ? sp.get('folder') : 'all_inbox') as Folder
  const q = term(sp.get('q') ?? '')
  const before = sp.get('before')
  const limit = Math.min(100, Math.max(5, Number(sp.get('limit')) || 50))
  const ids = (sp.get('ids') ?? '').split(',').map((s) => s.trim()).filter((s) => /^[0-9a-f-]{36}$/i.test(s)).slice(0, 100)
  const nowIso = new Date().toISOString()

  // The user's own addresses, so "who is this with" never shows yourself.
  const { data: chans } = await supabase.from('message_channels').select('id, display_name, config').eq('user_id', user.id)
  const self = new Set<string>([user.email?.toLowerCase() ?? ''])
  for (const c of chans ?? []) {
    const a = String((c.config as { from_address?: string } | null)?.from_address ?? c.display_name ?? '').toLowerCase()
    if (a) self.add(a)
  }

  // Snoozed mail whose time has come back → top of the inbox as unread (like Gmail).
  const { data: woke } = await supabase.from('message_threads').select('id, snoozed_until, unread_count')
    .eq('user_id', user.id).lte('snoozed_until', nowIso).limit(25)
  for (const w of woke ?? []) {
    const { error: wErr } = await supabase.from('message_threads')
      .update({ snoozed_until: null, last_message_at: w.snoozed_until, unread_count: Math.max(1, w.unread_count ?? 0), is_archived: false })
      .eq('id', w.id)
    if (wErr) console.error('mail: snooze wake failed', wErr.message)
  }

  const build = (cols: string, withFolder: boolean) => {
    let qq = supabase.from('message_threads').select(cols).eq('user_id', user.id)
    if (ids.length) qq = qq.in('id', ids)
    else if (withFolder) qq = applyFolder(qq, folder, nowIso)
    if (q) qq = withFolder
      ? qq.or(`subject.ilike.*${q}*,snippet.ilike.*${q}*,last_from_name.ilike.*${q}*,last_from_address.ilike.*${q}*,linked_label.ilike.*${q}*`)
      : qq.or(`subject.ilike.*${q}*,linked_label.ilike.*${q}*`)
    if (before) qq = qq.lt('last_message_at', before)
    return qq.order('last_message_at', { ascending: false, nullsFirst: false }).limit(limit + 1)
  }

  // Sent = the emails / texts YOU sent, newest first, each row showing what you sent and
  // to whom — not the conversation's latest reply (that's what put "Waiting on you"
  // rows in Sent before).
  const sentInfo = new Map<string, { at: string; snippet: string; toName: string | null; toAddr: string | null }>()
  let sentMore = false
  if (folder === 'sent' && !ids.length && !q) {
    const chanIds = (chans ?? []).map((c) => c.id)
    if (chanIds.length) {
      let mq = supabase.from('messages').select('thread_id, created_at, snippet, body, to_addresses')
        .in('channel_id', chanIds).eq('direction', 'outbound').neq('status', 'failed')
      if (before) mq = mq.lt('created_at', before)
      const { data: sent } = await mq.order('created_at', { ascending: false }).limit(limit * 6)
      for (const m of sent ?? []) {
        if (sentInfo.has(m.thread_id)) continue
        if (sentInfo.size === limit) { sentMore = true; break }
        const to = (Array.isArray(m.to_addresses) ? m.to_addresses : [])[0] as { name?: string; address?: string } | undefined
        sentInfo.set(m.thread_id, { at: m.created_at, snippet: String(m.snippet || m.body || '').replace(/\s+/g, ' ').trim().slice(0, 200), toName: to?.name || null, toAddr: to?.address || null })
      }
      if (!sentMore && (sent ?? []).length === limit * 6) sentMore = true
    }
  }

  let needsMigration = false
  let { data: rows, error } = sentInfo.size
    ? await supabase.from('message_threads').select(LIST_COLS).eq('user_id', user.id).in('id', [...sentInfo.keys()]).limit(limit + 1)
    : folder === 'sent' && !ids.length && !q ? { data: [], error: null } : await build(LIST_COLS, true)
  if (error && /column|schema cache|does not exist/i.test(error.message)) {
    needsMigration = true
    const r = await build(OLD_COLS, false)
    rows = r.data
    error = r.error
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let list = ((rows ?? []) as any[])
  if (sentInfo.size) list = list.filter((t) => !t.is_trashed).sort((a, b) => (sentInfo.get(a.id)!.at < sentInfo.get(b.id)!.at ? 1 : -1))
  const hasMore = sentInfo.size ? sentMore : list.length > limit
  const page = list.slice(0, limit)

  // Before migration 222 the list fields aren't on the thread yet — take them from the
  // newest message of each conversation (one small query, newest first).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastByThread = new Map<string, any>()
  if (needsMigration && page.length) {
    const { data: msgs } = await supabase.from('messages').select('thread_id, direction, source_type, body, subject, from_name, from_address, created_at')
      .in('thread_id', page.map((t) => t.id)).order('created_at', { ascending: false }).limit(page.length * 6)
    for (const m of msgs ?? []) if (!lastByThread.has(m.thread_id)) lastByThread.set(m.thread_id, m)
  }

  const conversations = page.map((t) => {
    const parts = (Array.isArray(t.participants) ? t.participants : []) as { name?: string; address?: string }[]
    const other = parts.find((p) => p?.address && !self.has(String(p.address).toLowerCase())) ?? parts[0] ?? {}
    const last = lastByThread.get(t.id)
    const lastDir = t.last_direction ?? last?.direction ?? null
    const lastFromSelf = lastDir === 'outbound'
    const nameRaw = (!lastFromSelf && t.last_from_name) || other.name || (!lastFromSelf && t.last_from_address) || other.address || 'Unknown'
    const name = /^\+\d{8,15}$/.test(nameRaw) ? prettyPhone(nameRaw) : nameRaw
    const snoozedActive = !!t.snoozed_until && t.snoozed_until > nowIso
    const sent = sentInfo.get(t.id)
    if (sent) {
      const known = parts.find((p) => p.address && sent.toAddr && p.address.toLowerCase() === sent.toAddr.toLowerCase())?.name
      const raw = sent.toName || known || sent.toAddr || name
      const toName = /^\+\d{8,15}$/.test(raw) ? prettyPhone(raw) : raw
      return {
        id: t.id, channel: String(t.external_thread_id ?? '').startsWith('rc:') ? 'text' : 'email',
        contact_name: toName, contact_address: other.address || null, participants: parts,
        subject: t.subject || '(no subject)', preview: sent.snippet, last_at: sent.at, last_from_me: true,
        unread: false, unread_count: 0, needs_reply: false, starred: !!t.is_starred, archived: !!t.is_archived,
        trashed: false, bulk: false, has_attachments: !!t.has_attachments, message_count: t.message_count ?? null,
        snoozed_until: null, channel_id: t.channel_id ?? null,
        linked_type: t.linked_type ?? (t.linked_opportunity_id ? 'opportunity' : t.linked_customer_org_id ? 'customer' : null),
        linked_id: t.linked_id ?? t.linked_opportunity_id ?? t.linked_customer_org_id ?? null, linked_label: t.linked_label ?? null,
      }
    }
    return {
      id: t.id,
      channel: String(t.external_thread_id ?? '').startsWith('rc:') ? 'text' : uiChannel(last?.source_type),
      contact_name: name,
      contact_address: other.address || t.last_from_address || null,
      participants: parts,
      subject: t.subject || last?.subject || '(no subject)',
      preview: String(t.snippet ?? last?.body ?? '').replace(/\s+/g, ' ').trim().slice(0, 200),
      last_at: t.last_message_at ?? t.created_at,
      last_from_me: lastFromSelf,
      unread: (t.unread_count ?? 0) > 0,
      unread_count: t.unread_count ?? 0,
      needs_reply: lastDir === 'inbound' && !t.is_bulk,
      starred: !!t.is_starred,
      archived: !!t.is_archived,
      trashed: !!t.is_trashed,
      bulk: !!t.is_bulk,
      has_attachments: !!t.has_attachments,
      message_count: t.message_count ?? null,
      snoozed_until: snoozedActive ? t.snoozed_until : null,
      channel_id: t.channel_id ?? null,
      linked_type: t.linked_type ?? (t.linked_opportunity_id ? 'opportunity' : t.linked_customer_org_id ? 'customer' : null),
      linked_id: t.linked_id ?? t.linked_opportunity_id ?? t.linked_customer_org_id ?? null,
      linked_label: t.linked_label ?? null,
    }
  })

  // Folder counts (unread in Priority / Other, waiting on you, snoozed).
  let counts: Record<string, number> | null = null
  if (!needsMigration && !ids.length && !before) {
    const c = async (f: Folder, unreadOnly = false) => {
      let qq = supabase.from('message_threads').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
      qq = applyFolder(qq, f, nowIso)
      if (unreadOnly) qq = qq.gt('unread_count', 0)
      const { count } = await qq
      return count ?? 0
    }
    const [all, inbox, other, needs, awaiting, snoozed, unread] = await Promise.all([c('all_inbox', true), c('inbox', true), c('other', true), c('needs_reply'), c('awaiting'), c('snoozed'), c('unread')])
    counts = { all_inbox: all, inbox, other, needs_reply: needs, awaiting, snoozed, unread }
  }

  return NextResponse.json({
    conversations,
    folder,
    has_more: hasMore,
    next_before: hasMore ? (sentInfo.size ? conversations[conversations.length - 1]?.last_at : page[page.length - 1]?.last_message_at) ?? null : null,
    counts,
    needs_migration: needsMigration || undefined,
  })
}
