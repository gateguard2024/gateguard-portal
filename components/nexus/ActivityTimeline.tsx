'use client'

// Unified activity timeline (#59) — one chronological feed of notes, calls,
// emails, meetings, tasks, site events, work orders, and quotes for a record.
// Self-fetching glass component: <ActivityTimeline entity="opportunity" id={id} />
import { useEffect, useState } from 'react'

interface Item { id: string; kind: string; title: string; detail: string | null; actor: string | null; at: string | null; status?: string | null }

const KIND_META: Record<string, { icon: string; color: string }> = {
  call:       { icon: '📞', color: '#0E7490' },
  email:      { icon: '✉️', color: '#0071E3' },
  meeting:    { icon: '👥', color: '#0071E3' },
  task:       { icon: '☑️', color: '#B25000' },
  note:       { icon: '📝', color: '#6E6E73' },
  event:      { icon: '⚡', color: '#0E7490' },
  work_order: { icon: '🔧', color: '#248A3D' },
  quote:      { icon: '🧾', color: '#0071E3' },
}
const metaFor = (k: string) => KIND_META[k] ?? { icon: '•', color: '#6E6E73' }

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

// `reloadKey` — bump it from the parent to force a refetch. This is a
// self-fetching component keyed only on entity/id/limit, so when you post a new
// note or call right next to it, nothing here changed and the feed never
// updated — the activity WAS saved, it just never showed, which reads as
// "can't add activity." Pass a counter that increments on each save.
export function ActivityTimeline({ entity, id, limit = 40, title = 'Activity', reloadKey = 0 }: { entity: 'opportunity' | 'site' | 'lead'; id?: string; limit?: number; title?: string; reloadKey?: number }) {
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
  }, [entity, id, limit, reloadKey])

  const card = { background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 14, padding: 18 } as const
  const sub = { fontSize: 12.5, color: '#6E6E73' } as const

  return (
    <div style={card}>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#1D1D1F', marginBottom: 12 }}>{title}</div>
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
                    <span style={{ width: 28, height: 28, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, background: '#FFFFFF', border: `1px solid ${m.color}55` }}>{m.icon}</span>
                    {!last && <span style={{ flex: 1, width: 1.5, background: '#E5E5EA', minHeight: 14 }} />}
                  </div>
                  {/* body */}
                  <div style={{ paddingBottom: last ? 0 : 14, flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: '#1D1D1F' }}>{it.title}</span>
                      <span style={{ fontSize: 11, color: '#8E8E93', whiteSpace: 'nowrap' }}>{timeAgo(it.at)}</span>
                    </div>
                    {it.detail && <div style={{ fontSize: 12.5, color: '#6E6E73', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{it.detail}</div>}
                    <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                      {it.status && <span style={{ fontSize: 10.5, textTransform: 'capitalize', color: m.color }}>{String(it.status).replace(/_/g, ' ')}</span>}
                      {it.actor && <span style={{ fontSize: 10.5, color: '#8E8E93' }}>· {it.actor}</span>}
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
