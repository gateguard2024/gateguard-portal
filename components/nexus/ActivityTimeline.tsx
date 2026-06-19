'use client'

// Unified activity timeline (#59) — one chronological feed of notes, calls,
// emails, meetings, tasks, site events, work orders, and quotes for a record.
// Self-fetching glass component: <ActivityTimeline entity="opportunity" id={id} />
import { useEffect, useState } from 'react'

interface Item { id: string; kind: string; title: string; detail: string | null; actor: string | null; at: string | null; status?: string | null }

const KIND_META: Record<string, { icon: string; color: string }> = {
  call:       { icon: '📞', color: '#0ea5b7' },
  email:      { icon: '✉️', color: '#6B7EFF' },
  meeting:    { icon: '👥', color: '#a855f7' },
  task:       { icon: '☑️', color: '#f59e0b' },
  note:       { icon: '📝', color: '#94a3b8' },
  event:      { icon: '⚡', color: '#22d3ee' },
  work_order: { icon: '🔧', color: '#34d399' },
  quote:      { icon: '🧾', color: '#7DE5FF' },
}
const metaFor = (k: string) => KIND_META[k] ?? { icon: '•', color: '#94a3b8' }

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso).getTime()
  if (isNaN(d)) return ''
  const s = Math.floor((Date.now() - d) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 2592000) return `${Math.floor(s / 86400)}d ago`
  return new Date(iso).toLocaleDateString()
}

export function ActivityTimeline({ entity, id, limit = 40, title = 'Activity' }: { entity: 'opportunity' | 'site' | 'lead'; id?: string; limit?: number; title?: string }) {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) { setLoading(false); return }
    let live = true
    setLoading(true)
    void fetch(`/api/activity?entity=${entity}&id=${id}&limit=${limit}`)
      .then(r => r.json()).then(j => { if (live) setItems(j.items ?? []) })
      .catch(() => {}).finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [entity, id, limit])

  const card = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: 18 } as const
  const sub = { fontSize: 12.5, color: 'rgba(255,255,255,0.5)' } as const

  return (
    <div style={card}>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.95)', marginBottom: 12 }}>{title}</div>
      {loading ? <div style={sub}>Loading activity…</div>
        : items.length === 0 ? <div style={sub}>No activity yet. Notes, calls, emails, quotes, and jobs will show here.</div>
        : (
          <div style={{ display: 'grid', gap: 0 }}>
            {items.map((it, i) => {
              const m = metaFor(it.kind)
              const last = i === items.length - 1
              return (
                <div key={it.id} style={{ display: 'flex', gap: 12 }}>
                  {/* rail */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ width: 28, height: 28, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, background: 'rgba(0,0,0,0.3)', border: `1px solid ${m.color}55` }}>{m.icon}</span>
                    {!last && <span style={{ flex: 1, width: 1.5, background: 'rgba(255,255,255,0.1)', minHeight: 14 }} />}
                  </div>
                  {/* body */}
                  <div style={{ paddingBottom: last ? 0 : 14, flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}>{it.title}</span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>{timeAgo(it.at)}</span>
                    </div>
                    {it.detail && <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{it.detail}</div>}
                    <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                      {it.status && <span style={{ fontSize: 10.5, textTransform: 'capitalize', color: m.color }}>{String(it.status).replace(/_/g, ' ')}</span>}
                      {it.actor && <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)' }}>· {it.actor}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
    </div>
  )
}
