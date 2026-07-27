'use client'

// Movable "How-To" window (#73) — a floating, draggable help panel you can keep
// open ON TOP of any Nexus screen while you follow the steps, so you never lose
// your place. Reads the same platform how-tos as the Help surface
// (/api/kb/articles?category=Platform How-To). Position is remembered.
import { useEffect, useRef, useState } from 'react'

type Article = { id: string; title: string; description: string | null; content: string | null; category: string }

const POS_KEY = 'gg_howto_pos'

async function loadHowTos(): Promise<Article[]> {
  try {
    const res = await fetch('/api/kb/articles?category=' + encodeURIComponent('Platform How-To'), { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      const list = Array.isArray(data.articles) ? data.articles : Array.isArray(data) ? data : []
      if (list.length) return list as Article[]
    }
  } catch { /* fall through */ }
  return [
    { id: 'p1', title: 'Getting around Nexus', description: 'Tabs + the Ask bar.', content: 'Use the bottom tabs to move around. Type a place in the Ask bar — like "dispatch" or "money" — to jump there.', category: 'Platform How-To' },
  ]
}

export function HowToWindow() {
  const [open, setOpen] = useState(false)
  const [articles, setArticles] = useState<Article[]>([])
  const [loaded, setLoaded] = useState(false)
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const dragRef = useRef<{ dx: number; dy: number } | null>(null)

  // Restore last position (or default to bottom-right).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(POS_KEY)
      if (saved) { setPos(JSON.parse(saved)); return }
    } catch { /* ignore */ }
    if (typeof window !== 'undefined') setPos({ x: Math.max(12, window.innerWidth - 372), y: Math.max(12, window.innerHeight - 520) })
  }, [])

  useEffect(() => {
    if (open && !loaded) loadHowTos().then(a => { setArticles(a); setLoaded(true) })
  }, [open, loaded])

  // Pointer drag (works for mouse + touch).
  function onPointerDown(e: React.PointerEvent) {
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return
    const x = Math.min(Math.max(4, e.clientX - dragRef.current.dx), window.innerWidth - 80)
    const y = Math.min(Math.max(4, e.clientY - dragRef.current.dy), window.innerHeight - 60)
    setPos({ x, y })
  }
  function onPointerUp() {
    if (dragRef.current) { try { localStorage.setItem(POS_KEY, JSON.stringify(pos)) } catch { /* ignore */ } }
    dragRef.current = null
  }

  const filtered = q.trim()
    ? articles.filter(a => `${a.title} ${a.description ?? ''} ${a.content ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))
    : articles

  // Launcher button (when closed).
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} aria-label="Open how-to help"
        className="fixed z-[60] flex items-center gap-1.5 rounded-full px-3.5 py-2.5 text-sm font-semibold"
        style={{ right: 16, bottom: 'calc(86px + env(safe-area-inset-bottom))', background: 'linear-gradient(135deg, rgba(0,124,255,0.9), rgba(0,200,255,0.7))', color: 'white', boxShadow: '0 6px 24px rgba(0,124,255,0.4)', border: '1px solid rgba(255,255,255,0.2)' }}>
        ? <span className="hidden sm:inline">How-to</span>
      </button>
    )
  }

  return (
    <div className="fixed z-[60] flex w-[min(360px,calc(100vw-16px))] flex-col rounded-2xl"
      style={{ left: pos.x, top: pos.y, maxHeight: 'min(70vh, 560px)', background: 'linear-gradient(180deg, rgba(10,20,38,0.98), rgba(4,10,24,0.98))', border: '1px solid rgba(0,200,255,0.28)', boxShadow: '0 24px 70px rgba(0,0,0,0.6), 0 0 40px rgba(0,124,255,0.16)', backdropFilter: 'blur(20px)' }}>
      {/* Drag handle / header */}
      <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        className="flex cursor-move items-center justify-between gap-2 rounded-t-2xl px-3 py-2.5 select-none"
        style={{ background: 'rgba(0,124,255,0.14)', borderBottom: '1px solid rgba(0,200,255,0.18)', touchAction: 'none' }}>
        <span className="text-xs font-semibold" style={{ color: '#7DE5FF' }}>⠿ How-To · drag me anywhere</span>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>✕</button>
      </div>

      <div className="p-3">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search how-tos…"
          className="w-full rounded-lg px-3 py-2 text-sm outline-none"
          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)' }} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3" style={{ WebkitOverflowScrolling: 'touch' }}>
        {!loaded ? <div className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Loading…</div>
          : filtered.length === 0 ? <div className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>No how-tos match “{q}”.</div>
          : (
            <div className="space-y-1.5">
              {filtered.map(a => {
                const isOpen = openId === a.id
                return (
                  <div key={a.id} className="rounded-lg" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <button type="button" onClick={() => setOpenId(isOpen ? null : a.id)} className="flex w-full items-start justify-between gap-2 px-3 py-2 text-left">
                      <span>
                        <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{a.title}</span>
                        {a.description && !isOpen && <span className="mt-0.5 block text-[11px]" style={{ color: 'rgba(255,255,255,0.45)' }}>{a.description}</span>}
                      </span>
                      <span className="text-[11px]" style={{ color: '#7DE5FF' }}>{isOpen ? '−' : '+'}</span>
                    </button>
                    {isOpen && a.content && (
                      <div className="whitespace-pre-line px-3 pb-3 text-[12.5px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>{a.content}</div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
      </div>
    </div>
  )
}
