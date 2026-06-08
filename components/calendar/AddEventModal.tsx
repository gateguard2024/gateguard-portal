'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

type EventDraft = {
  title: string
  date: string
  start_time: string
  end_time: string
  location: string
  notes: string
}

function todayDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function emptyDraft(): EventDraft {
  return {
    title: '',
    date: todayDate(),
    start_time: '09:00',
    end_time: '10:00',
    location: '',
    notes: '',
  }
}

export function AddEventModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  onSaved?: () => void | Promise<void>
}) {
  const [draft, setDraft] = useState<EventDraft>(() => emptyDraft())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Prevent background scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  async function saveEvent() {
    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/calendar/events/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const data = await res.json().catch(() => ({})) as { success?: boolean; message?: string }
      if (!res.ok || data.success === false) throw new Error(data.message || 'Could not add event.')

      setDraft(emptyDraft())
      onClose()
      await onSaved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add event.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/60 px-4">
      <div className="flex min-h-full items-center justify-center py-4">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0C111D] p-5 shadow-2xl max-h-[85vh] overflow-y-auto overscroll-contain">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-sky-300">Nexus Calendar</div>
            <h2 className="mt-1 text-lg font-semibold text-white">Add Event</h2>
            <p className="mt-1 text-xs text-white/45">Save it here first. Google sync is optional later.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 p-2 text-white/60 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-white/70">Title</span>
            <input
              value={draft.title}
              onChange={e => setDraft(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Example: Site walk at Marbella"
              className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-sky-400/50"
              autoFocus
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs font-semibold text-white/70">Date</span>
              <input
                type="date"
                value={draft.date}
                onChange={e => setDraft(prev => ({ ...prev, date: e.target.value }))}
                className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/50"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-white/70">Start</span>
              <input
                type="time"
                value={draft.start_time}
                onChange={e => setDraft(prev => ({ ...prev, start_time: e.target.value }))}
                className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/50"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-white/70">End</span>
              <input
                type="time"
                value={draft.end_time}
                onChange={e => setDraft(prev => ({ ...prev, end_time: e.target.value }))}
                className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/50"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-white/70">Location</span>
            <input
              value={draft.location}
              onChange={e => setDraft(prev => ({ ...prev, location: e.target.value }))}
              placeholder="Optional"
              className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-sky-400/50"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-white/70">Notes</span>
            <textarea
              value={draft.notes}
              onChange={e => setDraft(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Optional"
              rows={3}
              className="mt-1 w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-sky-400/50"
            />
          </label>
        </div>

        {error && <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div>}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-white/60 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void saveEvent()}
            disabled={saving || !draft.title.trim() || !draft.date || !draft.start_time || !draft.end_time}
            className="rounded-full px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #00C8FF, #007CFF)' }}
          >
            {saving ? 'Saving...' : 'Save Event'}
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}
