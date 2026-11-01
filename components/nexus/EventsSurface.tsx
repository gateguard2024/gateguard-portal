'use client'
/**
 * Events — plan property launches, apartment association shows, home shows and
 * office presentations step by step.
 *   List: KPI tiles (filter), search + type chips, Board / List / Calendar.
 *   New event: pick a ready-made plan (checklist, order list, emails, day-of
 *   schedule — all dated back from the event day), then the details.
 *   Event page: components/nexus/events/EventPage.tsx (deep link ?event=<id>).
 * Data: /api/events, /api/events/templates.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { EventPage } from '@/components/nexus/events/EventPage'
import {
  BOOTH_TYPES, BRAND, EV_CSS, EVENT_TYPES, GREEN, MUTED, ORANGE, RED, STATUS_COLOR, STATUS_LABEL, TYPE_LABEL,
  countdown, daysUntil, fmtDate, fmtTime, money, todayISO,
  type EventRow, type TemplateRow,
} from '@/components/nexus/events/shared'

type View = 'board' | 'list' | 'calendar'
type Kpi = 'upcoming' | 'month' | 'attention' | 'planning' | null
interface SiteOpt { id: string; name: string; city?: string | null; state?: string | null }
interface OppOpt { id: string; name: string; site_id?: string | null; stage?: string | null }

const BUCKETS = [
  { key: 'plan', label: 'Planning & promoting', statuses: ['planning', 'promoting'], color: BRAND },
  { key: 'ready', label: 'Confirmed', statuses: ['confirmed'], color: '#5E5CE6' },
  { key: 'wrap', label: 'Held & follow-up', statuses: ['held', 'follow_up', 'complete'], color: GREEN },
  { key: 'hold', label: 'On hold / cancelled', statuses: ['delayed', 'cancelled'], color: ORANGE },
]
const active = (e: EventRow) => e.status !== 'complete' && e.status !== 'cancelled'

export function EventsSurface() {
  const [events, setEvents] = useState<EventRow[]>([])
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [type, setType] = useState<string>('all')
  const [kpi, setKpi] = useState<Kpi>(null)
  const [view, setView] = useState<View>(() => { try { return (localStorage.getItem('gg_events_view') as View) || 'board' } catch { return 'board' } })
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState<{ templateId?: string } | null>(null)
  const [plansOpen, setPlansOpen] = useState(false)

  const load = useCallback(async () => {
    setErr(null)
    try {
      const r = await fetch('/api/events', { cache: 'no-store' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) setErr(j.error || 'Couldn’t load events.')
      setEvents(Array.isArray(j.events) ? j.events : [])
    } catch { setErr('Couldn’t load events.') }
    setLoading(false)
  }, [])
  const loadTemplates = useCallback(async () => {
    try { const j = await fetch('/api/events/templates', { cache: 'no-store' }).then(r => r.json()); setTemplates(Array.isArray(j.templates) ? j.templates : []) } catch { /* ignore */ }
  }, [])
  useEffect(() => { void load(); void loadTemplates() }, [load, loadTemplates])
  useEffect(() => { try { localStorage.setItem('gg_events_view', view) } catch { /* ignore */ } }, [view])

  // Deep link: /?tab=events&event=<id>; the URL follows the open event.
  useEffect(() => { try { const id = new URLSearchParams(window.location.search).get('event'); if (id) setOpenId(id) } catch { /* ignore */ } }, [])
  useEffect(() => {
    try {
      const u = new URL(window.location.href)
      if (openId) u.searchParams.set('event', openId); else u.searchParams.delete('event')
      window.history.replaceState(null, '', u.toString())
    } catch { /* ignore */ }
  }, [openId])

  const k = useMemo(() => {
    const t = todayISO(), ym = t.slice(0, 7)
    let upcoming = 0, month = 0, attention = 0, planning = 0, budget = 0, spent = 0
    for (const e of events) {
      const d = daysUntil(e.event_date)
      if (active(e) && d != null && d >= 0 && d <= 60) upcoming++
      if (e.event_date?.startsWith(ym)) month++
      if (active(e) && (e.stats?.late ?? 0) > 0) attention++
      if (e.status === 'planning' || e.status === 'promoting') planning++
      if (e.event_date?.slice(0, 4) === t.slice(0, 4)) { budget += Number(e.budget) || 0; spent += Number(e.actual_cost ?? e.stats?.spent) || 0 }
    }
    return { upcoming, month, attention, planning, budget, spent }
  }, [events])

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase(), t = todayISO()
    return events.filter(e => {
      if (type !== 'all' && e.event_type !== type) return false
      if (kpi === 'upcoming') { const d = daysUntil(e.event_date); if (!(active(e) && d != null && d >= 0 && d <= 60)) return false }
      if (kpi === 'month' && !e.event_date?.startsWith(t.slice(0, 7))) return false
      if (kpi === 'attention' && !(active(e) && (e.stats?.late ?? 0) > 0)) return false
      if (kpi === 'planning' && !(e.status === 'planning' || e.status === 'promoting')) return false
      if (s && ![e.title, e.property_name, e.venue, e.host_name, TYPE_LABEL[e.event_type]].some(v => String(v ?? '').toLowerCase().includes(s))) return false
      return true
    })
  }, [events, q, type, kpi])

  const typesInUse = useMemo(() => EVENT_TYPES.filter(t => events.some(e => e.event_type === t.id)), [events])

  return (
    <section className="ev">
      <style>{EV_CSS}</style>
      <div className="ev-hd">
        <div>
          <h1>Events</h1>
          <div className="sub">Property launches, shows and presentations — planned step by step.</div>
        </div>
        <div className="ev-acts">
          <button className="ev-b dark" onClick={() => setPlansOpen(true)}>Plans</button>
          <button className="ev-b pri" onClick={() => setCreating({})}>+ New event</button>
        </div>
      </div>

      <div className="ev-kpis">
        <KpiTile on={kpi === 'upcoming'} onClick={() => setKpi(kpi === 'upcoming' ? null : 'upcoming')} label="Next 60 days" value={k.upcoming} sub="coming up" dot={BRAND} />
        <KpiTile on={kpi === 'month'} onClick={() => setKpi(kpi === 'month' ? null : 'month')} label="This month" value={k.month} sub={new Date().toLocaleDateString('en-US', { month: 'long' })} dot="#5E5CE6" />
        <KpiTile on={kpi === 'attention'} onClick={() => setKpi(kpi === 'attention' ? null : 'attention')} label="Needs attention" value={k.attention} sub="have late steps" dot={k.attention ? RED : GREEN} />
        <KpiTile on={kpi === 'planning'} onClick={() => setKpi(kpi === 'planning' ? null : 'planning')} label="In planning" value={k.planning} sub="planning or promoting" dot={ORANGE} />
        <div className="ev-kpi" style={{ cursor: 'default' }}>
          <div className="l"><span className="ev-dot" style={{ background: '#eb6834' }} />Spent this year</div>
          <div className="v">{money(k.spent)}</div>
          <div className="s">of {money(k.budget)} budgeted</div>
        </div>
      </div>

      <div className="ev-card">
        <div className="ev-bar">
          <input className="ev-in" style={{ flex: '1 1 220px' }} placeholder="Search events, properties, venues…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search events" />
          <div className="ev-seg" role="group" aria-label="View">
            {(['board', 'list', 'calendar'] as View[]).map(v => <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>{v[0].toUpperCase() + v.slice(1)}</button>)}
          </div>
        </div>
        {typesInUse.length > 1 && (
          <div className="ev-chips">
            <button className="ev-chip" aria-pressed={type === 'all'} onClick={() => setType('all')}>All types</button>
            {typesInUse.map(t => <button key={t.id} className="ev-chip" aria-pressed={type === t.id} onClick={() => setType(t.id)}>{t.label}</button>)}
          </div>
        )}
        {err && <div className="ev-msg err" style={{ margin: 14 }}>{err}</div>}
        {loading ? <div className="ev-empty">Loading events…</div>
          : !events.length ? <StartFromPlan templates={templates} onPick={id => setCreating({ templateId: id })} />
          : !shown.length ? <div className="ev-empty">No events match. <button className="ev-b line sm" onClick={() => { setQ(''); setType('all'); setKpi(null) }}>Clear filters</button></div>
          : view === 'board' ? <Board events={shown} onOpen={setOpenId} />
          : view === 'list' ? <List events={shown} onOpen={setOpenId} />
          : <MonthCal events={shown} onOpen={setOpenId} />}
      </div>

      {creating && <CreateEvent templates={templates} initialTemplate={creating.templateId} onClose={() => setCreating(null)} onCreated={id => { setCreating(null); void load(); setOpenId(id) }} />}
      {plansOpen && <PlansManager templates={templates} onClose={() => setPlansOpen(false)} onChanged={loadTemplates} onUse={id => { setPlansOpen(false); setCreating({ templateId: id }) }} />}
      {openId && <EventPage eventId={openId} onClose={() => setOpenId(null)} onChanged={() => { void load(); void loadTemplates() }} />}
    </section>
  )
}

