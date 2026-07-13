'use client'

/**
 * SearchHistoryPanel — plain-language search history.
 *
 * Simple time buckets everyone understands: Today, Yesterday, This Week,
 * Last Week, This Month, then older by month. One level deep — tap a bucket to
 * open it, tap a search to run it again. Dark-glass ARIA styling.
 */

import { useEffect, useMemo, useState, useCallback } from 'react'
import { ChevronRight, Clock, Search, RefreshCw } from 'lucide-react'

interface HistoryItem {
  id: string
  query: string
  imported_count?: number | null
  created_at: string
}

interface Bucket { key: string; label: string; items: HistoryItem[] }

const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function startOfDay(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }
function timeLabel(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })
}

function bucketize(items: HistoryItem[]): Bucket[] {
  const now = new Date()
  const today = startOfDay(now)
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
  const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - today.getDay()) // Sunday
  const lastWeekStart = new Date(weekStart); lastWeekStart.setDate(lastWeekStart.getDate() - 7)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  // Fixed leading buckets, in order.
  const order: Bucket[] = [
    { key: 'today', label: 'Today', items: [] },
    { key: 'yesterday', label: 'Yesterday', items: [] },
    { key: 'thisweek', label: 'Earlier This Week', items: [] },
    { key: 'lastweek', label: 'Last Week', items: [] },
    { key: 'thismonth', label: 'Earlier This Month', items: [] },
  ]
  const byMonth = new Map<string, Bucket>()

  for (const it of items) {
    const d = new Date(it.created_at)
    if (isNaN(d.getTime())) continue
    const t = d.getTime()
    if (t >= today.getTime()) order[0].items.push(it)
    else if (t >= yesterday.getTime()) order[1].items.push(it)
    else if (t >= weekStart.getTime()) order[2].items.push(it)
    else if (t >= lastWeekStart.getTime()) order[3].items.push(it)
    else if (t >= monthStart.getTime()) order[4].items.push(it)
    else {
      const key = `${d.getFullYear()}-${d.getMonth()}`
      let b = byMonth.get(key)
      if (!b) { b = { key, label: `${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`, items: [] }; byMonth.set(key, b) }
      b.items.push(it)
    }
  }

  return [...order, ...Array.from(byMonth.values())].filter(b => b.items.length > 0)
}

export function SearchHistoryPanel({ onPick }: { onPick: (query: string) => void }) {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<Set<string>>(new Set(['today', 'yesterday', 'thisweek']))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/aria/history?limit=400')
      const d = await r.json()
      setItems(Array.isArray(d.items) ? d.items : [])
    } catch { setItems([]) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const buckets = useMemo(() => bucketize(items), [items])
  const toggle = (k: string) =>
    setOpen(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n })

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-1 pb-3 mb-1 border-b border-white/10">
        <Clock size={13} className="text-[#6B7EFF]" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-300">Search History</span>
        <span className="text-[10px] font-semibold text-slate-500">{items.length}</span>
        <button onClick={load} className="ml-auto text-slate-500 hover:text-[#6B7EFF] transition-colors" aria-label="Refresh history">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 -mr-1">
        {loading && items.length === 0 && (
          <p className="text-[11px] text-slate-500 px-2 py-4">Loading…</p>
        )}
        {!loading && buckets.length === 0 && (
          <div className="flex flex-col items-center gap-2 text-slate-500 py-10 text-center px-4">
            <Search size={22} className="opacity-30" />
            <p className="text-[11px] font-medium">No searches yet. Run an ARIA search and it shows up here.</p>
          </div>
        )}

        {buckets.map(b => {
          const isOpen = open.has(b.key)
          return (
            <div key={b.key} className="mb-1">
              <button
                onClick={() => toggle(b.key)}
                className="w-full flex items-center gap-1.5 px-2 py-2 rounded-lg hover:bg-[#131B2E] transition-colors group"
              >
                <ChevronRight size={12} className={`shrink-0 text-slate-500 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`} />
                <span className="text-[12px] font-bold text-slate-100 group-hover:text-[#6B7EFF]">{b.label}</span>
                <span className="ml-auto text-[10px] font-semibold text-slate-500">{b.items.length}</span>
              </button>

              {isOpen && (
                <div className="ml-3 pl-1.5 border-l border-white/5">
                  {b.items.map(it => (
                    <button
                      key={it.id}
                      onClick={() => onPick(it.query)}
                      className="w-full text-left px-2.5 py-2 rounded-lg mb-0.5 hover:bg-[#131B2E] border border-transparent hover:border-white/10 transition-all group"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-slate-200 truncate flex-1 group-hover:text-[#6B7EFF]">
                          {it.query}
                        </span>
                        {!!it.imported_count && it.imported_count > 0 && (
                          <span className="shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-400/10 text-emerald-300 border border-emerald-400/30">
                            {it.imported_count} lead{it.imported_count > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-slate-500">{timeLabel(it.created_at)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
