'use client'

/**
 * SearchHistoryPanel — dead-simple recent searches, like a phone's recent calls.
 * Flat list, newest first, "how long ago", tap to re-open. No buckets, no
 * chevrons to expand — you just see what you searched and tap it.
 */

import { useEffect, useState, useCallback } from 'react'
import { Search, Clock, RefreshCw, ChevronRight } from 'lucide-react'

interface HistoryItem {
  id: string
  query: string
  imported_count?: number | null
  created_at: string
}

function ago(iso: string): string {
  const d = new Date(iso)
  const mins = Math.floor((Date.now() - d.getTime()) / 60000)
  if (isNaN(mins)) return ''
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function pretty(q: string): string {
  const s = (q || '').trim()
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Search'
}

export function SearchHistoryPanel({ onPick }: { onPick: (query: string) => void }) {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/aria/history?limit=200')
      const d = await r.json()
      setItems(Array.isArray(d.items) ? d.items : [])
    } catch { setItems([]) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-1 pb-3 mb-1 border-b border-white/10">
        <Clock size={13} className="text-[#6B7EFF]" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-300">Recent searches</span>
        <span className="text-[10px] font-semibold text-slate-500">{items.length}</span>
        <button onClick={load} className="ml-auto text-slate-500 hover:text-[#6B7EFF] transition-colors" aria-label="Refresh">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 -mr-1">
        {loading && items.length === 0 && (
          <p className="text-[11px] text-slate-500 px-2 py-4">Loading…</p>
        )}
        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center gap-2 text-slate-500 py-10 text-center px-4">
            <Search size={22} className="opacity-30" />
            <p className="text-[12px] font-medium">Nothing here yet.</p>
            <p className="text-[11px]">Your searches show up here. Tap one to open it again.</p>
          </div>
        )}

        {items.map(it => (
          <button
            key={it.id}
            onClick={() => onPick(it.query)}
            className="w-full text-left flex items-center gap-3 px-3 py-3 rounded-xl mb-1 hover:bg-[#131B2E] border border-transparent hover:border-white/10 transition-all group"
          >
            <span className="shrink-0 w-8 h-8 rounded-full bg-[#0F1830] border border-white/10 flex items-center justify-center">
              <Search size={13} className="text-slate-400 group-hover:text-[#6B7EFF]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-slate-100 truncate group-hover:text-[#6B7EFF]">{pretty(it.query)}</span>
              <span className="block text-[11px] text-slate-500">
                {ago(it.created_at)}
                {!!it.imported_count && it.imported_count > 0 && <span className="text-emerald-400 font-semibold"> · {it.imported_count} lead{it.imported_count > 1 ? 's' : ''}</span>}
              </span>
            </span>
            <ChevronRight size={15} className="shrink-0 text-slate-600 group-hover:text-[#6B7EFF]" />
          </button>
        ))}
      </div>
    </div>
  )
}