function KpiTile({ on, onClick, label, value, sub, dot }: { on: boolean; onClick: () => void; label: string; value: number; sub: string; dot: string }) {
  return (
    <button className="ev-kpi" aria-pressed={on} onClick={onClick}>
      <div className="l"><span className="ev-dot" style={{ background: dot }} />{label}</div>
      <div className="v">{value}</div>
      <div className="s">{sub}</div>
    </button>
  )
}

export function StatusTag({ status }: { status: string }) {
  const c = STATUS_COLOR[status] ?? MUTED
  return <span className="ev-tag" style={{ background: `${c}14`, color: c }}><span className="ev-dot" style={{ background: c, width: 6, height: 6 }} />{STATUS_LABEL[status] ?? status}</span>
}

function Tile({ e, onOpen }: { e: EventRow; onOpen: (id: string) => void }) {
  const s = e.stats
  const pct = s && s.total ? Math.round((s.done / s.total) * 100) : 0
  const d = daysUntil(e.event_date)
  return (
    <button className="ev-tile" onClick={() => onOpen(e.id)}>
      <div className="ty">{TYPE_LABEL[e.event_type] ?? e.event_type}</div>
      <div className="ti">{e.title}</div>
      <div className="mt">
        <span style={{ color: d != null && d >= 0 && d <= 7 && active(e) ? ORANGE : undefined, fontWeight: d != null && d >= 0 && d <= 7 ? 600 : 400 }}>{fmtDate(e.event_date)} · {countdown(e.event_date)}</span>
      </div>
      {(e.property_name || e.venue) && <div className="mt" style={{ marginTop: 2 }}>{e.property_name || e.venue}</div>}
      <div className="mt" style={{ marginTop: 6 }}>
        {s && s.total > 0 && <span>{s.done}/{s.total} steps</span>}
        {s && s.invited > 0 && <span>{s.yes} RSVPs</span>}
        {s && s.late > 0 && active(e) && <span style={{ color: RED, fontWeight: 600 }}>{s.late} late</span>}
      </div>
      {s && s.total > 0 && <div className="ev-prog"><i style={{ width: `${pct}%`, background: pct === 100 ? GREEN : BRAND }} /></div>}
    </button>
  )
}

