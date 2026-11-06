'use client'
/**
 * Nexus Mail — the email screen.
 * Live two-way Gmail (new mail within about a minute; read / archive / star / trash /
 * delete both ways), Priority vs Other inbox, Waiting on you, snooze, undo send,
 * Lexi summary + replies in your voice, and the customer's deals / properties / open
 * jobs / unpaid invoices next to every email.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search, Settings, RefreshCw, X, Loader2, ChevronDown, Check } from 'lucide-react'
import MailReader, { type ThreadAction } from './MailReader'
import MailComposer, { type ComposerSeed, type OutgoingEmail } from './MailComposer'
import MailContext from './MailContext'
import MailSettings from './MailSettings'
import { NewTextModal } from './MailText'
import { FOLDERS, FOLDER_COLOR, N, M, RECORD_BADGE, ago, api, initials, listTime, tintFor, type Account, type Counts, type Folder, type ThreadRow } from './mailShared'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Archive, Inbox, Paperclip, PenSquare, MailOpen, Mail: MailI, Sparkles, AlarmClock, Send, Trash2, Link2, Clock: ClockI, Hourglass, Sparkle: Star2, Phone: PhoneI, ArrowLeft, PanelRight, Flag, CheckCheck } = require('lucide-react') as any

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FOLDER_ICON: Record<Folder, any> = {
  all_inbox: Inbox, inbox: Star2, other: Archive, needs_reply: ClockI, awaiting: Hourglass, unread: MailOpen, starred: Flag, snoozed: AlarmClock,
  phone: PhoneI, sent: Send, linked: Link2, archived: Archive, trash: Trash2, all: Inbox,
}
// Folders a conversation leaves when you do this to it.
const LEAVES: Partial<Record<ThreadAction, Folder[]>> = {
  archive: ['all_inbox', 'inbox', 'other', 'needs_reply', 'unread'], trash: ['all_inbox', 'inbox', 'other', 'needs_reply', 'unread', 'starred', 'sent', 'linked', 'archived', 'snoozed'],
  untrash: ['trash'], inbox: ['archived', 'trash'], snooze: ['all_inbox', 'inbox', 'other', 'needs_reply', 'unread'], unsnooze: ['snoozed'],
  read: ['unread'], unstar: ['starred'],
}
const PREF = 'gg_mail_prefs'
const readPrefs = (): { context?: boolean } => { try { return JSON.parse(localStorage.getItem(PREF) ?? '{}') } catch { return {} } }
const savePrefs = (p: { context?: boolean }) => { try { localStorage.setItem(PREF, JSON.stringify(p)) } catch { /* ignore */ } }

type Outbox = { email: OutgoingEmail; seed: ComposerSeed; timer: ReturnType<typeof setTimeout>; until: number } | null

