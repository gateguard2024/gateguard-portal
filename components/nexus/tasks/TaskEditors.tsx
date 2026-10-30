'use client'

/**
 * Small pop-up editors used by the task panel (design: "Task · How each field edits").
 * Click a value → the editor opens beside it → choosing saves at once. No Save buttons.
 * Every pop-up carries data-tk-pop so Escape closes the pop-up before the panel.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { STATUS, T, addDays, localISO, type Person, type Task, type TaskStatus } from './shared'

const CSS = `
.tkp-pop{position:absolute;z-index:20;top:calc(100% + 4px);left:0;min-width:260px;max-width:min(360px,calc(100vw - 32px));background:#fff;border-radius:12px;box-shadow:0 0 0 1px rgba(0,0,0,.08),0 16px 40px -12px rgba(0,0,0,.35);padding:6px;display:flex;flex-direction:column;gap:2px}
.tkp-pop.right{left:auto;right:0}
.tkp-opt{display:flex;align-items:center;gap:10px;min-height:38px;padding:0 10px;border-radius:8px;font-size:14px;border:0;background:none;width:100%;text-align:left;font-family:inherit;color:${T.ink};cursor:pointer}
.tkp-opt:hover,.tkp-opt:focus-visible,.tkp-opt.hi{background:#F0F6FE;outline:none}
.tkp-opt .chk{margin-left:auto;color:${T.blue}}
.tkp-opt .sub{color:${T.ink3};font-size:12px}
.tkp-srch{font:14px ${'-apple-system,Inter,sans-serif'};min-height:38px;padding:0 10px;border:1px solid ${T.line2};border-radius:8px;width:100%}
.tkp-srch:focus{outline:2px solid ${T.blue};outline-offset:-1px;border-color:transparent}
.tkp-grp{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.03em;color:${T.ink3};padding:8px 10px 2px}
.tkp-sep{border-top:1px solid rgba(0,0,0,.06);margin:4px 0}
.tkp-quick{display:flex;flex-wrap:wrap;gap:6px;padding:6px 4px}
.tkp-quick button{min-height:32px;padding:0 10px;border-radius:8px;border:1px solid ${T.line2};background:#fff;font-family:inherit;font-size:13px;font-weight:600;color:${T.ink};cursor:pointer}
.tkp-note{padding:8px 10px;font-size:13px;color:${T.ink3}}
`

/** Pop-up shell: closes on a click outside it. */
export function Pop({ children, onClose, align = 'left', label }: { children: ReactNode; onClose: () => void; align?: 'left' | 'right'; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const down = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    // Next tick, so the click that opened it doesn't close it.
    const t = setTimeout(() => document.addEventListener('mousedown', down), 0)
    window.addEventListener('keydown', key, true)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', down); window.removeEventListener('keydown', key, true) }
  }, [onClose])
  return (
    <div ref={ref} className={`tkp-pop${align === 'right' ? ' right' : ''}`} role="dialog" aria-label={label} data-tk-pop="">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {children}
    </div>
  )
}

const Check = () => <svg className="chk" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>

export const WAITING_ON: { key: string; label: string }[] = [
  { key: 'parts', label: 'Parts' }, { key: 'customer', label: 'Customer' }, { key: 'task', label: 'Another task' }, { key: 'other', label: 'Other' },
]

export function StatusEditor({ status, waitingOn, onPick, onClose }: { status: TaskStatus; waitingOn: string | null; onPick: (s: TaskStatus, waitingOn?: string | null) => void; onClose: () => void }) {
  return (
    <Pop onClose={onClose} label="Status">
      {STATUS.map(s => (
        <button key={s.key} type="button" className={`tkp-opt${s.key === status ? ' hi' : ''}`} onClick={() => { onPick(s.key, s.key === 'waiting' ? (waitingOn ?? 'parts') : null); if (s.key !== 'waiting') onClose() }}>
          <span className="tk-dot" style={{ background: s.dot }} />{s.label}{s.key === status && <Check />}
        </button>
      ))}
      {status === 'waiting' && (
        <>
          <div className="tkp-sep" />
          <label className="tkp-note" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Waiting on
            <select className="tk-select" value={waitingOn ?? 'parts'} onChange={e => onPick('waiting', e.target.value)}>
              {WAITING_ON.map(w => <option key={w.key} value={w.key}>{w.label}</option>)}
            </select>
          </label>
        </>
      )}
    </Pop>
  )
}