function Board({ events, onOpen }: { events: EventRow[]; onOpen: (id: string) => void }) {
  return (
    <div className="ev-board">
      {BUCKETS.map(b => {
        const list = events.filter(e => b.statuses.includes(e.status)).sort((a, c) => String(a.event_date ?? '9').localeCompare(String(c.event_date ?? '9')))
        return (
          <div key={b.key} className="ev-col">
            <h3><span className="ev-dot" style={{ background: b.color }} />{b.label} <span className="n">{list.length}</span></h3>
            {list.map(e => <Tile key={e.id} e={e} onOpen={onOpen} />)}
            {!list.length && <div className="ev-note" style={{ padding: '6px 4px' }}>Nothing here.</div>}
          </div>
        )
      })}
    </div>
  )
}

function List({ events, onOpen }: { events: EventRow[]; onOpen: (id: string) => void }) {
  const rows = [...events].sort((a, c) => String(a.event_date ?? '9').localeCompare(String(c.event_date ?? '9')))
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="ev-tbl">
        <thead><tr><th>Event</th><th>Date</th><th className="hide-sm">Type</th><th>Status</th><th className="hide-sm">Plan</th><th className="hide-sm">RSVPs</th><th className="hide-sm" style={{ textAlign: 'right' }}>Spent / budget</th></tr></thead>
        <tbody>
          {rows.map(e => {
            const s = e.stats
            return (
              <tr key={e.id} className="click" onClick={() => onOpen(e.id)}>
                <td><div style={{ fontWeight: 600 }}>{e.title}</div><div className="ev-note">{e.property_name || e.venue || ''}</div></td>
                <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(e.event_date)}<div className="ev-note">{countdown(e.event_date)}</div></td>
                <td className="hide-sm">{TYPE_LABEL[e.event_type] ?? e.event_type}</td>
                <td><StatusTag status={e.status} /></td>
                <td className="hide-sm">{s?.total ? <>{s.done}/{s.total}{s.late > 0 && active(e) ? <span style={{ color: RED, fontWeight: 600 }}> · {s.late} late</span> : null}</> : '—'}</td>
                <td className="hide-sm">{s?.invited ? `${s.yes} of ${s.invited}` : '—'}</td>
                <td className="hide-sm" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{money(e.actual_cost ?? s?.spent ?? 0)} / {money(e.budget)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function MonthCal({ events, onOpen }: { events: EventRow[]; onOpen: (id: string) => void }) {
  const [ym, setYm] = useState(() => { const t = todayISO(); return { y: +t.slice(0, 4), m: +t.slice(5, 7) - 1 } })
  const first = new Date(ym.y, ym.m, 1)
  const startDow = first.getDay()
  const daysIn = new Date(ym.y, ym.m + 1, 0).getDate()
  const cells: { iso: string; day: number; out: boolean }[] = []
  const total = Math.ceil((startDow + daysIn) / 7) * 7
  for (let i = 0; i < total; i++) {
    const d = new Date(ym.y, ym.m, 1 - startDow + i)
    cells.push({ iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, day: d.getDate(), out: d.getMonth() !== ym.m })
  }
  const t = todayISO()
  const move = (n: number) => setYm(p => { const d = new Date(p.y, p.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() } })
  const undated = events.filter(e => !e.event_date)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px' }}>
        <button className="ev-b line sm" onClick={() => move(-1)} aria-label="Previous month">‹</button>
        <div style={{ fontWeight: 600, minWidth: 150, textAlign: 'center' }}>{first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
        <button className="ev-b line sm" onClick={() => move(1)} aria-label="Next month">›</button>
        <button className="ev-b line sm" onClick={() => setYm({ y: +t.slice(0, 4), m: +t.slice(5, 7) - 1 })}>Today</button>
      </div>
      <div className="ev-cal">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="dow">{d}</div>)}
        {cells.map(c => (
          <div key={c.iso} className={`cell${c.out ? ' out' : ''}${c.iso === t ? ' today' : ''}`}>
            <div className="d">{c.day}</div>
            {events.filter(e => e.event_date === c.iso).map(e => (
              <button key={e.id} className="pill" onClick={() => onOpen(e.id)} title={e.title}>{e.start_time ? `${fmtTime(e.start_time)} ` : ''}{e.title}</button>
            ))}
          </div>
        ))}
      </div>
      {!!undated.length && <div style={{ padding: '10px 14px' }} className="ev-note">No date yet: {undated.map((e, i) => <span key={e.id}>{i ? ', ' : ''}<button className="ev-b line sm" style={{ margin: '2px 0' }} onClick={() => onOpen(e.id)}>{e.title}</button></span>)}</div>}
    </div>
  )
}

function planCounts(t: TemplateRow) {
  const c = t.counts
  if (!c) return ''
  return [c.tasks && `${c.tasks} steps`, c.supplies && `${c.supplies} items to order`, c.emails && `${c.emails} emails`].filter(Boolean).join(' · ')
}

function StartFromPlan({ templates, onPick }: { templates: TemplateRow[]; onPick: (id?: string) => void }) {
  return (
    <div style={{ padding: 18 }}>
      <div style={{ fontWeight: 600, fontSize: 16 }}>Plan your first event</div>
      <div className="ev-note" style={{ marginBottom: 14 }}>Pick a ready-made plan. Every step, order and email is dated back from your event day — change anything after.</div>
      <div className="ev-plans">
        {templates.map(t => (
          <button key={t.id} className="ev-plan" onClick={() => onPick(t.id)}>
            <div className="n">{t.name}</div>
            {t.description && <div className="d">{t.description}</div>}
            <div className="c">{planCounts(t)}{t.default_budget ? ` · ~${money(t.default_budget)}` : ''}</div>
          </button>
        ))}
        <button className="ev-plan" onClick={() => onPick(undefined)}><div className="n">Blank event</div><div className="d">Start empty and build your own plan.</div></button>
      </div>
    </div>
  )
}

// ── New event ────────────────────────────────────────────────────────────────
function CreateEvent({ templates, initialTemplate, onClose, onCreated }: { templates: TemplateRow[]; initialTemplate?: string; onClose: () => void; onCreated: (id: string) => void }) {
  const [step, setStep] = useState<1 | 2>(initialTemplate !== undefined ? 2 : 1)
  const [tplId, setTplId] = useState<string>(initialTemplate ?? '')
  const tpl = templates.find(t => t.id === tplId)
  const [f, setF] = useState(() => ({
    title: '', event_type: tpl?.event_type ?? 'launch_party', event_date: '', start_time: '', end_time: '',
    venue: '', booth_number: '', property_name: '', site_id: '', opportunity_id: '',
    budget: tpl?.default_budget != null ? String(tpl.default_budget) : '', expected_attendance: '', goal: '',
  }))
  const set = (p: Partial<typeof f>) => setF(x => ({ ...x, ...p }))
  const [src, setSrc] = useState<'site' | 'deal' | 'custom'>('site')
  const [sites, setSites] = useState<SiteOpt[]>([])
  const [opps, setOpps] = useState<OppOpt[]>([])
  const [pq, setPq] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/sites?limit=200', { cache: 'no-store' }).then(r => r.json()).then(j => setSites((j.sites ?? []).map((s: SiteOpt) => ({ id: s.id, name: s.name, city: s.city, state: s.state })))).catch(() => {})
    fetch('/api/crm/opportunities', { cache: 'no-store' }).then(r => r.json()).then(j => setOpps((j.records ?? []).map((o: OppOpt) => ({ id: o.id, name: o.name, site_id: o.site_id, stage: o.stage })))).catch(() => {})
  }, [])

  const choosePlan = (id: string) => {
    setTplId(id)
    const t = templates.find(x => x.id === id)
    set({ event_type: t?.event_type ?? f.event_type, budget: t?.default_budget != null ? String(t.default_budget) : f.budget })
    setStep(2)
  }
  const pList = src === 'site'
    ? sites.filter(s => !pq || s.name.toLowerCase().includes(pq.toLowerCase())).slice(0, 8).map(s => ({ id: s.id, label: s.name, sub: [s.city, s.state].filter(Boolean).join(', ') }))
    : opps.filter(o => !pq || o.name.toLowerCase().includes(pq.toLowerCase())).slice(0, 8).map(o => ({ id: o.id, label: o.name, sub: o.stage ?? '' }))
  const picked = src === 'site' ? sites.find(s => s.id === f.site_id) : src === 'deal' ? opps.find(o => o.id === f.opportunity_id) : null

  const autoTitle = () => {
    const kind = TYPE_LABEL[f.event_type] ?? 'Event'
    return f.property_name ? `${f.property_name} — ${kind}` : tpl?.name ?? kind
  }
  const submit = async () => {
    setBusy(true); setErr(null)
    try {
      const r = await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, title: f.title.trim() || autoTitle(), template_id: tplId || null }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j.event) { setErr(j.error || 'Couldn’t create the event.'); setBusy(false); return }
      onCreated(j.event.id)
    } catch { setErr('Couldn’t create the event.'); setBusy(false) }
  }

  return (
    <div className="ev-mod" role="dialog" aria-modal="true" aria-label="New event" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="box">
        <div className="mh">
          <h2>{step === 1 ? 'New event — pick a plan' : tpl ? `New ${tpl.name}` : 'New event'}</h2>
          <button className="ev-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="mb">
          {step === 1 ? (
            <>
              <div className="ev-note" style={{ marginBottom: 12 }}>A plan fills in the checklist, the order list, the invite emails and the day-of schedule. Dates count back from your event day.</div>
              <div className="ev-plans">
                {templates.map(t => (
                  <button key={t.id} className="ev-plan" aria-pressed={tplId === t.id} onClick={() => choosePlan(t.id)}>
                    <div className="n">{t.name}</div>
                    {t.description && <div className="d">{t.description}</div>}
                    <div className="c">{planCounts(t)}{t.default_budget ? ` · ~${money(t.default_budget)}` : ''}{!t.is_starter ? ' · Your plan' : ''}</div>
                  </button>
                ))}
                <button className="ev-plan" onClick={() => { setTplId(''); setStep(2) }}><div className="n">Blank event</div><div className="d">Start empty.</div></button>
              </div>
            </>
          ) : (
            <>
              {err && <div className="ev-msg err">{err}</div>}
              {tpl && <div className="ev-msg">Using the <b>{tpl.name}</b> plan — {planCounts(tpl)}. <button className="ev-b line sm" style={{ marginLeft: 6 }} onClick={() => setStep(1)}>Change</button></div>}
              <div className="ev-form">
                <div className="full">
                  <label className="ev-lbl">Property or account</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    <div className="ev-seg" role="group" aria-label="Pick from">
                      <button aria-pressed={src === 'site'} onClick={() => setSrc('site')}>Our sites</button>
                      <button aria-pressed={src === 'deal'} onClick={() => setSrc('deal')}>Deals</button>
                      <button aria-pressed={src === 'custom'} onClick={() => setSrc('custom')}>Type it in</button>
                    </div>
                  </div>
                  {src === 'custom' ? (
                    <input className="ev-in" style={{ width: '100%' }} placeholder="e.g. Atlanta Apartment Association, or a property name" value={f.property_name} onChange={e => set({ property_name: e.target.value, site_id: '', opportunity_id: '' })} />
                  ) : picked ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, padding: '8px 12px', borderRadius: 10, background: '#F2F7FF', fontWeight: 500 }}>{picked.name}</div>
                      <button className="ev-b line sm" onClick={() => set(src === 'site' ? { site_id: '', property_name: '' } : { opportunity_id: '', property_name: '' })}>Change</button>
                    </div>
                  ) : (
                    <>
                      <input className="ev-in" style={{ width: '100%' }} placeholder={src === 'site' ? 'Search your sites…' : 'Search deals…'} value={pq} onChange={e => setPq(e.target.value)} />
                      <div style={{ marginTop: 6, maxHeight: 180, overflowY: 'auto' }}>
                        {pList.map(p => (
                          <button key={p.id} className="ev-tile" style={{ marginBottom: 4, padding: '8px 10px' }} onClick={() => {
                            if (src === 'site') set({ site_id: p.id, property_name: p.label })
                            else { const o = opps.find(x => x.id === p.id); set({ opportunity_id: p.id, property_name: p.label, site_id: o?.site_id ?? '' }) }
                          }}>
                            <span style={{ fontWeight: 500 }}>{p.label}</span> {p.sub && <span className="ev-note">· {p.sub}</span>}
                          </button>
                        ))}
                        {!pList.length && <div className="ev-note">Nothing found — use “Type it in”.</div>}
                      </div>
                    </>
                  )}
                </div>
                <div className="full">
                  <label className="ev-lbl">Event name</label>
                  <input className="ev-in" style={{ width: '100%' }} placeholder={autoTitle()} value={f.title} onChange={e => set({ title: e.target.value })} />
                </div>
                <div>
                  <label className="ev-lbl">Type</label>
                  <select className="ev-in" style={{ width: '100%' }} value={f.event_type} onChange={e => set({ event_type: e.target.value })}>
                    {EVENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="ev-lbl">Event date</label>
                  <input className="ev-in" style={{ width: '100%' }} type="date" value={f.event_date} onChange={e => set({ event_date: e.target.value })} />
                </div>
                <div>
                  <label className="ev-lbl">Starts</label>
                  <input className="ev-in" style={{ width: '100%' }} type="time" value={f.start_time} onChange={e => set({ start_time: e.target.value })} />
                </div>
                <div>
                  <label className="ev-lbl">Ends</label>
                  <input className="ev-in" style={{ width: '100%' }} type="time" value={f.end_time} onChange={e => set({ end_time: e.target.value })} />
                </div>
                <div className={BOOTH_TYPES.has(f.event_type) ? '' : 'full'}>
                  <label className="ev-lbl">Venue</label>
                  <input className="ev-in" style={{ width: '100%' }} placeholder="Clubhouse, convention center, their office…" value={f.venue} onChange={e => set({ venue: e.target.value })} />
                </div>
                {BOOTH_TYPES.has(f.event_type) && (
                  <div>
                    <label className="ev-lbl">Booth #</label>
                    <input className="ev-in" style={{ width: '100%' }} value={f.booth_number} onChange={e => set({ booth_number: e.target.value })} />
                  </div>
                )}
                <div>
                  <label className="ev-lbl">Budget</label>
                  <input className="ev-in" style={{ width: '100%' }} inputMode="decimal" placeholder="$" value={f.budget} onChange={e => set({ budget: e.target.value.replace(/[^\d.]/g, '') })} />
                </div>
                <div>
                  <label className="ev-lbl">Expected guests</label>
                  <input className="ev-in" style={{ width: '100%' }} inputMode="numeric" value={f.expected_attendance} onChange={e => set({ expected_attendance: e.target.value.replace(/\D/g, '') })} />
                </div>
                <div className="full">
                  <label className="ev-lbl">Goal</label>
                  <input className="ev-in" style={{ width: '100%' }} placeholder="e.g. 25 property managers, 10 site walks booked" value={f.goal} onChange={e => set({ goal: e.target.value })} />
                </div>
              </div>
              {tpl && !f.event_date && <div className="ev-note" style={{ marginTop: 10, color: ORANGE }}>Add the event date so every step gets its due date.</div>}
            </>
          )}
        </div>
        {step === 2 && (
          <div className="mf">
            <button className="ev-b line" onClick={onClose}>Cancel</button>
            <button className="ev-b pri" disabled={busy} onClick={submit}>{busy ? 'Creating…' : 'Create event'}</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Plans (templates) ────────────────────────────────────────────────────────
function PlansManager({ templates, onClose, onChanged, onUse }: { templates: TemplateRow[]; onClose: () => void; onChanged: () => Promise<void> | void; onUse: (id: string) => void }) {
  const [edit, setEdit] = useState<{ id: string; name: string; event_type: string; description: string; default_budget: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const save = async () => {
    if (!edit?.name.trim()) return
    setBusy(true); setErr(null)
    const r = await fetch('/api/events/templates', { method: edit.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(edit.id ? edit : { ...edit, id: undefined }) }).catch(() => null)
    const j = r ? await r.json().catch(() => ({})) : {}
    setBusy(false)
    if (!r?.ok) { setErr(j.error || 'Couldn’t save the plan.'); return }
    setEdit(null); await onChanged()
  }
  const remove = async (t: TemplateRow) => {
    if (!window.confirm(`Delete the “${t.name}” plan? Events already made from it keep their steps.`)) return
    const r = await fetch(`/api/events/templates?id=${t.id}`, { method: 'DELETE' }).catch(() => null)
    if (!r?.ok) { const j = r ? await r.json().catch(() => ({})) : {}; setErr(j.error || 'Couldn’t delete.'); return }
    await onChanged()
  }
  return (
    <div className="ev-mod" role="dialog" aria-modal="true" aria-label="Event plans" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="box">
        <div className="mh"><h2>Event plans</h2><button className="ev-x" onClick={onClose} aria-label="Close">×</button></div>
        <div className="mb">
          <div className="ev-note" style={{ marginBottom: 12 }}>Plans are reusable checklists, order lists, emails and day-of schedules. To make your own, set up an event the way you like it and choose <b>Save as plan</b> on the event page.</div>
          {err && <div className="ev-msg err">{err}</div>}
          {edit && (
            <div className="ev-card" style={{ padding: 14, marginBottom: 14, boxShadow: 'none', border: '1px solid rgba(0,0,0,.12)' }}>
              <div className="ev-form">
                <div className="full"><label className="ev-lbl">Name</label><input className="ev-in" style={{ width: '100%' }} value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} /></div>
                <div><label className="ev-lbl">Type</label><select className="ev-in" style={{ width: '100%' }} value={edit.event_type} onChange={e => setEdit({ ...edit, event_type: e.target.value })}>{EVENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
                <div><label className="ev-lbl">Typical budget</label><input className="ev-in" style={{ width: '100%' }} value={edit.default_budget} onChange={e => setEdit({ ...edit, default_budget: e.target.value.replace(/[^\d.]/g, '') })} /></div>
                <div className="full"><label className="ev-lbl">Description</label><input className="ev-in" style={{ width: '100%' }} value={edit.description} onChange={e => setEdit({ ...edit, description: e.target.value })} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                <button className="ev-b line sm" onClick={() => setEdit(null)}>Cancel</button>
                <button className="ev-b pri sm" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
              </div>
            </div>
          )}
          <table className="ev-tbl">
            <thead><tr><th>Plan</th><th className="hide-sm">What’s in it</th><th /></tr></thead>
            <tbody>
              {templates.map(t => (
                <tr key={t.id}>
                  <td><div style={{ fontWeight: 600 }}>{t.name}</div><div className="ev-note">{TYPE_LABEL[t.event_type] ?? t.event_type}{t.is_starter ? ' · Gate Guard plan' : ' · Your plan'}</div></td>
                  <td className="hide-sm ev-note">{planCounts(t) || 'Empty'}{t.default_budget ? ` · ~${money(t.default_budget)}` : ''}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="ev-b pri sm" onClick={() => onUse(t.id)}>Use</button>{' '}
                    <button className="ev-b line sm" onClick={() => setEdit({ id: t.id, name: t.name, event_type: t.event_type, description: t.description ?? '', default_budget: t.default_budget != null ? String(t.default_budget) : '' })}>Edit</button>
                    {!t.is_starter && <> <button className="ev-b red sm" onClick={() => remove(t)}>Delete</button></>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
