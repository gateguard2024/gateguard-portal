import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

type UiChannel = 'call' | 'text' | 'email'
export type Folder = 'inbox' | 'other' | 'unread' | 'needs_reply' | 'starred' | 'snoozed' | 'sent' | 'linked' | 'archived' | 'trash' | 'all'
const FOLDERS: Folder[] = ['inbox', 'other', 'unread', 'needs_reply', 'starred', 'snoozed', 'sent', 'linked', 'archived', 'trash', 'all']

const LINKED_OR = 'linked_type.not.is.null,linked_opportunity_id.not.is.null,linked_customer_org_id.not.is.null'
const LIST_COLS = 'id, channel_id, subject, participants, last_message_at, unread_count, created_at, linked_type, linked_id, linked_label, linked_opportunity_id, linked_customer_org_id, snippet, last_direction, last_from_name, last_from_address, message_count, labels, is_archived, is_starred, is_trashed, is_bulk, has_attachments, snoozed_until'
const OLD_COLS = 'id, channel_id, subject, participants, last_message_at, unread_count, created_at, linked_type, linked_id, linked_label'

// Keep a search term from breaking the PostgREST filter syntax.
const term = (q: string) => q.replace(/[,()*%\\:"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFolder(q: any, folder: Folder, nowIso: string) {
  const notSnoozed = `snoozed_until.is.null,snoozed_until.lte.${nowIso}`
  switch (folder) {
    case 'inbox':       return q.eq('is_archived', false).eq('is_trashed', false).or(notSnoozed).or(`is_bulk.eq.false,${LINKED_OR}`)
    case 'other':       return q.eq('is_archived', false).eq('is_trashed', false).or(notSnoozed).eq('is_bulk', true).is('linked_type', null).is('linked_opportunity_id', null).is('linked_customer_org_id', null)
    case 'unread':      return q.eq('is_trashed', false).eq('is_archived', false).gt('unread_count', 0)
    case 'needs_reply': return q.eq('is_trashed', false).eq('is_archived', false).eq('is_bulk', false).eq('last_direction', 'inbound').or(notSnoozed)
                          .gte('last_message_at', new Date(Date.now() - 30 * 86400_000).toISOString())
    case 'starred':     return q.eq('is_trashed', false).eq('is_starred', true)
    case 'snoozed':     return q.eq('is_trashed', false).gt('snoozed_until', nowIso)
    case 'sent':        return q.eq('is_trashed', false).or('labels.cs.{SENT},last_direction.eq.outbound')
    case 'linked':      return q.eq('is_trashed', false).or(LINKED_OR)
    case 'archived':    return q.eq('is_trashed', false).eq('is_archived', true)
    case 'trash':       return q.eq('is_trashed', true)
    default:            return q.eq('is_trashed', false)
  }
}

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
  const folder = (FOLDERS.includes(sp.get('folder') as Folder) ? sp.get('folder') : 'inbox') as Folder
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

  let needsMigration = false
  let { data: rows, error } = await build(LIST_COLS, true)
  if (error && /column|schema cache|does not exist/i.test(error.message)) {
    needsMigration = true
    const r = await build(OLD_COLS, false)
    rows = r.data
    error = r.error
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list = ((rows ?? []) as any[])
  const hasMore = list.length > limit
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
    const name = (!lastFromSelf && t.last_from_name) || other.name || (!lastFromSelf && t.last_from_address) || other.address || 'Unknown'
    const snoozedActive = !!t.snoozed_until && t.snoozed_until > nowIso
    return {
      id: t.id,
      channel: uiChannel(last?.source_type),
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
    const [inbox, other, needs, snoozed, unread] = await Promise.all([c('inbox', true), c('other', true), c('needs_reply'), c('snoozed'), c('unread')])
    counts = { inbox, other, needs_reply: needs, snoozed, unread }
  }

  return NextResponse.json({
    conversations,
    folder,
    has_more: hasMore,
    next_before: hasMore ? page[page.length - 1]?.last_message_at ?? null : null,
    counts,
    needs_migration: needsMigration || undefined,
  })
}