export function OptionsEditor<V extends string>({ label, options, value, onPick, onClose, footer }: { label: string; options: { value: V; label: ReactNode }[]; value: V; onPick: (v: V) => void; onClose: () => void; footer?: ReactNode }) {
  return (
    <Pop onClose={onClose} label={label}>
      {options.map(o => (
        <button key={o.value} type="button" className={`tkp-opt${o.value === value ? ' hi' : ''}`} onClick={() => onPick(o.value)}>
          {o.label}{o.value === value && <Check />}
        </button>
      ))}
      {footer}
    </Pop>
  )
}

/** Owner (single) or watchers (multi). Filters the team list as you type. */
export function PeoplePicker({ people, me, selected, multi, onPick, onClose, label }: {
  people: Person[]; me: string; selected: string[]; multi?: boolean; label: string
  onPick: (p: Person | null) => void; onClose: () => void
}) {
  const [q, setQ] = useState('')
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase()
    return people.filter(p => !n || p.name.toLowerCase().includes(n) || (p.email ?? '').toLowerCase().includes(n)).slice(0, 12)
  }, [people, q])
  const meP = people.find(p => p.id === me)
  return (
    <Pop onClose={onClose} label={label}>
      <label><span className="tk-sr">Search people</span><input autoFocus className="tkp-srch" type="search" placeholder="Search people" value={q} onChange={e => setQ(e.target.value)} /></label>
      <div style={{ maxHeight: 280, overflowY: 'auto' }}>
        {shown.map(p => (
          <button key={p.id} type="button" className={`tkp-opt${selected.includes(p.id) ? ' hi' : ''}`} onClick={() => { onPick(p); if (!multi) onClose() }}>
            <span className="tk-av">{p.initials}</span>{p.name}{p.role && <span className="sub">{p.role}</span>}{selected.includes(p.id) && <Check />}
          </button>
        ))}
        {shown.length === 0 && <div className="tkp-note">No one matches “{q}”.</div>}
      </div>
      {!multi && (
        <>
          <div className="tkp-sep" />
          {meP && <button type="button" className="tkp-opt" onClick={() => { onPick(meP); onClose() }}><span className="tk-av">{meP.initials}</span>Assign to me</button>}
          <button type="button" className="tkp-opt" style={{ color: T.ink3 }} onClick={() => { onPick(null); onClose() }}>Unassigned</button>
        </>
      )}
    </Pop>
  )
}

export function DatesEditor({ start, due, onSave, onClose }: { start: string | null; due: string | null; onSave: (start: string | null, due: string | null) => void; onClose: () => void }) {
  const [s, setS] = useState(start ?? '')
  const [d, setD] = useState(due ?? '')
  const save = (ns: string, nd: string) => { setS(ns); setD(nd); onSave(ns || null, nd || null) }
  const nextMon = () => { const x = new Date(); x.setDate(x.getDate() + ((8 - x.getDay()) % 7 || 7)); return localISO(x) }
  return (
    <Pop onClose={onClose} label="Dates">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 4 }}>
        <label className="tk-sub" style={{ fontSize: 12 }}>Start<input type="date" className="tkp-srch" style={{ marginTop: 4 }} value={s} onChange={e => save(e.target.value, d)} /></label>
        <label className="tk-sub" style={{ fontSize: 12 }}>Due<input type="date" className="tkp-srch" style={{ marginTop: 4 }} value={d} onChange={e => save(s, e.target.value)} /></label>
      </div>
      <div className="tkp-quick">
        <button type="button" onClick={() => save(s, localISO())}>Today</button>
        <button type="button" onClick={() => save(s, addDays(null, 1))}>Tomorrow</button>
        <button type="button" onClick={() => save(s, nextMon())}>Next Mon</button>
        <button type="button" onClick={() => save(s, addDays(d || null, 7))}>+1 week</button>
        <button type="button" onClick={() => save('', '')} style={{ borderColor: 'transparent', color: T.ink3 }}>Clear</button>
      </div>
    </Pop>
  )
}

