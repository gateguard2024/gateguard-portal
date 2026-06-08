'use client'

import { useEffect, useState } from 'react'

type Bucket = 'today' | 'blocked' | 'bugs' | 'next_up'

type TrackerItem = {
  id: string
  title: string
  body: string | null
  priority: string
  status: string
  due_date: string | null
  linked_type: string | null
  linked_label: string | null
  assigned_to_name: string | null
  created_by_name: string | null
  bucket: Bucket
  urgency: 'high' | 'medium' | 'low'
}

const buckets: Bucket[] = ['today', 'blocked', 'bugs', 'next_up']

function label(bucket: Bucket) {
  if (bucket === 'today') return 'Today'
  if (bucket === 'blocked') return 'Blocked'
  if (bucket === 'bugs') return 'Bugs'
  return 'Next Up'
}

function color(bucket: Bucket) {
  if (bucket === 'blocked') return '#F87171'
  if (bucket === 'bugs') return '#FBBF24'
  if (bucket === 'today') return '#00C8FF'
  return '#8B5CF6'
}

export function InternalTrackerBoard() {
  const [items, setItems] = useState<TrackerItem[]>([])
  const [bucket, setBucket] = useState<Bucket>('today')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/nexus/internal/tracker')
        const data = await res.json().catch(() => ({}))
        if (!res.ok || data.success === false) throw new Error(data?.message ?? 'Could not load tracker.')
        const next = Array.isArray(data.items) ? data.items as TrackerItem[] : []
        setItems(next)
        if (next.length === 0) setMessage('No tracker items yet. Add todos for bugs, blocked items, and next work.')
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Could not load tracker.')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const shown = items.filter(item => item.bucket === bucket)
  const selected = items.find(item => item.id === selectedId) ?? null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {buckets.map(nextBucket => {
          const c = color(nextBucket)
          const count = items.filter(item => item.bucket === nextBucket).length
          const active = bucket === nextBucket
          return (
            <button key={nextBucket} type="button" onClick={() => { setBucket(nextBucket); setSelectedId(null) }} className="rounded-2xl px-3 py-3 text-left" style={{ background: active ? `${c}1f` : 'rgba(0,0,0,0.18)', border: active ? `1px solid ${c}66` : '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: c }}>{label(nextBucket)}</div>
              <div className="mt-1 text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>{count}</div>
            </button>
          )
        })}
      </div>

      {loading && <div className="rounded-2xl p-4 text-xs" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.48)' }}>Loading tracker…</div>}
      {message && <div className="rounded-2xl p-4 text-xs" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.48)' }}>{message}</div>}
      {!loading && shown.length === 0 && !message && <div className="rounded-2xl p-4 text-xs" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.48)' }}>No {label(bucket).toLowerCase()} items right now.</div>}

      <div className="space-y-2">
        {shown.map(item => {
          const c = color(item.bucket)
          const active = selectedId === item.id
          return (
            <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className="w-full rounded-2xl px-3 py-3 text-left" style={{ background: active ? `${c}1f` : 'rgba(0,0,0,0.18)', border: active ? `1px solid ${c}66` : '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{item.title}</div>
                  <div className="mt-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.48)' }}>{item.linked_label || item.linked_type || item.assigned_to_name || 'Internal tracker item'}</div>
                  <div className="mt-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.34)' }}>{item.due_date ? `Due ${item.due_date}` : item.status}</div>
                </div>
                <div className="rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]" style={{ background: `${c}1f`, border: `1px solid ${c}44`, color: c }}>{item.priority}</div>
              </div>
            </button>
          )
        })}
      </div>

      {selected && (
        <div className="rounded-3xl p-4" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.18)' }}>
          <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: '#ddd6fe' }}>Selected Tracker Item</div>
          <div className="mt-1 text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>{selected.title}</div>
          {selected.body && <div className="mt-2 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.54)' }}>{selected.body}</div>}
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-2xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}><div className="text-[9px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.34)' }}>Status</div><div className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.78)' }}>{selected.status}</div></div>
            <div className="rounded-2xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}><div className="text-[9px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.34)' }}>Priority</div><div className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.78)' }}>{selected.priority}</div></div>
            <div className="rounded-2xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}><div className="text-[9px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.34)' }}>Due</div><div className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.78)' }}>{selected.due_date || 'No date'}</div></div>
          </div>
        </div>
      )}
    </div>
  )
}