export default function MailApp({ onClose, closeLabel = 'Done', initialFolder = 'all_inbox', initialThreadId = null }: { onClose?: () => void; closeLabel?: string; initialFolder?: Folder; initialThreadId?: string | null }) {
  const [folder, setFolder] = useState<Folder>(initialFolder)
  const [q, setQ] = useState('')
  const [qLive, setQLive] = useState('')
  const [gmailIds, setGmailIds] = useState<string[] | null>(null)   // "search all of Gmail" results
  const [rows, setRows] = useState<ThreadRow[]>([])
  const [counts, setCounts] = useState<Counts | null>(null)
  const [nextBefore, setNextBefore] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [selId, setSelId] = useState<string | null>(initialThreadId)
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [gmailSearching, setGmailSearching] = useState(false)
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null)
  const [outbox, setOutbox] = useState<Outbox>(null)
  const [compose, setCompose] = useState<ComposerSeed | null>(null)
  const [composeFor, setComposeFor] = useState<{ mode: 'reply' | 'replyAll' | 'forward'; restore?: ComposerSeed } | null>(null)
  const [readerKey, setReaderKey] = useState(0)
  const [showContext, setShowContext] = useState(true)
  const [settings, setSettings] = useState(false)
  const [reconnectHint, setReconnectHint] = useState(false)
  const [folderMenu, setFolderMenu] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [pickMode, setPickMode] = useState(false)
  const [newText, setNewText] = useState(false)
  const lastPick = useRef<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const reqId = useRef(0)

  useEffect(() => { setShowContext(readPrefs().context !== false) }, [])
  useEffect(() => { const t = setTimeout(() => setQ(qLive.trim()), 250); return () => clearTimeout(t) }, [qLive])
  useEffect(() => { setGmailIds(null) }, [q])
  useEffect(() => { setPicked(new Set()); setPickMode(false) }, [folder, q, gmailIds])

  const flash = useCallback((text: string, undo?: () => void) => {
    setToast({ text, undo })
    window.setTimeout(() => setToast((t) => (t?.text === text ? null : t)), undo ? 6500 : 3200)
  }, [])

  // ── loading ───────────────────────────────────────────────────────────────
  const load = useCallback(async (opts: { silent?: boolean; more?: boolean } = {}) => {
    const id = ++reqId.current
    if (!opts.silent && !opts.more) setLoading(true)
    if (opts.more) setLoadingMore(true)
    const p = new URLSearchParams({ folder, limit: '50' })
    if (q) p.set('q', q)
    if (gmailIds) p.set('ids', gmailIds.join(','))
    if (opts.more && nextBefore) p.set('before', nextBefore)
    const r = await api<{ conversations: ThreadRow[]; counts: Counts | null; next_before: string | null; needs_migration?: boolean }>(`/api/nexus/messages/threads?${p}`)
    if (id !== reqId.current) return
    setLoading(false); setLoadingMore(false)
    if (!r.ok) { if (!opts.silent) flash(r.data.error ?? 'Could not load mail.'); return }
    setNeedsMigration(!!r.data.needs_migration)
    if (r.data.counts) setCounts(r.data.counts)
    setNextBefore(r.data.next_before)
    setRows((prev) => (opts.more ? [...prev, ...r.data.conversations.filter((c) => !prev.some((x) => x.id === c.id))] : r.data.conversations))
  }, [folder, q, gmailIds, nextBefore, flash])

  const loadRef = useRef(load)
  loadRef.current = load
  useEffect(() => { setNextBefore(null); void loadRef.current() }, [folder, q, gmailIds])

  // ── live sync ─────────────────────────────────────────────────────────────
  const sync = useCallback(async (manual = false) => {
    if (manual) setSyncing(true)
    const r = await api<{ fetched?: number; updated?: number; accounts?: Account[]; needs_reconnect?: boolean; error?: string }>('/api/nexus/messages/sync', { method: 'POST', json: manual ? { force: true } : {} })
    if (manual) setSyncing(false)
    if (r.data.accounts) setAccounts(r.data.accounts)
    if (manual && r.data.error && !r.data.needs_reconnect) flash(`Gmail: ${r.data.error.slice(0, 120)}`)
    if ((r.data.fetched ?? 0) > 0 || (r.data.updated ?? 0) > 0 || manual) void loadRef.current({ silent: true })
  }, [flash])

  useEffect(() => {
    void api<{ accounts?: Account[] }>('/api/nexus/messages/sync').then((r) => setAccounts(r.data.accounts ?? []))
    void sync()
    // New mail shows up on its own: pull Gmail every 45 s, refresh the list every 15 s
    // (the server also syncs every minute even when nobody has Nexus open).
    const s = window.setInterval(() => { if (document.visibilityState === 'visible') void sync() }, 45_000)
    const l = window.setInterval(() => { if (document.visibilityState === 'visible') void loadRef.current({ silent: true }) }, 15_000)
    const onFocus = () => { void sync() }
    window.addEventListener('focus', onFocus)
    return () => { window.clearInterval(s); window.clearInterval(l); window.removeEventListener('focus', onFocus) }
  }, [sync])

  const account = accounts?.find((a) => a.provider !== 'ringcentral') ?? null
  const rcAccount = accounts?.find((a) => a.provider === 'ringcentral') ?? null
  const folders = FOLDERS.filter((f) => f.id !== 'phone' || rcAccount)
  const selfEmail = (account?.email ?? '').toLowerCase()
  const selected = rows.find((r) => r.id === selId) ?? null

  // ── actions ───────────────────────────────────────────────────────────────
  const patchRow = (id: string, patch: Partial<ThreadRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const act = useCallback(async (row: ThreadRow, action: ThreadAction, extra?: { until?: string }, quiet = false) => {
    const leaves = LEAVES[action]?.includes(folder) && !gmailIds
    const idx = rows.findIndex((r) => r.id === row.id)
    const before = rows
    // Optimistic.
    const patch: Partial<ThreadRow> =
      action === 'read' ? { unread: false, unread_count: 0 } : action === 'unread' ? { unread: true, unread_count: Math.max(1, row.unread_count) }
      : action === 'star' ? { starred: true } : action === 'unstar' ? { starred: false }
      : action === 'archive' ? { archived: true } : action === 'inbox' ? { archived: false, trashed: false }
      : action === 'trash' ? { trashed: true } : action === 'untrash' ? { trashed: false }
      : action === 'snooze' ? { snoozed_until: extra?.until ?? null } : { snoozed_until: null }
    if (leaves) {
      const next = rows.filter((r) => r.id !== row.id)
      setRows(next)
      if (selId === row.id) setSelId(next[Math.min(idx, next.length - 1)]?.id ?? null)
    } else patchRow(row.id, patch)
    if (action === 'read' || action === 'unread') setCounts((c) => c && { ...c, unread: Math.max(0, c.unread + (action === 'read' ? (row.unread ? -1 : 0) : 1)) })

    const r = await api<{ ok?: boolean; gmail?: { ok: boolean; needs_reconnect?: boolean } }>(`/api/nexus/messages/threads/${row.id}`, { method: 'PATCH', json: { action, until: extra?.until } })
    if (!r.ok) { setRows(before); flash(r.data.error ?? 'That didn’t work. Try again.'); return }
    if (r.data.gmail?.needs_reconnect) setReconnectHint(true)
    if (quiet) return
    const undoOf: Partial<Record<ThreadAction, ThreadAction>> = { archive: 'inbox', trash: 'untrash', snooze: 'unsnooze' }
    const label: Partial<Record<ThreadAction, string>> = { archive: 'Archived', trash: 'Moved to Trash', snooze: 'Snoozed', inbox: 'Moved to Inbox', untrash: 'Restored' }
    if (label[action]) {
      const u = undoOf[action]
      flash(label[action]!, u ? () => { setRows(before); setSelId(row.id); void api(`/api/nexus/messages/threads/${row.id}`, { method: 'PATCH', json: { action: u } }) } : undefined)
    }
    void loadRef.current({ silent: true })
  }, [folder, gmailIds, rows, selId, flash])

  // Opened from My Day on one email → mark it read once it's loaded.
  const firstOpen = useRef(initialThreadId)
  useEffect(() => {
    if (!firstOpen.current) return
    const r = rows.find((x) => x.id === firstOpen.current)
    if (r) { firstOpen.current = null; if (r.unread) void act(r, 'read', undefined, true) }
  }, [rows, act])

  const open = useCallback((row: ThreadRow) => {
    setSelId(row.id)
    if (row.unread) void act(row, 'read', undefined, true)
  }, [act])

  // ── select many ───────────────────────────────────────────────────────────
  const togglePick = useCallback((id: string, shift: boolean) => {
    setPicked((cur) => {
      const n = new Set(cur)
      if (shift && lastPick.current) {
        const a = rows.findIndex((r) => r.id === lastPick.current), b = rows.findIndex((r) => r.id === id)
        if (a >= 0 && b >= 0) { for (let i = Math.min(a, b); i <= Math.max(a, b); i++) n.add(rows[i].id); return n }
      }
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
    lastPick.current = id
  }, [rows])
  const clearPick = () => { setPicked(new Set()); setPickMode(false) }
  const allPicked = rows.length > 0 && rows.every((r) => picked.has(r.id))

  const bulk = useCallback(async (action: ThreadAction, opts: { all?: boolean } = {}) => {
    const ids = opts.all ? rows.map((r) => r.id) : [...picked]
    if (!ids.length && !opts.all) return
    const before = rows
    const patch: Partial<ThreadRow> = action === 'read' ? { unread: false, unread_count: 0 } : action === 'unread' ? { unread: true, unread_count: 1 } : action === 'star' ? { starred: true } : action === 'unstar' ? { starred: false } : {}
    const leaves = LEAVES[action]?.includes(folder) && !gmailIds
    setRows((rs) => (leaves ? rs.filter((r) => !ids.includes(r.id)) : rs.map((r) => (ids.includes(r.id) ? { ...r, ...patch } : r))))
    if (leaves && selId && ids.includes(selId)) setSelId(null)
    clearPick()
    const r = await api<{ done?: number; failed?: number; more?: boolean; gmail?: { needs_reconnect?: boolean } }>('/api/nexus/messages/threads/bulk', {
      method: 'POST', json: opts.all ? { folder, all: true, action } : { ids, action },
    })
    if (!r.ok && !r.data.done) { setRows(before); flash(r.data.error ?? 'That didn’t work. Try again.'); return }
    if (r.data.gmail?.needs_reconnect) setReconnectHint(true)
    const n = r.data.done ?? ids.length
    const word: Partial<Record<ThreadAction, string>> = { read: 'marked read', unread: 'marked unread', star: 'flagged', unstar: 'unflagged', archive: 'archived', trash: 'moved to Trash', inbox: 'moved to Inbox', untrash: 'restored' }
    const undoOf: Partial<Record<ThreadAction, ThreadAction>> = { archive: 'inbox', trash: 'untrash', read: 'unread', star: 'unstar' }
    const u = undoOf[action]
    flash(`${n} ${n === 1 ? 'email' : 'emails'} ${word[action] ?? 'done'}${r.data.more ? ' (more left — run it again)' : ''}`,
      u && !opts.all ? () => { setRows(before); void api('/api/nexus/messages/threads/bulk', { method: 'POST', json: { ids, action: u } }).then(() => loadRef.current({ silent: true })) } : undefined)
    void loadRef.current({ silent: true })
  }, [rows, picked, folder, gmailIds, selId, flash])

  // ── sending (with Undo) ───────────────────────────────────────────────────
  const reallySend = useCallback(async (email: OutgoingEmail, seed: ComposerSeed) => {
    setOutbox(null)
    const r = await api<{ ok?: boolean; thread_id?: string; error?: string }>('/api/nexus/messages/send', { method: 'POST', json: email })
    if (!r.ok || r.data.ok === false) {
      flash(`Didn’t send: ${(r.data.error ?? 'unknown error').slice(0, 140)}`)
      if (seed.threadId) { setSelId(seed.threadId); setComposeFor({ mode: seed.mode === 'new' ? 'reply' : seed.mode, restore: seed }) }
      else setCompose(seed)
      return
    }
    flash('Sent')
    if (seed.threadId) setReaderKey((k) => k + 1)
    void loadRef.current({ silent: true })
  }, [flash])

  const queue = useCallback((email: OutgoingEmail, seed: ComposerSeed) => {
    setCompose(null)
    const timer = setTimeout(() => { void reallySend(email, seed) }, 6000)
    setOutbox({ email, seed, timer, until: Date.now() + 6000 })
  }, [reallySend])

  const undoSend = () => {
    if (!outbox) return
    clearTimeout(outbox.timer)
    const s = outbox.seed
    setOutbox(null)
    if (s.threadId) { setSelId(s.threadId); setComposeFor({ mode: s.mode === 'new' ? 'reply' : s.mode, restore: s }) }
    else setCompose(s)
  }
  // Don't lose a queued email if the window closes: send it now.
  useEffect(() => {
    if (!outbox) return
    const flush = () => { clearTimeout(outbox.timer); navigator.sendBeacon?.('/api/nexus/messages/send', new Blob([JSON.stringify(outbox.email)], { type: 'application/json' })) }
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [outbox])
  const [, tick] = useState(0)
  useEffect(() => { if (!outbox) return; const t = setInterval(() => tick((n) => n + 1), 500); return () => clearInterval(t) }, [outbox])

  const newEmail = useCallback(() => setCompose({ key: `new-${Date.now()}`, mode: 'new', to: '', subject: '' }), [])

  const addTodo = async (row: ThreadRow) => {
    const r = await api('/api/todos', { method: 'POST', json: { title: `Follow up: ${row.contact_name}${row.subject ? ' — ' + row.subject : ''}` } })
    flash(r.ok ? 'Added to your to-dos' : 'Could not add the to-do')
  }

  const searchGmail = async () => {
    if (!q) return
    setGmailSearching(true)
    const r = await api<{ thread_ids?: string[]; error?: string }>('/api/nexus/messages/sync', { method: 'POST', json: { query: q } })
    setGmailSearching(false)
    if (!r.ok && !r.data.thread_ids) { flash(r.data.error ?? 'Gmail search failed.'); return }
    setGmailIds(r.data.thread_ids ?? [])
  }

  // ── keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
        if (e.key === 'Escape' && el === searchRef.current) { setQLive(''); searchRef.current?.blur() }
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey || settings || compose) return
      const i = rows.findIndex((r) => r.id === selId)
      const go = (k: number) => { const r = rows[Math.max(0, Math.min(rows.length - 1, k))]; if (r) { open(r); document.getElementById(`mail-row-${r.id}`)?.scrollIntoView({ block: 'nearest' }) } }
      const sel = selected
      switch (e.key) {
        case 'j': case 'ArrowDown': e.preventDefault(); go(i < 0 ? 0 : i + 1); break
        case 'k': case 'ArrowUp': e.preventDefault(); go(i < 0 ? 0 : i - 1); break
        case 'c': e.preventDefault(); newEmail(); break
        case '/': e.preventDefault(); searchRef.current?.focus(); break
        case 'Escape': if (picked.size) clearPick(); else setSelId(null); break
        case 'x': if (sel) { e.preventDefault(); togglePick(sel.id, e.shiftKey) } break
        case 'e': if (sel) { e.preventDefault(); void act(sel, sel.archived ? 'inbox' : 'archive') } break
        case '#': if (sel) { e.preventDefault(); void act(sel, 'trash') } break
        case 's': if (sel) { e.preventDefault(); void act(sel, sel.starred ? 'unstar' : 'star') } break
        case 'u': if (sel) { e.preventDefault(); void act(sel, 'unread', undefined, true); setSelId(null) } break
        case 'r': if (sel) { e.preventDefault(); setComposeFor({ mode: 'reply' }) } break
        case 'a': if (sel) { e.preventDefault(); setComposeFor({ mode: 'replyAll' }) } break
        case 'f': if (sel) { e.preventDefault(); setComposeFor({ mode: 'forward' }) } break
        case 'h': if (sel) { e.preventDefault(); const t = new Date(); t.setDate(t.getDate() + 1); t.setHours(8, 0, 0, 0); void act(sel, 'snooze', { until: t.toISOString() }) } break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rows, selId, selected, open, act, newEmail, settings, compose, picked, togglePick])

  // ── pieces ────────────────────────────────────────────────────────────────
  const folderLabel = FOLDERS.find((f) => f.id === folder)?.label ?? 'Mail'
  const countFor = (f: Folder) => (counts ? (f === 'all_inbox' ? counts.all_inbox ?? 0 : f === 'inbox' ? counts.inbox : f === 'other' ? counts.other : f === 'needs_reply' ? counts.needs_reply : f === 'awaiting' ? counts.awaiting ?? 0 : f === 'snoozed' ? counts.snoozed : f === 'unread' ? counts.unread : 0) : 0)
  const syncLine = useMemo(() => {
    if (!accounts) return { text: 'Checking…', bad: false }
    if (!account) return { text: 'No email connected', bad: true }
    if (account.last_error) return { text: account.last_error, bad: true }
    return { text: `Live · synced ${ago(account.last_synced_at)}`, bad: false }
  }, [accounts, account])

  if (settings) return <Shell onClose={onClose} closeLabel={closeLabel}><MailSettings accounts={accounts ?? []} onBack={() => setSettings(false)} onChanged={() => { void sync(true) }} /></Shell>

  const sideGroups: { label: string; ids: Folder[] }[] = [
    { label: 'Mailboxes', ids: ['all_inbox', 'inbox', 'other', 'needs_reply', 'awaiting'] },
    { label: 'Views', ids: ['unread', 'starred', 'snoozed', 'phone'] },
    { label: 'More', ids: ['sent', 'linked', 'archived', 'trash'] },
  ]
  const sidebar = (
    <nav aria-label="Mail folders" style={{ width: 240, flexShrink: 0, background: 'transparent', borderRight: `1px solid ${N.line}`, flexDirection: 'column', minHeight: 0, color: N.ink }} className="hidden lg:flex">
      <div style={{ padding: '16px 14px 10px' }}>
        <button type="button" onClick={newEmail} style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: '#fff', background: N.brand, border: 0, borderRadius: 11, padding: '11px 12px', cursor: 'pointer', fontFamily: M.font, boxShadow: '0 8px 22px -8px rgba(74,140,255,0.65), inset 0 1px 0 rgba(255,255,255,0.25)' }}>
          <PenSquare size={16} /> New email
        </button>
        {rcAccount && (
          <button type="button" onClick={() => setNewText(true)} style={{ width: '100%', marginTop: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13.5, fontWeight: 500, color: N.ink, background: 'rgba(255,255,255,0.06)', border: `1px solid ${N.line}`, borderRadius: 11, padding: '9px 12px', cursor: 'pointer', fontFamily: M.font }}>
            <PhoneI size={15} style={{ color: FOLDER_COLOR.phone }} /> New text
          </button>
        )}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 10px 10px' }}>
        {sideGroups.map((g) => {
          const items = folders.filter((f) => g.ids.includes(f.id))
          if (!items.length) return null
          return (
            <div key={g.label} style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: N.label, padding: '4px 10px 6px' }}>{g.label}</div>
              {items.map((f) => {
                const Icon = FOLDER_ICON[f.id]
                const on = folder === f.id && !gmailIds
                const c = countFor(f.id)
                const col = FOLDER_COLOR[f.id] ?? N.accent
                return (
                  <button key={f.id} type="button" onClick={() => { setFolder(f.id); setGmailIds(null); setSelId(null) }} title={f.hint || undefined}
                    aria-current={on ? 'page' : undefined} className={on ? '' : 'hover:bg-white/[0.06]'}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', marginBottom: 2, borderRadius: 9, border: 0, cursor: 'pointer', background: on ? N.sel : 'transparent', boxShadow: on ? `inset 3px 0 0 ${col}` : undefined, color: on ? '#fff' : N.ink, fontFamily: M.font, fontSize: 13.5, fontWeight: on ? 600 : 500, textAlign: 'left' }}>
                    <span aria-hidden style={{ width: 26, height: 26, borderRadius: 8, background: `${col}26`, color: col, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={15} /></span>
                    <span style={{ flex: 1 }}>{f.label}</span>
                    {c > 0 && <span style={{ fontSize: 11.5, fontWeight: 600, minWidth: 22, textAlign: 'center', padding: '1px 7px', borderRadius: 20, background: f.id === 'all_inbox' ? N.accent : N.pill, color: '#fff' }}>{c > 999 ? '999+' : c}</span>}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
      <div style={{ margin: 10, padding: '12px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: `1px solid ${N.line}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span aria-hidden style={{ width: 30, height: 30, borderRadius: 30, background: N.brand, color: '#fff', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{(account?.email ?? '?').slice(0, 1).toUpperCase()}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: N.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{account?.email ?? 'Email'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: syncLine.bad ? '#FCA5A5' : N.ink2, marginTop: 2 }}>
              <span aria-hidden style={{ width: 6, height: 6, borderRadius: 6, background: syncLine.bad ? '#F87171' : '#34D399', boxShadow: syncLine.bad ? undefined : '0 0 0 3px rgba(52,211,153,0.18)', flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{syncLine.text}</span>
            </div>
            {rcAccount && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: rcAccount.last_error ? '#FCA5A5' : N.ink2, marginTop: 2 }}>
                <span aria-hidden style={{ width: 6, height: 6, borderRadius: 6, background: rcAccount.last_error ? '#F87171' : '#34D399', flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rcAccount.last_error ? `RingCentral: ${rcAccount.last_error}` : `RingCentral · synced ${ago(rcAccount.last_synced_at)}`}</span>
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {syncLine.bad
            ? <a href="/api/nexus/messages/google/connect" style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', background: N.brand, borderRadius: 8, padding: '6px 10px', textDecoration: 'none' }}>{account ? 'Reconnect Gmail' : 'Connect Gmail'}</a>
            : <button type="button" onClick={() => void sync(true)} style={navBtn}>{syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Refresh</button>}
          <button type="button" onClick={() => setSettings(true)} style={navBtn} aria-label="Mail settings"><Settings size={13} /> Settings</button>
        </div>
      </div>
    </nav>
  )

  const list = (
    <section aria-label={folderLabel} style={{ flexDirection: 'column', minHeight: 0, background: N.canvas, borderRight: `1px solid ${N.cardLine}` }} className={`${selected ? 'hidden lg:flex' : 'flex'} w-full lg:w-[390px] lg:flex-shrink-0 lg:rounded-tl-[14px]`}>
      <div style={{ padding: '14px 14px 10px', background: 'linear-gradient(180deg,#FFFFFF,#F7F9FC)', borderBottom: `1px solid ${N.cardLine}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          {/* phone: folder picker */}
          <div className="lg:hidden" style={{ position: 'relative' }}>
            <button type="button" onClick={() => setFolderMenu((o) => !o)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 19, fontWeight: 600, color: M.ink, background: 'none', border: 0, padding: 0, cursor: 'pointer', fontFamily: M.font }}>
              {gmailIds ? 'Gmail results' : folderLabel} <ChevronDown size={16} style={{ color: M.ink3 }} />
            </button>
            {folderMenu && (
              <div role="menu" style={{ position: 'absolute', top: 30, left: 0, zIndex: 40, width: 240, background: '#fff', border: `1px solid ${M.line}`, borderRadius: 12, boxShadow: '0 16px 40px rgba(0,0,0,0.16)', padding: 4 }}>
                {folders.map((f) => (
                  <button key={f.id} type="button" role="menuitem" onClick={() => { setFolder(f.id); setGmailIds(null); setFolderMenu(false) }} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '9px 12px', border: 0, background: folder === f.id ? 'rgba(0,0,0,0.05)' : 'none', borderRadius: 8, cursor: 'pointer', color: M.ink, fontFamily: M.font }}>
                    {f.label}{countFor(f.id) > 0 && <span style={{ color: M.ink3 }}>{countFor(f.id)}</span>}
                  </button>
                ))}
                <div style={{ height: 1, background: M.line, margin: 4 }} />
                <button type="button" role="menuitem" onClick={() => { setFolderMenu(false); setSettings(true) }} style={{ width: '100%', textAlign: 'left', fontSize: 14, padding: '9px 12px', border: 0, background: 'none', cursor: 'pointer', color: M.ink, fontFamily: M.font }}>Settings</button>
              </div>
            )}
          </div>
          <span className="hidden lg:inline-flex" aria-hidden style={{ width: 30, height: 30, borderRadius: 9, background: `${FOLDER_COLOR[folder] ?? N.accent}1F`, color: FOLDER_COLOR[folder] ?? N.accent, alignItems: 'center', justifyContent: 'center' }}>{React.createElement(FOLDER_ICON[folder] ?? Inbox, { size: 16 })}</span>
          <h2 className="hidden lg:block" style={{ margin: 0, fontSize: 19, fontWeight: 600, color: M.ink, letterSpacing: '-0.01em' }}>{gmailIds ? 'Gmail results' : folderLabel}</h2>
          {counts && !gmailIds && (folder === 'all_inbox' || folder === 'inbox' || folder === 'other') && <span style={{ fontSize: 11.5, fontWeight: 600, color: countFor(folder) ? N.accent : M.ink3, background: countFor(folder) ? 'rgba(74,140,255,0.10)' : 'transparent', borderRadius: 20, padding: '2px 8px' }}>{countFor(folder)} unread</span>}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
            <span className="flex lg:hidden" style={{ gap: 2 }}>
              <button type="button" onClick={() => void sync(true)} aria-label="Refresh" style={iconBtn}>{syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}</button>
              <button type="button" onClick={newEmail} aria-label="New email" style={{ ...iconBtn, color: M.blue }}><PenSquare size={17} /></button>
              {onClose && <button type="button" onClick={onClose} aria-label={closeLabel} style={iconBtn}><X size={17} /></button>}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: `1px solid ${N.cardLine}`, boxShadow: '0 1px 2px rgba(15,23,42,0.04)', borderRadius: 10, padding: '0 10px' }}>
          <Search size={14} style={{ color: M.ink3, flexShrink: 0 }} />
          <input ref={searchRef} value={qLive} onChange={(e) => setQLive(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void searchGmail() }}
            placeholder="Search mail" aria-label="Search mail" style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', fontSize: 13.5, padding: '8px 0', color: M.ink, fontFamily: M.font }} />
          {qLive && <button type="button" aria-label="Clear search" onClick={() => setQLive('')} style={{ border: 0, background: 'none', color: M.ink3, cursor: 'pointer', display: 'inline-flex' }}><X size={14} /></button>}
        </div>
        {q && (
          <button type="button" onClick={() => void searchGmail()} style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: M.blue, background: 'none', border: 0, padding: 0, cursor: 'pointer', fontFamily: M.font }}>
            {gmailSearching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />} {gmailIds ? `Showing all of Gmail for “${q}”` : `Search all of Gmail for “${q}” (older mail too)`}
          </button>
        )}
      </div>

      {(picked.size > 0 || pickMode) ? (
        <div role="toolbar" aria-label="Selected emails" style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '6px 10px', borderBottom: `1px solid ${M.line}`, background: '#F5F8FF', flexWrap: 'wrap' }}>
          <button type="button" role="checkbox" aria-checked={allPicked} aria-label="Select all" onClick={() => setPicked(allPicked ? new Set() : new Set(rows.map((r) => r.id)))}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: M.ink, background: 'none', border: 0, padding: '5px 6px', cursor: 'pointer', fontFamily: M.font }}>
            <span style={{ width: 18, height: 18, borderRadius: 18, border: allPicked ? 0 : `1.5px solid ${M.ink4}`, background: allPicked ? M.blue : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>{allPicked && <Check size={12} strokeWidth={3} />}</span>
            {picked.size ? `${picked.size} selected` : 'Select all'}
          </button>
          <span style={{ flex: 1 }} />
          {picked.size > 0 && <>
            <button type="button" title="Mark read" aria-label="Mark selected read" onClick={() => void bulk('read')} style={iconBtn}><MailOpen size={16} /></button>
            <button type="button" title="Mark unread" aria-label="Mark selected unread" onClick={() => void bulk('unread')} style={iconBtn}><MailI size={16} /></button>
            <button type="button" title="Flag" aria-label="Flag selected" onClick={() => void bulk(rows.filter((r) => picked.has(r.id)).every((r) => r.starred) ? 'unstar' : 'star')} style={iconBtn}><Flag size={16} /></button>
            {folder === 'archived' || folder === 'trash'
              ? <button type="button" title="Move to inbox" aria-label="Move selected to inbox" onClick={() => void bulk(folder === 'trash' ? 'untrash' : 'inbox')} style={iconBtn}><Inbox size={16} /></button>
              : <button type="button" title="Archive" aria-label="Archive selected" onClick={() => void bulk('archive')} style={iconBtn}><Archive size={16} /></button>}
            {folder !== 'trash' && <button type="button" title="Trash" aria-label="Trash selected" onClick={() => void bulk('trash')} style={iconBtn}><Trash2 size={16} /></button>}
          </>}
          <button type="button" onClick={clearPick} style={{ fontSize: 13, color: M.blue, background: 'none', border: 0, padding: '5px 8px', cursor: 'pointer', fontFamily: M.font }}>Done</button>
        </div>
      ) : rows.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '7px 16px 3px' }}>
          <button type="button" onClick={() => setPickMode(true)} style={linkBtn}>Select</button>
          {rows.some((r) => r.unread) && <button type="button" onClick={() => void bulk('read', { all: true })} style={linkBtn}><CheckCheck size={13} /> Mark all as read</button>}
        </div>
      )}

      {needsMigration && <div style={banner}>Mail is running in basic mode until migration 222 is run.</div>}
      {reconnectHint && account && (
        <div style={banner}>Changes are saved here. <a href="/api/nexus/messages/google/connect" style={{ color: M.blue, fontWeight: 600 }}>Reconnect Gmail</a> once so they also show in Gmail.</div>
      )}

      <div ref={listRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 0 12px' }}>
        {loading && rows.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: M.ink3 }}><Loader2 size={18} className="animate-spin" /></div>
        ) : rows.length === 0 ? (
          <EmptyState folder={folder} searching={!!q} hasAccount={!!account} accountsLoaded={!!accounts} onConnect={() => setSettings(true)} />
        ) : rows.map((r) => (
          <Row key={r.id} r={r} selected={r.id === selId} checked={picked.has(r.id)} picking={picked.size > 0 || pickMode} awaitingView={folder === 'awaiting'}
            onCheck={(shift) => togglePick(r.id, shift)} onOpen={() => open(r)}
            onArchive={() => void act(r, r.archived ? 'inbox' : 'archive')}
            onRead={() => void act(r, r.unread ? 'read' : 'unread', undefined, true)}
            onStar={() => void act(r, r.starred ? 'unstar' : 'star', undefined, true)} />
        ))}
        {nextBefore && rows.length > 0 && (
          <div style={{ padding: 14, textAlign: 'center' }}>
            <button type="button" onClick={() => void load({ more: true })} style={sideBtn}>{loadingMore ? <Loader2 size={13} className="animate-spin" /> : null} Load more</button>
          </div>
        )}
      </div>
    </section>
  )

  const reader = selected ? (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative' }}>
        <MailReader row={selected} selfEmail={selfEmail} channelId={account?.id ?? selected.channel_id} fromEmail={account?.email}
          refreshKey={readerKey}
          onAction={(a, x) => void act(selected, a, x)}
          onBack={() => setSelId(null)}
          onQueue={queue}
          onTodo={() => void addTodo(selected)}
          composeFor={composeFor} onComposed={() => setComposeFor(null)} />
        <span className="hidden xl:block" style={{ position: 'absolute', top: 8, right: 12 }}>
          <button type="button" onClick={() => { const v = !showContext; setShowContext(v); savePrefs({ context: v }) }}
            aria-label={showContext ? 'Hide customer details' : 'Show customer details'} title={showContext ? 'Hide details' : 'Customer details'}
            style={{ ...iconBtn, color: showContext ? M.blue : M.ink2 }}>
            {PanelRight ? <PanelRight size={17} /> : <Sparkles size={17} />}
          </button>
        </span>
      </div>
      {showContext && (
        <aside className="hidden xl:block" style={{ width: 300, flexShrink: 0, minHeight: 0 }} aria-label="Customer details">
          <MailContext row={selected} onLinked={(p) => patchRow(selected.id, p)} onClose={() => { setShowContext(false); savePrefs({ context: false }) }} />
        </aside>
      )}
    </div>
  ) : (
    <div className="hidden lg:flex" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', background: `radial-gradient(600px 400px at 50% 40%, rgba(74,140,255,0.08), transparent 70%), ${N.canvas}`, color: M.ink3, flexDirection: 'column', gap: 10, fontFamily: M.font }}>
      <span aria-hidden style={{ width: 64, height: 64, borderRadius: 18, background: N.brand, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 16px 36px -14px rgba(74,140,255,0.7)' }}><Inbox size={30} /></span>
      <div style={{ fontSize: 16, fontWeight: 600, color: M.ink }}>{rows.length ? 'Pick an email' : 'Nothing here'}</div>
      <div style={{ fontSize: 12.5 }}>j / k to move · c for a new email · ⌘↵ to send</div>
      {counts && (counts.needs_reply > 0 || counts.all_inbox > 0) && (
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          {[['all_inbox', 'Unread', counts.all_inbox], ['needs_reply', 'Waiting on you', counts.needs_reply], ['awaiting', 'Waiting on them', counts.awaiting ?? 0]].map(([id, label, n]) => (
            <button key={String(id)} type="button" onClick={() => { setFolder(id as Folder); setGmailIds(null) }} style={{ minWidth: 112, textAlign: 'left', padding: '10px 12px', borderRadius: 12, background: '#fff', border: `1px solid ${N.cardLine}`, boxShadow: N.cardShadow, cursor: 'pointer', fontFamily: M.font }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: FOLDER_COLOR[String(id)], fontVariantNumeric: 'tabular-nums' }}>{String(n)}</div>
              <div style={{ fontSize: 12, color: M.ink3 }}>{String(label)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <Shell onClose={onClose} closeLabel={closeLabel}>
      <div style={{ display: 'flex', height: '100%', minHeight: 0, fontFamily: M.font, color: M.ink, position: 'relative' }}>
        {sidebar}
        {list}
        {reader}

        {newText && (
          <div style={{ position: 'absolute', right: 16, bottom: 16, width: 'min(440px, calc(100% - 32px))', zIndex: 50 }}>
            <NewTextModal channelId={rcAccount?.id ?? null} fromNumber={rcAccount?.sms_from} onClose={() => setNewText(false)}
              onSent={(id) => { flash('Text sent'); void loadRef.current({ silent: true }).then(() => { if (id) setSelId(id) }) }} />
          </div>
        )}

        {compose && (
          <div style={{ position: 'absolute', right: 16, bottom: 16, width: 'min(600px, calc(100% - 32px))', height: 'min(560px, calc(100% - 32px))', zIndex: 50 }}>
            <MailComposer seed={compose} channelId={account?.id ?? null} fromEmail={account?.email} onQueue={queue} onClose={() => setCompose(null)} />
          </div>
        )}

        {(toast || outbox) && (
          <div role="status" aria-live="polite" style={{ position: 'absolute', left: '50%', bottom: 18, transform: 'translateX(-50%)', zIndex: 60, display: 'flex', alignItems: 'center', gap: 14, background: '#1D1D1F', color: '#fff', borderRadius: 10, padding: '10px 16px', fontSize: 13.5, boxShadow: '0 10px 30px rgba(0,0,0,0.25)', fontFamily: M.font, maxWidth: 'calc(100% - 32px)' }}>
            {outbox ? (
              <>
                <span>Sending in {Math.max(1, Math.ceil((outbox.until - Date.now()) / 1000))}…</span>
                <button type="button" onClick={undoSend} style={toastBtn}>Undo</button>
                <button type="button" onClick={() => { clearTimeout(outbox.timer); void reallySend(outbox.email, outbox.seed) }} style={{ ...toastBtn, color: 'rgba(255,255,255,0.7)' }}>Send now</button>
              </>
            ) : toast ? (
              <>
                <span>{toast.text}</span>
                {toast.undo && <button type="button" onClick={() => { toast.undo!(); setToast(null) }} style={toastBtn}>Undo</button>}
              </>
            ) : null}
          </div>
        )}
      </div>
    </Shell>
  )
}

function Shell({ children, onClose, closeLabel }: { children: React.ReactNode; onClose?: () => void; closeLabel: string }) {
  return (
    <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', background: N.bg, color: N.ink }}>
      {onClose && (
        <div className="hidden lg:flex" style={{ alignItems: 'center', gap: 12, padding: '9px 16px', borderBottom: `1px solid ${N.line}`, fontFamily: M.font }}>
          <button type="button" onClick={onClose} className="hover:bg-white/[0.08]" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: N.ink, background: 'rgba(255,255,255,0.05)', border: `1px solid ${N.line}`, borderRadius: 9, padding: '6px 11px', cursor: 'pointer', fontFamily: M.font }}>
            <ArrowLeft size={14} /> {closeLabel}
          </button>
          <span style={{ flex: 1 }} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
            <span aria-hidden style={{ width: 26, height: 26, borderRadius: 8, background: N.brand, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 6px 16px -6px rgba(74,140,255,0.7)' }}><MailI size={14} /></span>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#fff', letterSpacing: '-0.01em' }}>Mail</span>
            <span style={{ fontSize: 11, color: N.label, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Nexus</span>
          </span>
          <span style={{ flex: 1 }} />
          <span style={{ width: 120 }} />
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  )
}

function Row({ r, selected, checked, picking, awaitingView, onCheck, onOpen, onArchive, onRead, onStar }: { r: ThreadRow; selected: boolean; checked: boolean; picking: boolean; awaitingView?: boolean; onCheck: (shift: boolean) => void; onOpen: () => void; onArchive: () => void; onRead: () => void; onStar: () => void }) {
  const badge = r.linked_type ? RECORD_BADGE[r.linked_type] : null
  const who = r.last_from_me ? `To: ${r.contact_name}` : r.contact_name
  const tint = tintFor(r.contact_name)
  const isText = r.channel === 'text'
  return (
    <div id={`mail-row-${r.id}`} className="group" style={{
      position: 'relative', display: 'flex', margin: '6px 10px', borderRadius: 12,
      background: checked ? '#F1F6FF' : N.card,
      border: `1px solid ${selected ? N.accent : checked ? 'rgba(74,140,255,0.45)' : N.cardLine}`,
      boxShadow: selected ? '0 0 0 3px rgba(74,140,255,0.16), 0 6px 18px -8px rgba(74,140,255,0.45)' : N.cardShadow,
      overflow: 'hidden', transition: 'box-shadow .12s, border-color .12s',
    }}>
      {r.unread && <span aria-hidden style={{ position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: 3, background: N.accent }} />}
      {/* Avatar doubles as the select box (tap it, or hover on a computer) */}
      <button type="button" role="checkbox" aria-checked={checked} aria-label={`Select ${r.subject}`} onClick={(e) => onCheck(e.shiftKey)}
        style={{ width: 38, height: 38, margin: '12px 0 0 12px', borderRadius: 38, flexShrink: 0, border: 0, padding: 0, cursor: 'pointer', position: 'relative', background: 'transparent' }}>
        <span className={picking || checked ? 'hidden' : 'flex lg:group-hover:hidden'} style={{ width: 38, height: 38, borderRadius: 38, background: `linear-gradient(140deg, ${tint}, ${tint}B3)`, color: '#fff', alignItems: 'center', justifyContent: 'center', fontSize: 13.5, fontWeight: 600, boxShadow: `0 4px 10px -4px ${tint}99` }}>{isText ? <PhoneI size={16} /> : initials(r.contact_name)}</span>
        <span className={picking || checked ? 'flex' : 'hidden lg:group-hover:flex'} style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ width: 22, height: 22, borderRadius: 22, border: checked ? 0 : `1.5px solid ${M.ink4}`, background: checked ? N.accent : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>{checked && <Check size={14} strokeWidth={3} />}</span>
        </span>
      </button>
      <button type="button" onClick={(e) => (picking || e.metaKey || e.ctrlKey || e.shiftKey ? onCheck(e.shiftKey) : onOpen())} aria-current={selected ? 'true' : undefined}
        style={{ flex: 1, minWidth: 0, display: 'flex', gap: 10, padding: '11px 14px 11px 11px', border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer', fontFamily: M.font }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: r.unread ? 700 : 600, color: M.ink, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{who}{r.message_count && r.message_count > 1 ? <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, color: M.ink3, background: '#EEF1F6', borderRadius: 10, padding: '1px 6px' }}>{r.message_count}</span> : null}</span>
            <span style={{ fontSize: 12, fontWeight: r.unread ? 600 : 400, color: r.unread ? N.accent : M.ink3, flexShrink: 0 }}>{r.snoozed_until ? `⏰ ${listTime(r.snoozed_until)}` : listTime(r.last_at)}</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: r.unread ? 600 : 500, color: r.unread ? M.ink : M.ink2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{isText ? 'Text message' : r.subject}</span>
            {r.has_attachments && <Paperclip size={12.5} style={{ color: M.ink3, flexShrink: 0 }} />}
            {r.starred && <Flag size={12.5} fill={M.flag} style={{ color: M.flag, flexShrink: 0 }} aria-label="Flagged" />}
          </span>
          <span style={{ fontSize: 12.5, color: M.ink3, marginTop: 3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.4 } as React.CSSProperties}>{r.preview}</span>
          {(badge || (r.needs_reply && !r.last_from_me) || r.bulk || isText || (awaitingView && r.last_from_me)) && (
            <span style={{ display: 'flex', gap: 5, marginTop: 7, flexWrap: 'wrap' }}>
              {badge && <span style={{ ...tag, color: badge.color, background: `${badge.color}17`, maxWidth: 230 }}>{badge.label}{r.linked_label ? ` · ${r.linked_label}` : ''}</span>}
              {isText && <span style={{ ...tag, color: '#0F9F6E', background: 'rgba(52,211,153,0.15)' }}>Text</span>}
              {r.needs_reply && !r.last_from_me && !r.bulk && <span style={{ ...tag, color: '#B76E00', background: 'rgba(245,165,36,0.15)' }}>Waiting on you</span>}
              {r.bulk && <span style={{ ...tag, color: '#5B6B80', background: '#EEF1F6' }}>Newsletter</span>}
              {awaitingView && r.last_from_me && <span style={{ ...tag, color: '#0F766E', background: 'rgba(20,184,166,0.14)' }}>No reply · {daysSince(r.last_at)}</span>}
            </span>
          )}
        </span>
      </button>
      {!picking && (
        <div className="hidden lg:group-hover:flex" style={{ position: 'absolute', right: 10, bottom: 8, gap: 2, background: '#fff', borderRadius: 9, boxShadow: '0 4px 14px rgba(15,23,42,0.16)', border: `1px solid ${N.cardLine}`, padding: 2 }}>
          <button type="button" title={r.archived ? 'Move to inbox' : 'Archive'} aria-label={r.archived ? 'Move to inbox' : 'Archive'} onClick={onArchive} style={iconBtnSm}>{r.archived ? <Inbox size={14} /> : <Archive size={14} />}</button>
          <button type="button" title={r.unread ? 'Mark read' : 'Mark unread'} aria-label={r.unread ? 'Mark read' : 'Mark unread'} onClick={onRead} style={iconBtnSm}><MailOpen size={14} /></button>
          <button type="button" title={r.starred ? 'Unflag' : 'Flag'} aria-label={r.starred ? 'Unflag' : 'Flag'} onClick={onStar} style={iconBtnSm}><Flag size={14} fill={r.starred ? M.flag : 'none'} style={{ color: r.starred ? M.flag : undefined }} /></button>
        </div>
      )}
    </div>
  )
}
const daysSince = (iso: string) => { const d = Math.floor((Date.now() - Date.parse(iso)) / 86400_000); return d <= 0 ? 'today' : d === 1 ? '1 day' : `${d} days` }
const tag: React.CSSProperties = { fontSize: 11, fontWeight: 600, borderRadius: 6, padding: '2px 7px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

function EmptyState({ folder, searching, hasAccount, accountsLoaded, onConnect }: { folder: Folder; searching: boolean; hasAccount: boolean; accountsLoaded: boolean; onConnect: () => void }) {
  if (accountsLoaded && !hasAccount) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center', fontFamily: M.font }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: M.ink }}>Connect your email</div>
        <div style={{ fontSize: 13, color: M.ink3, margin: '6px 0 14px', lineHeight: 1.5 }}>Bring your Gmail into Nexus. Everything stays in step with Gmail both ways.</div>
        <button type="button" onClick={onConnect} style={{ fontSize: 13.5, fontWeight: 600, color: '#fff', background: M.blue, border: 0, borderRadius: 9, padding: '9px 16px', cursor: 'pointer' }}>Connect Gmail</button>
      </div>
    )
  }
  const text = searching ? 'No matches here. Press Enter to search all of Gmail.'
    : folder === 'inbox' || folder === 'all_inbox' ? 'Inbox zero. Nice.' : folder === 'needs_reply' ? 'You’re caught up — nobody is waiting on you.' : folder === 'awaiting' ? 'Everyone you wrote to has answered.'
    : folder === 'snoozed' ? 'Nothing snoozed.' : 'Nothing here.'
  return <div style={{ padding: '40px 24px', textAlign: 'center', fontSize: 13.5, color: M.ink3, fontFamily: M.font }}>{text}</div>
}

const navBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: N.ink, background: 'rgba(255,255,255,0.07)', border: `1px solid ${N.line}`, borderRadius: 8, padding: '5px 9px', cursor: 'pointer', fontFamily: M.font }
const iconBtn: React.CSSProperties = { width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: 0, background: 'transparent', color: M.ink2, cursor: 'pointer' }
const iconBtnSm: React.CSSProperties = { ...iconBtn, width: 28, height: 28 }
const sideBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: M.ink2, background: '#fff', border: `1px solid ${M.line}`, borderRadius: 7, padding: '5px 9px', cursor: 'pointer', fontFamily: M.font }
const linkBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: M.blue, background: 'none', border: 0, padding: '3px 0', cursor: 'pointer', fontFamily: M.font }
const toastBtn: React.CSSProperties = { fontSize: 13.5, fontWeight: 600, color: '#64B5FF', background: 'none', border: 0, cursor: 'pointer', padding: 0, fontFamily: M.font }
const banner: React.CSSProperties = { padding: '8px 14px', fontSize: 12.5, color: M.ink2, background: '#FFF8E6', borderBottom: `1px solid ${M.line}`, fontFamily: M.font }
