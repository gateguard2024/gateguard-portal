'use client'

/**
 * PriorityGlassPane — opens a single "Today's Priority" into a glass pane so the
 * user can work it without leaving My Day: understand it, open the related
 * record, add a note, or mark it done. Follows the Nexus glass-pane standard.
 */
import { useState } from 'react'

export type PriorityItem = {
  id: string
  type: string
  title: string
  reason: string
  urgency: 'high' | 'medium' | 'low'
  date?: string | null
  time?: string | null
  link?: string | null
}

const URGENCY = {
  high:   { label: 'High priority',   color: '#f87171' },
  medium: { label: 'Needs attention', color: '#fbbf24' },
  low:    { label: 'When you can',     color: '#94a3b8' },
}

function typeLabel(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function PriorityGlassPane({
  item, onBack, onRefresh, onOpenJob,
}: {
  item: PriorityItem
  onBack: () => void
  onRefresh?: () => Promise<void> | void
  onOpenJob?: (id: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')

  const u = URGENCY[item.urgency] ?? URGENCY.low
  const isJob = item.type === 'work_order'

  async function act(body: Record<string, unknown>, okMsg: string) {
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/nexus/my-day/action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, item_type: item.type, item_id: item.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.success === false) throw new Error(data?.message ?? 'That did not work.')
      setMsg(okMsg)
      if (onRefresh) await onRefresh()
      return true
    } catch (e) { setMsg(e instanceof Error ? e.message : 'That did not work.'); return false }
    finally { setBusy(false) }
  }

  function openRelated() {
    if (isJob && onOpenJob) { onOpenJob(item.id); return }
    if (item.link && typeof window !== 'undefined') window.location.href = item.link
  }

  return (
    <div className="fixed inset-0 z-[95] overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div className="mx-auto w-full max-w-2xl rounded-[2rem] p-5 shadow-2xl"
        style={{ background: 'radial-gradient(circle at 16% 0%, rgba(0,124,255,0.16), transparent 34%), linear-gradient(180deg, rgba(8,18,34,0.97), rgba(3,9,22,0.97))', border: '1px solid rgba(0,200,255,0.22)', backdropFilter: 'blur(28px)' }}>
        <button type="button" onClick={onBack} className="mb-3 text-[11px]" style={{ color: 'rgba(125,229,255,0.86)' }}>← Back to priorities</button>

        {/* Top card */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: 'rgba(125,229,255,0.7)' }}>{typeLabel(item.type)}</div>
            <h2 className="mt-1 text-2xl font-semibold" style={{ color: 'rgba(255,255,255,0.97)' }}>{item.title}</h2>
            {(item.date || item.time) && <div className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{[item.date, item.time].filter(Boolean).join(' · ')}</div>}
          </div>
          <span className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ background: `${u.color}22`, border: `1px solid ${u.color}55`, color: u.color }}>{u.label}</span>
        </div>

        {/* Why it's here */}
        <div className="mt-4 rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.4)' }}>Why this is here</div>
          <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.78)' }}>{item.reason || 'Flagged for your attention today.'}</p>
        </div>

        {msg && <div className="mt-3 rounded-2xl p-3 text-xs" style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.18)', color: 'rgba(255,255,255,0.8)' }}>{msg}</div>}

        {/* Actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          {(isJob || item.link) && (
            <button type="button" disabled={busy} onClick={openRelated} className="rounded-2xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #00C8FF, #007CFF)' }}>
              {isJob ? 'Open the job' : 'Open record'}
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => act({ action: 'mark_done' }, 'Marked done.')} className="rounded-2xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50" style={{ background: 'rgba(52,211,153,0.16)', border: '1px solid rgba(52,211,153,0.4)', color: '#6ee7b7' }}>Mark done</button>
          {isJob && (
            <button type="button" disabled={busy} onClick={() => setNoteOpen(o => !o)} className="rounded-2xl px-4 py-2.5 text-sm font-semibold" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>Add note</button>
          )}
        </div>

        {noteOpen && (
          <div className="mt-3 space-y-2 rounded-2xl p-3" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(0,200,255,0.22)' }}>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Add a note to this job…" className="w-full resize-none rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'rgba(0,0,0,0.24)', border: '1px solid rgba(0,200,255,0.2)', color: 'rgba(255,255,255,0.9)' }} />
            <button type="button" disabled={busy || !note.trim()} onClick={async () => { const ok = await act({ action: 'add_note', note }, 'Note added.'); if (ok) { setNote(''); setNoteOpen(false) } }} className="rounded-full px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40" style={{ background: 'linear-gradient(135deg, #00C8FF, #007CFF)' }}>{busy ? 'Saving…' : 'Save note'}</button>
          </div>
        )}
      </div>
    </div>
  )
}