export type RecordHit = { id: string; label: string; sublabel?: string; type: string }
const REC_GROUP: Record<string, string> = { property: 'Sites', work_order: 'Work orders', customer: 'Customers', opportunity: 'Opportunities', lead: 'Leads', dealer: 'Dealers' }

/** One search across sites, work orders, customers, opportunities, leads and dealers. */
export function RecordSearch({ onPick, onClose }: { onPick: (r: RecordHit) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<RecordHit[]>([])
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return }
    setBusy(true)
    const t = setTimeout(() => {
      fetch(`/api/todos/search-records?q=${encodeURIComponent(q.trim())}`).then(r => r.json())
        .then(d => setHits(d.results ?? [])).catch(() => setHits([])).finally(() => setBusy(false))
    }, 250)
    return () => clearTimeout(t)
  }, [q])
  const groups = Object.keys(REC_GROUP).map(k => ({ k, items: hits.filter(h => h.type === k) })).filter(g => g.items.length)
  return (
    <Pop onClose={onClose} label="Link to a record">
      <label><span className="tk-sr">Search records</span><input autoFocus className="tkp-srch" type="search" placeholder="Search sites, work orders, customers…" value={q} onChange={e => setQ(e.target.value)} /></label>
      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
        {groups.map(g => (
          <div key={g.k}>
            <div className="tkp-grp">{REC_GROUP[g.k]}</div>
            {g.items.map(h => (
              <button key={`${h.type}-${h.id}`} type="button" className="tkp-opt" onClick={() => { onPick(h); onClose() }}>
                {h.label}{h.sublabel && <span className="sub">{h.sublabel}</span>}
              </button>
            ))}
          </div>
        ))}
        {q.trim().length >= 2 && !busy && groups.length === 0 && <div className="tkp-note">Nothing found for “{q}”.</div>}
        {q.trim().length < 2 && <div className="tkp-note">Type at least 2 letters.</div>}
      </div>
    </Pop>
  )
}

/** Pick another task (for "Blocked by"). Searches the tasks already loaded. */
export function TaskSearch({ tasks, exclude, onPick, onClose }: { tasks: Task[]; exclude: string[]; onPick: (t: Task) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase()
    return tasks.filter(t => !exclude.includes(t.id) && t.status !== 'done' && (!n || `${t.key ?? ''} ${t.title}`.toLowerCase().includes(n))).slice(0, 12)
  }, [tasks, exclude, q])
  return (
    <Pop onClose={onClose} label="Blocked by which task?" align="right">
      <label><span className="tk-sr">Search tasks</span><input autoFocus className="tkp-srch" type="search" placeholder="Search tasks or T-number" value={q} onChange={e => setQ(e.target.value)} /></label>
      <div style={{ maxHeight: 280, overflowY: 'auto' }}>
        {shown.map(t => (
          <button key={t.id} type="button" className="tkp-opt" onClick={() => { onPick(t); onClose() }}>
            <span className="sub" style={{ fontFamily: 'ui-monospace,Menlo,monospace' }}>{t.key}</span>{t.title}
          </button>
        ))}
        {shown.length === 0 && <div className="tkp-note">No open tasks match.</div>}
      </div>
    </Pop>
  )
}

/** Tags: type and press Enter to add; click × on a tag to remove it. */
export function TagsEditor({ tags, suggestions, onSave, onClose }: { tags: string[]; suggestions: string[]; onSave: (tags: string[]) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const add = (raw: string) => {
    const t = raw.trim().slice(0, 30)
    if (!t || tags.some(x => x.toLowerCase() === t.toLowerCase())) { setQ(''); return }
    onSave([...tags, t]); setQ('')
  }
  const sugg = suggestions.filter(s => !tags.includes(s) && (!q || s.toLowerCase().includes(q.toLowerCase()))).slice(0, 8)
  return (
    <Pop onClose={onClose} label="Tags">
      <form onSubmit={e => { e.preventDefault(); add(q) }}>
        <label><span className="tk-sr">Add a tag</span><input autoFocus className="tkp-srch" placeholder="Add a tag — press Enter" value={q} onChange={e => setQ(e.target.value)} /></label>
      </form>
      {sugg.map(s => <button key={s} type="button" className="tkp-opt" onClick={() => add(s)}><span className="tk-tag" style={{ background: '#EFEAFB', color: '#5B3BB0' }}>{s}</span></button>)}
    </Pop>
  )
}
