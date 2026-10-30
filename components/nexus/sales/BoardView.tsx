'use client'

/** Sales board · Board view (drag between stages; Won / Lost / Archive drop zones) + Forecast view. */
import { useState } from 'react'
import { STAGES, fmtDate, initials, money, nextChip, type Deal } from './salesShared'

function Card({ d, sel, dragging, onOpen, onDragStart, onDragEnd, showMoney, showCompany }: {
  d: Deal; sel: boolean; dragging: boolean; onOpen: () => void; onDragStart: (e: React.DragEvent) => void; onDragEnd: () => void; showMoney: boolean; showCompany?: boolean
}) {
  const nx = nextChip(d)
  return (
    <button type="button" draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onOpen}
      className={`sb-card${d.stalled ? ' rot' : ''}${sel ? ' sel' : ''}${dragging ? ' drag' : ''}`}
      aria-label={`${d.name}, ${d.stage_label}${d.stalled ? ', stalled' : ''}`}>
      <span className="sb-ct">{d.name}</span>
      {(d.account || d.units) && <span className="sb-ca">{[d.account, d.units ? `${d.units.toLocaleString()} units` : null].filter(Boolean).join(' · ')}</span>}
      {showMoney && d.mrr != null && <span className="sb-money"><b>{money(d.mrr)}/mo</b><span>· {money(d.tcv)} TCV</span></span>}
      {showMoney && d.mrr == null && d.tcv != null && <span className="sb-money"><b>{money(d.tcv)}</b><span>total</span></span>}
      <span className={`sb-act ${nx.cls}`}>{nx.cls === 'late' ? '⚠ ' : nx.cls === 'none' ? '! ' : ''}{nx.text}</span>
      <span className="sb-cf">
        <span className="sb-av" title={d.owner_name ?? 'No rep assigned'} style={d.owner_name ? undefined : { background: '#C7C7CC' }}>{d.owner_name ? initials(d.owner_name) : '?'}</span>
        {showCompany && <span className="sb-co" title={d.dealer_name ?? ''}>{d.dealer_name ?? '—'}</span>}
        <span>{d.close_date ? `Close ${fmtDate(d.close_date)}` : 'No close date'}</span>
        <span style={{ flex: 1 }} />
        <span className={d.stalled ? 'sb-days r' : 'sb-days'}>{d.days_in_stage}d in stage</span>
      </span>
    </button>
  )
}

