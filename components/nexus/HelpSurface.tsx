'use client'
import { useEffect, useMemo, useState } from 'react'
import { Search, ChevronDown } from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { BookOpen } = require('lucide-react') as any

type Article = {
  id: string
  title: string
  description: string | null
  content: string | null
  category: string
}

const glassPanel = { backgroundColor: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' }
const textPrimary = { color: 'rgba(255,255,255,0.9)' }
const textSecondary = { color: 'rgba(255,255,255,0.5)' }
const textFaint = { color: 'rgba(255,255,255,0.34)' }
const brandCyan = '#00C8FF'

// Reads the platform how-tos seeded in kb_articles (category "Platform How-To").
async function loadHowTos(): Promise<Article[]> {
  try {
    const res = await fetch('/api/kb/articles?category=' + encodeURIComponent('Platform How-To'), { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      const list = Array.isArray(data.articles) ? data.articles : Array.isArray(data) ? data : []
      if (list.length) return list as Article[]
    }
  } catch {
    /* fall through to preview */
  }
  return [
    { id: 'p1', title: 'Getting Around Nexus', description: 'The tabs, the Ask bar, and quick words that jump you anywhere.', content: 'Open the bottom tabs to move around. Type a place in the Ask bar — like "dispatch" or "money" — to jump there. Type "help" to open this page.', category: 'Platform How-To' },
  ]
}

export function HelpSurface() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => { loadHowTos().then(a => { setArticles(a); setLoading(false) }) }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return articles
    return articles.filter(a =>
      a.title.toLowerCase().includes(q) ||
      (a.description ?? '').toLowerCase().includes(q) ||
      (a.content ?? '').toLowerCase().includes(q)
    )
  }, [articles, query])

  return (
    <section className="mt-9 w-full max-w-3xl">
      <div className="rounded-[2rem] p-5 sm:p-6" style={{ background: 'radial-gradient(circle at 12% 0%, rgba(0,200,255,0.13), transparent 34%), linear-gradient(180deg, rgba(8,18,34,0.78), rgba(3,9,22,0.72))', border: '1px solid rgba(0,200,255,0.16)', boxShadow: '0 28px 90px rgba(0,0,0,0.38), 0 0 46px rgba(0,124,255,0.09), inset 0 1px 0 rgba(255,255,255,0.07)', backdropFilter: 'blur(26px)' }}>
        {/* Header */}
        <div className="mb-5">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em]" style={{ color: 'rgba(0,200,255,0.82)' }}>
            <BookOpen size={13} /> Help Center
          </div>
          <h2 className="mt-1 text-xl font-semibold leading-tight" style={{ color: 'rgba(255,255,255,0.97)', textShadow: '0 0 18px rgba(0,124,255,0.22)' }}>How do I…?</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed" style={textSecondary}>Simple step-by-step answers for everything in Nexus. Search a question or browse below.</p>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl mb-4" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(0,200,255,0.22)' }}>
          <Search size={16} style={textSecondary} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search help… (e.g. send a quote, assign a tech, connect email)"
            className="bg-transparent border-none outline-none text-sm w-full placeholder:text-white/30"
            style={textPrimary}
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="p-8 text-center text-sm" style={textSecondary}>Loading help…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm" style={textSecondary}>No answers match that yet. Try different words, or ask Nexus directly.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map(a => {
              const open = openId === a.id
              return (
                <div key={a.id} className="rounded-2xl overflow-hidden" style={glassPanel}>
                  <button
                    onClick={() => setOpenId(open ? null : a.id)}
                    className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-white/5 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate" style={textPrimary}>{a.title}</div>
                      {a.description && <div className="text-xs mt-0.5 truncate" style={textSecondary}>{a.description}</div>}
                    </div>
                    <ChevronDown size={18} style={{ ...textFaint, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </button>
                  {open && (
                    <div className="px-4 pb-4 pt-1 text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'rgba(255,255,255,0.78)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      {a.content || 'No details yet.'}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-5 text-[11px]" style={textFaint}>
          Can&apos;t find it? Type your question in the <span style={{ color: brandCyan }}>Ask Nexus anything</span> bar and Nexus will help.
        </div>
      </div>
    </section>
  )
}
