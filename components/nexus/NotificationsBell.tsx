'use client'

/**
 * Bell in the bottom bar: unread count + a list of my notifications.
 * Clicking a task notification marks it read and opens that task on My Day.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell } from 'lucide-react'

type Note = {
  id: string; type: string; title: string; body: string | null; link: string | null
  entity_type: string | null; entity_id: string | null; actor_name: string | null
  read_at: string | null; created_at: string
}

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif'

function ago(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.round(h / 24)
  return d < 7 ? `${d}d` : new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const ICON: Record<string, string> = { task_assigned: '→', task_mention: '@', task_comment: '💬', task_update: '•' }

export function NotificationsBell({ onOpenTask }: { onOpenTask: (taskId: string) => void }) {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const [unread, setUnread] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      const data = await res.json().catch(() => null) as { notifications?: Note[]; unread?: number; error?: string } | null
      if (!res.ok) { setErr(data?.error ?? 'Could not load notifications'); return }
      setErr(null); setNotes(data?.notifications ?? []); setUnread(data?.unread ?? 0)
    } catch { setErr('Could not load notifications') }
  }, [])

  useEffect(() => {
    void load()
    const t = setInterval(() => { if (document.visibilityState === 'visible') void load() }, 60000)
    return () => clearInterval(t)
  }, [load])
  useEffect(() => { if (open) void load() }, [open, load])

  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => {
      const n = e.target as Node
      if (pop.current?.contains(n) || btn.current?.contains(n)) return
      setOpen(false)
    }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key) }
  }, [open])

  async function markRead(ids: string[] | 'all') {
    const now = new Date().toISOString()
    setNotes(prev => prev.map(n => (ids === 'all' || ids.includes(n.id)) && !n.read_at ? { ...n, read_at: now } : n))
    setUnread(u => ids === 'all' ? 0 : Math.max(0, u - notes.filter(n => ids.includes(n.id) && !n.read_at).length))
    const res = await fetch('/api/notifications', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ids === 'all' ? { all: true } : { ids }),
    }).catch(() => null)
    if (!res?.ok) void load()
  }

  function click(n: Note) {
    if (!n.read_at) void markRead([n.id])
    setOpen(false)
    if (n.entity_type === 'todo' && n.entity_id) onOpenTask(n.entity_id)
    else if (n.link) window.location.href = n.link
  }

  return (
    <>
      <button ref={btn} type="button" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} aria-expanded={open}
        onClick={() => setOpen(o => !o)} title="Notifications"
        className="relative shrink-0 rounded-full p-2 transition-colors hover:opacity-90" style={{ color: open ? '#fff' : 'rgba(255,255,255,0.6)' }}>
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none"
            style={{ background: '#FF3B30', color: '#fff' }}>{unread > 99 ? '99+' : unread}</span>
        )}
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div ref={pop} role="dialog" aria-label="Notifications"
          style={{ position: 'fixed', right: 16, bottom: 'calc(92px + env(safe-area-inset-bottom))', zIndex: 130, width: 'min(380px, calc(100vw - 32px))', maxHeight: 'min(560px, calc(100vh - 140px))', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 14, boxShadow: '0 20px 50px rgba(5,10,25,.35), 0 0 0 1px rgba(15,23,42,.08)', fontFamily: FONT, color: '#1D1D1F', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px 10px', borderBottom: '1px solid rgba(15,23,42,.08)' }}>
            <div style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>Notifications</div>
            {unread > 0 && <button type="button" onClick={() => void markRead('all')} style={{ fontSize: 13, color: '#0071E3', background: 'none', border: 0, cursor: 'pointer', padding: 4 }}>Mark all read</button>}
          </div>
          <div style={{ overflowY: 'auto' }}>
            {err && <div style={{ padding: 16, fontSize: 13, color: '#C9302C' }}>{err}</div>}
            {!err && notes.length === 0 && <div style={{ padding: '28px 16px', fontSize: 13, color: '#6E6E73', textAlign: 'center' }}>You're all caught up.</div>}
            {notes.map(n => (
              <button key={n.id} type="button" onClick={() => click(n)} className="nx-note"
                style={{ display: 'flex', gap: 10, width: '100%', textAlign: 'left', padding: '11px 16px', border: 0, borderBottom: '1px solid rgba(15,23,42,.06)', background: n.read_at ? '#fff' : '#F2F7FF', cursor: 'pointer', fontFamily: FONT }}>
                <span aria-hidden style={{ flex: '0 0 28px', height: 28, borderRadius: 14, background: '#E8EEF8', color: '#0071E3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600 }}>{ICON[n.type] ?? '•'}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: n.read_at ? 400 : 600, color: '#1D1D1F', lineHeight: 1.35 }}>{n.title}</span>
                  {n.body && <span style={{ display: 'block', fontSize: 12, color: '#6E6E73', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</span>}
                </span>
                <span style={{ flex: '0 0 auto', fontSize: 11, color: '#8E8E93', paddingTop: 2 }}>{ago(n.created_at)}</span>
                {!n.read_at && <span aria-label="Unread" style={{ flex: '0 0 8px', height: 8, borderRadius: 4, background: '#0071E3', marginTop: 6 }} />}
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