export function BoardView({ deals, selectedId, showMoney, showCompany, onOpen, onMove, onQuickAdd }: {
  deals: Deal[]; selectedId: string | null; showMoney: boolean; showCompany?: boolean
  onOpen: (id: string) => void
  onMove: (d: Deal, to: string) => void
  onQuickAdd: (stage: string, name: string) => Promise<void>
}) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [addingIn, setAddingIn] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const dragged = deals.find(d => d.id === dragId) ?? null

  const zone = (key: string) => ({
    onDragOver: (e: React.DragEvent) => { if (dragId) { e.preventDefault(); setOver(key) } },
    onDragLeave: () => setOver(o => (o === key ? null : o)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      const id = e.dataTransfer.getData('text/plain') || dragId
      const d = deals.find(x => x.id === id)
      setDragId(null); setOver(null)
      if (d && d.stage !== key) onMove(d, key)
    },
  })

  return (
    <>
      <div className="sb-cols">
        {STAGES.map(s => {
          const items = deals.filter(d => d.stage === s.key)
          const total = items.reduce((n, d) => n + (d.tcv ?? 0), 0)
          const weighted = items.reduce((n, d) => n + (d.weighted ?? 0), 0)
          return (
            <section key={s.key} aria-label={s.label} className={`sb-col${over === s.key ? ' over' : ''}`} {...zone(s.key)}>
              <div className="sb-ch">
                <div className="t">{s.label}<span className="n">{items.length}</span><span style={{ flex: 1 }} /><span className="p">{s.prob}%</span></div>
                {showMoney && <div className="m"><b>{money(total)}</b><span>{money(weighted)} weighted</span></div>}
                <div className="sb-prob"><i style={{ width: `${s.prob}%` }} /></div>
              </div>
              {items.map(d => (
                <Card key={d.id} d={d} sel={selectedId === d.id} dragging={dragId === d.id} showMoney={showMoney} showCompany={showCompany} onOpen={() => onOpen(d.id)}
                  onDragStart={e => { e.dataTransfer.setData('text/plain', d.id); e.dataTransfer.effectAllowed = 'move'; setDragId(d.id) }}
                  onDragEnd={() => { setDragId(null); setOver(null) }} />
              ))}
              {items.length === 0 && <span className="sb-sub" style={{ padding: '4px 6px' }}>No deals</span>}
              {addingIn === s.key ? (
                <form onSubmit={async e => { e.preventDefault(); const n = draft.trim(); if (!n) return; await onQuickAdd(s.key, n); setDraft(''); setAddingIn(null) }}>
                  <label className="sb-sr" htmlFor={`sb-add-${s.key}`}>New deal in {s.label}</label>
                  <input id={`sb-add-${s.key}`} autoFocus className="sb-in" placeholder="Deal name — press Enter" value={draft} onChange={e => setDraft(e.target.value)}
                    onBlur={() => { if (!draft.trim()) setAddingIn(null) }} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setAddingIn(null) } }} />
                </form>
              ) : (
                <button type="button" className="sb-add" onClick={() => { setAddingIn(s.key); setDraft('') }}>+ Add deal</button>
              )}
            </section>
          )
        })}
      </div>
      <div className={`sb-drops${dragged ? ' on' : ''}`} aria-hidden={!dragged}>
        <div className={`sb-drop won${over === 'won' ? ' over' : ''}`} {...zone('won')}>✓ Drop to mark Won</div>
        <div className={`sb-drop lost${over === 'lost' ? ' over' : ''}`} {...zone('lost')}>✕ Drop to mark Lost</div>
        <div className={`sb-drop arch${over === 'archive' ? ' over' : ''}`} {...zone('archive')}>Archive</div>
      </div>
    </>
  )
}

/** Forecast · open deals by expected close month. */
export function ForecastView({ deals, showMoney, onOpen }: { deals: Deal[]; showMoney: boolean; onOpen: (id: string) => void }) {
  const groups = new Map<string, Deal[]>()
  for (const d of deals) {
    const k = d.close_date ? d.close_date.slice(0, 7) : 'none'
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(d)
  }
  const nowKey = new Date().toISOString().slice(0, 7)
  const keys = [...groups.keys()].sort((a, b) => (a === 'none' ? 1 : b === 'none' ? -1 : a.localeCompare(b)))
  if (!keys.length) return <div className="sb-empty">No open deals.</div>
  return (
    <div className="sb-cols" style={{ gridTemplateColumns: `repeat(${keys.length}, minmax(240px, 1fr))` }}>
      {keys.map(k => {
        const items = groups.get(k)!.sort((a, b) => (b.tcv ?? 0) - (a.tcv ?? 0))
        const label = k === 'none' ? 'No close date' : new Date(`${k}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
        return (
          <section key={k} className="sb-col" aria-label={label}>
            <div className="sb-ch">
              <div className="t">{label}{k !== 'none' && k < nowKey && <span className="sb-pill late">Past due</span>}<span className="n">{items.length}</span></div>
              {showMoney && <div className="m"><b>{money(items.reduce((n, d) => n + (d.tcv ?? 0), 0))}</b><span>{money(items.reduce((n, d) => n + (d.weighted ?? 0), 0))} weighted</span></div>}
            </div>
            {items.map(d => (
              <button key={d.id} type="button" className="sb-card" onClick={() => onOpen(d.id)}>
                <span className="sb-ct">{d.name}</span>
                <span className="sb-money">{showMoney && <b>{money(d.tcv)}</b>}<span>{d.stage_label} · {d.probability}%</span></span>
                <span className="sb-cf"><span className="sb-av">{initials(d.owner_name)}</span><span>{d.close_date ? fmtDate(d.close_date) : '—'}</span></span>
              </button>
            ))}
          </section>
        )
      })}
    </div>
  )
}
