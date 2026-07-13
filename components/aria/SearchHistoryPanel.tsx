'use client'

/**
 * SearchHistoryPanel — date-grouped ARIA search history browser.
 *
 * Groups the current user's searches Month → Week (Sun–Sat) → Day, collapsible,
 * for quick reference of every site/area searched. Dark-glass ARIA styling so it
 * flows with the rest of the intelligence surface. Click a search to re-run it.
 */

import { useEffect, useMemo, useState, useCallback } from 'react'
import { ChevronRight, Clock, Search, RefreshCw } from 'lucide-react'

interface HistoryItem {
  id: string
  query: string
  query_interpretation?: string | null
  imported_count?: number | null
  search_type?: string | null
  created_at: string
}

interface DayGroup { key: string; label: string; items: HistoryItem[] }
interface WeekGroup { key: string; label: string; count: number; days: DayGroup[] }
interface MonthGroup { key: string; label: string; count: number; weeks: WeekGroup[] }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - x.getDay()) // back to Sunday
  return x
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function buildTree(items: HistoryItem[]): MonthGroup[] {
  const months = new Map<string, MonthGroup>()

  for (const it of items) {
    const d = new Date(it.created_at)
    if (isNaN(d.getTime())) continue

    const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const mLabel = `${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`
    let m = months.get(mKey)
    if (!m) { m = { key: mKey, label: mLabel, count: 0, weeks: [] }; months.set(mKey, m) }
    m.count++

    const ws = startOfWeek(d)
    const we = new Date(ws); we.setDate(we.getDate() + 6)
    const wKey = ymd(ws)
    const wLabel =
      ws.getMonth() === we.getMonth()
        ? `${MONTHS[ws.getMonth()]} ${ws.getDate()}–${we.getDate()}`
        : `${MONTHS[ws.getMonth()]} ${ws.getDate()} – ${MONTHS[we.getMonth()]} ${we.getDate()}`
    let w = m.weeks.find(x => x.key === wKey)
    if (!w) { w = { key: wKey, label: wLabel, count: 0, days: [] }; m.weeks.push(w) }
    w.count++

    const dKey = ymd(d)
    const dLabel = `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`
    let day = w.days.find(x => x.key === dKey)
    if (!day) { day = { key: dKey, label: dLabel, items: [] }; w.days.push(day) }
    day.items.push(it)
  }

  return Array.from(months.values())
}

export function SearchHistoryPanel({ onPick }: { onPick: (query: string) => void }) {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/aria/history?limit=400')
      const d = await r.json()
      setItems(Array.isArray(d.items) ? d.items : [])
    } catch { setItems([]) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const tree = useMemo(() => buildTree(items), [items])

  // Auto-expand the most recent month + week + day on first load.
  useEffect(() => {
    if (tree.length === 0) return
    const first = tree[0]
    const seed = new Set<string>([`m:${first.key}`])
    if (first.weeks[0]) {
      seed.add(`w:${first.weeks[0].key}`)
      if (first.weeks[0].days[0]) seed.add(`d:${first.weeks[0].days[0].key}`)
    }
    setExpanded(seed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length])

  const toggle = (k: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n })

  const Chevron = ({ open }: { open: boolean }) => (
    <ChevronRight
      size={12}
      className={`shrink-0 text-slate-500 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
    />
  )

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-1 pb-3 mb-1 border-b border-white/10">
        <Clock size={13} className="text-[#6B7EFF]" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-300">Search History</span>
        <span className="text-[10px] font-semibold text-slate-500">{items.length}</span>
        <button
          onClick={load}
          className="ml-auto text-slate-500 hover:text-[#6B7EFF] transition-colors"
          aria-label="Refresh history"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 -mr-1">
        {loading && items.length === 0 && (
          <p className="text-[11px] text-slate-500 px-2 py-4">Loading history…</p>
        )}
        {!loading && tree.length === 0 && (
          <div className="flex flex-col items-center gap-2 text-slate-500 py-10 text-center px-4">
            <Search size={22} className="opacity-30" />
            <p className="text-[11px] font-medium">No searches yet. Run an ARIA search and it appears here.</p>
          </div>
        )}

        {tree.map(month => {
          const mOpen = expanded.has(`m:${month.key}`)
          return (
            <div key={month.key} className="mb-1">
              <button
                onClick={() => toggle(`m:${month.key}`)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-[#131B2E] transition-colors group"
              >
                <Chevron open={mOpen} />
                <span className="text-[12px] font-bold text-slate-100 group-hover:text-[#6B7EFF]">{month.label}</span>
                <span className="ml-auto text-[10px] font-semibold text-slate-500">{month.count}</span>
              </button>

              {mOpen && month.weeks.map(week => {
                const wOpen = expanded.has(`w:${week.key}`)
                return (
                  <div key={week.key} className="ml-3 border-l border-white/5 pl-1.5">
                    <button
                      onClick={() => toggle(`w:${week.key}`)}
                      className="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-[#131B2E] transition-colors group"
                    >
                      <Chevron open={wOpen} />
                      <span className="text-[11px] font-semibold text-slate-300 group-hover:text-slate-100">Week of {week.label}</span>
                      <span className="ml-auto text-[9px] font-semibold text-slate-600">{week.count}</span>
                    </button>

                    {wOpen && week.days.map(day => {
                      const dOpen = expanded.has(`d:${day.key}`)
                      return (
                        <div key={day.key} className="ml-3 border-l border-white/5 pl-1.5">
                          <button
                            onClick={() => toggle(`d:${day.key}`)}
                            className="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-[#131B2E] transition-colors group"
                          >
                            <Chevron open={dOpen} />
                            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 group-hover:text-slate-200">{day.label}</span>
                            <span className="ml-auto text-[9px] font-semibold text-slate-600">{day.items.length}</span>
                          </button>

                          {dOpen && (
                            <div className="ml-4 pl-1.5 border-l border-white/5">
                              {day.items.map(it => (
                                <button
                                  key={it.id}
                                  onClick={() => onPick(it.query)}
                                  className="w-full text-left px-2 py-1.5 rounded-lg mb-0.5 hover:bg-[#131B2E] border border-transparent hover:border-white/10 transition-all group"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] font-semibold text-slate-300 truncate flex-1 group-hover:text-[#6B7EFF]">
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
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
