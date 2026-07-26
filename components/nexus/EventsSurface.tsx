'use client'

// EventsSurface — property-events command console (steel cockpit).
// Real data only: /api/events, /api/events/templates, /api/events/[id].
// Create pulls the PROPERTY from existing Sites or Opportunities (or free text),
// clones an editable template's checklist/supplies/campaign, and lands on
// property_events + its child tables. Templates (incl. Property Launch) are
// editable in-place via the Template manager.
import { useCallback, useEffect, useMemo, useState } from 'react'

// ---- Console tokens (identical to Operations / Sales / My Day) ----
const FRAME_STYLE = { background: 'repeating-linear-gradient(90deg,rgba(255,255,255,0.05) 0 1px,transparent 1px 4px), linear-gradient(180deg,#5a6c84,#45556a)', border: '1px solid rgba(10,16,24,0.4)', boxShadow: '0 26px 54px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -2px 2px rgba(0,0,0,0.4)' } as const
const TILE_BG = 'repeating-linear-gradient(90deg,rgba(255,255,255,0.04) 0 1px,transparent 1px 4px), linear-gradient(180deg,#2b3c52,#1e2a3a)'
const TILE_STYLE = { background: TILE_BG, border: '1px solid rgba(140,170,200,0.22)', boxShadow: '0 14px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.14)' } as const
const WELL = 'linear-gradient(180deg,#22303f,#1a2532)'
const INPUT_STYLE = { background: '#16232f', border: '1px solid rgba(140,170,200,0.28)', color: '#eaf2fb' } as const
const MODAL_STYLE = { background: 'linear-gradient(180deg,#1d2a39,#141d28)', border: '1px solid rgba(140,170,200,0.28)', boxShadow: '0 30px 70px rgba(0,0,0,0.6)' } as const

interface EventRow {
  id: string; title: string; event_type: string; status: string; event_date?: string | null
  property_name?: string | null; host_name?: string | null; start_time?: string | null
  expected_attendance?: number | null; budget?: number | null; site_id?: string | null
}
interface TemplateRow { id: string; name: string; event_type: string; description?: string | null; default_budget?: number | null; is_starter?: boolean; org_id?: string | null }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Detail { event: EventRow; checklist: any[]; supplies: any[]; campaign: any[]; guests: any[] }
interface SiteOpt { id: string; name: string; city?: string | null; state?: string | null }
interface OppOpt { id: string; name: string; site_id?: string | null; stage?: string | null }

const EVENT_TYPES = [
  { id: 'lunch_learn', label: 'Lunch & Learn' },
  { id: 'launch_party', label: 'Launch Party' },
  { id: 'meet_greet', label: 'Meet & Greet' },
  { id: 'trade_show', label: 'Trade Show' },
  { id: 'open_house', label: 'Open House' },
  { id: 'other', label: 'Other' },
]
const TYPE_LABEL: Record<string, string> = Object.fromEntries(EVENT_TYPES.map(t => [t.id, t.label]))
const STATUS_LABEL: Record<string, string> = { planning: 'Planning', promoting: 'Promoting', confirmed: 'Confirmed', held: 'Held', follow_up: 'Follow-up', complete: 'Complete', cancelled: 'Cancelled' }
const STAGES = ['Plan', 'Supplies', 'Campaign', 'Checklist', 'Confirm', 'Ops', 'Held', 'Follow-up']
const STATUS_STAGE: Record<string, number> = { planning: 0, promoting: 2, confirmed: 4, held: 6, follow_up: 7, complete: 7 }

// Three swim-lanes for the board.
const BUCKETS: { key: string; label: string; statuses: string[]; accent: string }[] = [
  { key: 'promo', label: 'Planning & Promo', statuses: ['planning', 'promoting'], accent: '#9FD8EC' },
  { key: 'confirmed', label: 'Confirmed', statuses: ['confirmed'], accent: '#5FB8E0' },
  { key: 'wrap', label: 'Held & Wrap-up', statuses: ['held', 'follow_up', 'complete'], accent: '#7ee0a8' },
]

function fmtDate(d?: string | null) { if (!d) return 'No date'; const dt = new Date(`${d}T00:00:00`); return isNaN(dt.getTime()) ? d : dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) }
function money(n?: number | null) { return n == null ? '—' : `$${Math.round(n).toLocaleString()}` }

export function EventsSurface() {
  const [events, setEvents] = useState<EventRow[]>([])
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [tplOpen, setTplOpen] = useState(false)
  const [detail, setDetail] = useState<Detail | null>(null)

  const emptyForm = { title: '', event_type: 'lunch_learn', event_date: '', property_name: '', site_id: '', aria_property_id: '', template_id: '', budget: '' }
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)

  // Property picker source
  const [propTab, setPropTab] = useState<'site' | 'opp' | 'custom'>('site')
  const [sites, setSites] = useState<SiteOpt[]>([])
  const [opps, setOpps] = useState<OppOpt[]>([])
  const [propQuery, setPropQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/events', { cache: 'no-store' }).then(x => x.json())
      setEvents(Array.isArray(r.events) ? r.events : [])
    } catch { setEvents([]) } finally { setLoading(false) }
  }, [])
  const loadTemplates = useCallback(async () => {
    try { const j = await fetch('/api/events/templates', { cache: 'no-store' }).then(r => r.json()); setTemplates(j.templates ?? []) } catch { /* ignore */ }
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => { void loadTemplates() }, [loadTemplates])

  // Lazy-load pickable properties the first time the create modal opens.
  useEffect(() => {
    if (!createOpen || (sites.length || opps.length)) return
    fetch('/api/sites?limit=200', { cache: 'no-store' }).then(r => r.json())
      .then(j => setSites((j.sites ?? []).map((s: SiteOpt) => ({ id: s.id, name: s.name, city: s.city, state: s.state })))).catch(() => {})
    fetch('/api/crm/opportunities', { cache: 'no-store' }).then(r => r.json())
      .then(j => setOpps((j.records ?? []).map((o: OppOpt) => ({ id: o.id, name: o.name, site_id: o.site_id, stage: o.stage })))).catch(() => {})
  }, [createOpen, sites.length, opps.length])

  const kpis = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const thisMonth = today.getMonth(), thisYear = today.getFullYear()
    let upcoming = 0, monthCount = 0, planning = 0, budget = 0
    for (const e of events) {
      const active = e.status !== 'complete' && e.status !== 'cancelled'
      if (e.event_date) {
        const d = new Date(`${e.event_date}T00:00:00`)
        if (!isNaN(d.getTime())) {
          if (d >= today && active) upcoming++
          if (d.getMonth() === thisMonth && d.getFullYear() === thisYear) monthCount++
        }
      }
      if (e.status === 'planning' || e.status === 'promoting') planning++
      if (active) budget += Number(e.budget) || 0
    }
    return { upcoming, monthCount, planning, budget }
  }, [events])

  async function createEvent() {
    if (!form.title.trim()) return
    setBusy(true)
    try {
      await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title, event_type: form.event_type, event_date: form.event_date || null,
          property_name: form.property_name || null, site_id: form.site_id || null,
          aria_property_id: form.aria_property_id || null, template_id: form.template_id || null,
          budget: form.budget ? Number(form.budget) : null,
        }) })
      setCreateOpen(false); setForm(emptyForm); setPropQuery('')
      await load()
    } catch { /* ignore */ } finally { setBusy(false) }
  }

  async function openDetail(id: string) {
    try { const d = await fetch(`/api/events/${id}`).then(r => r.json()); if (d.event) setDetail(d) } catch { /* ignore */ }
  }

  const filteredSites = useMemo(() => {
    const q = propQuery.trim().toLowerCase()
    return (q ? sites.filter(s => `${s.name} ${s.city ?? ''} ${s.state ?? ''}`.toLowerCase().includes(q)) : sites).slice(0, 40)
  }, [sites, propQuery])
  const filteredOpps = useMemo(() => {
    const q = propQuery.trim().toLowerCase()
    return (q ? opps.filter(o => o.name.toLowerCase().includes(q)) : opps).slice(0, 40)
  }, [opps, propQuery])

  return (
    <section className="mt-6 w-full px-3 sm:px-4">
      <div className="mx-auto w-full max-w-5xl xl:max-w-none rounded-[2rem] p-5 sm:p-6" style={FRAME_STYLE}>

        {/* Header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: '#2f4a63' }}>Property Events</div>
            <h2 className="text-xl font-semibold leading-tight" style={{ color: '#152535' }}>Events</h2>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setTplOpen(true)} className="rounded-xl px-3 py-2 text-[12px] font-semibold" style={{ background: '#22303f', border: '1px solid rgba(95,184,224,0.28)', color: '#9FD8EC' }}>▤ Templates</button>
            <button type="button" onClick={() => setCreateOpen(true)} className="rounded-xl px-3.5 py-2 text-[12px] font-semibold" style={{ background: '#26374a', border: '1px solid rgba(140,170,200,0.25)', color: '#cfe0f0' }}>＋ New Event</button>
          </div>
        </div>

        {/* KPI row */}
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi glyph="📅" value={kpis.upcoming} label="Upcoming" sub="scheduled, not held" />
          <Kpi glyph="🗓" value={kpis.monthCount} label="This month" sub="events dated this month" />
          <Kpi glyph="✎" value={kpis.planning} label="In planning" sub="planning or promoting" />
          <Kpi glyph="＄" value={money(kpis.budget)} label="Active budget" sub="open events" />
        </div>

        {/* Board */}
        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: '#98abbd' }}>Loading events…</div>
        ) : events.length === 0 ? (
          <div className="rounded-2xl py-16 text-center" style={{ background: WELL, border: '1px solid rgba(140,170,200,0.18)' }}>
            <div className="text-sm" style={{ color: '#cfe0f0' }}>No events yet.</div>
            <div className="mt-1 text-xs" style={{ color: '#7f96ab' }}>Create one from a template — lunch &amp; learn, launch party, trade show, and more come pre-loaded.</div>
            <button onClick={() => setCreateOpen(true)} className="mt-4 rounded-xl px-4 py-2 text-xs font-semibold" style={{ background: '#26374a', border: '1px solid rgba(140,170,200,0.25)', color: '#cfe0f0' }}>＋ New Event</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {BUCKETS.map(b => {
              const rows = events.filter(e => b.statuses.includes(e.status))
              return (
                <div key={b.key} className="rounded-2xl p-3" style={{ background: WELL, border: '1px solid rgba(140,170,200,0.18)' }}>
                  <div className="mb-2.5 flex items-center justify-between">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: b.accent }}>{b.label}</div>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(20,32,44,0.6)', border: `1px solid ${b.accent}55`, color: b.accent }}>{rows.length}</span>
                  </div>
                  {rows.length === 0 ? (
                    <div className="rounded-xl px-3 py-6 text-center text-[11px]" style={{ color: '#6f8397' }}>Nothing here yet</div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {rows.map(e => {
                        const stage = STATUS_STAGE[e.status] ?? 0
                        return (
                          <button key={e.id} onClick={() => openDetail(e.id)} className="rounded-xl p-3 text-left transition-transform hover:-translate-y-0.5" style={TILE_STYLE}>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#9FD8EC' }}>{TYPE_LABEL[e.event_type] ?? e.event_type}</span>
                              <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase" style={{ background: 'rgba(20,32,44,0.6)', border: '1px solid rgba(95,184,224,0.3)', color: '#bfe6ff' }}>{STATUS_LABEL[e.status] ?? e.status}</span>
                            </div>
                            <div className="mt-1.5 text-[13.5px] font-bold" style={{ color: '#eaf2fb' }}>{e.title}</div>
                            <div className="mt-0.5 text-[11px]" style={{ color: '#98abbd' }}>{e.property_name || 'No property'} · {fmtDate(e.event_date)}</div>
                            <div className="mt-2.5 flex h-1.5 overflow-hidden rounded-full" style={{ background: 'rgba(10,16,24,0.55)' }}>
                              <div style={{ width: `${((stage + 1) / STAGES.length) * 100}%`, background: 'linear-gradient(90deg,#2f7fb8,#5FB8E0)' }} />
                            </div>
                            <div className="mt-1 flex items-center justify-between text-[10px]" style={{ color: '#7f96ab' }}>
                              <span>{STAGES[stage]}</span>
                              <span>{e.budget != null ? money(e.budget) : `host ${e.host_name || '—'}`}</span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create modal */}
      {createOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setCreateOpen(false)}>
          <div className="max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-3xl p-5" style={MODAL_STYLE} onClick={e => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: '#5FB8E0' }}>Property Events</div>
                <div className="text-lg font-bold" style={{ color: '#eaf2fb' }}>New event</div>
              </div>
              <button onClick={() => setCreateOpen(false)} className="rounded-full px-2 py-1 text-xs" style={{ color: '#98abbd' }}>Close</button>
            </div>

            <div className="flex flex-col gap-3 text-sm">
              {/* Template picker */}
              <div>
                <div className="mb-1 text-[11px]" style={{ color: '#98abbd' }}>Start from a template</div>
                <div className="grid grid-cols-1 gap-1.5">
                  {templates.map(t => (
                    <button key={t.id} onClick={() => setForm(f => ({ ...f, template_id: f.template_id === t.id ? '' : t.id, event_type: t.event_type, title: f.title || t.name, budget: t.default_budget ? String(t.default_budget) : f.budget }))} className="rounded-xl px-3 py-2 text-left transition-all" style={{ background: form.template_id === t.id ? 'rgba(95,184,224,0.16)' : '#16232f', border: `1px solid ${form.template_id === t.id ? 'rgba(95,184,224,0.5)' : 'rgba(140,170,200,0.18)'}` }}>
                      <div className="flex items-center gap-2">
                        <div className="text-[12.5px] font-semibold" style={{ color: '#eaf2fb' }}>{t.name}</div>
                        {t.is_starter && <span className="rounded-full px-1.5 py-0.5 text-[8.5px] font-bold uppercase" style={{ background: 'rgba(126,224,168,0.14)', color: '#7ee0a8' }}>Starter</span>}
                      </div>
                      {t.description && <div className="text-[10.5px]" style={{ color: '#8ba0b4' }}>{t.description}</div>}
                    </button>
                  ))}
                  <div className="text-[10px]" style={{ color: '#6f8397' }}>Or leave blank for a scratch event.</div>
                </div>
              </div>

              {/* Property picker */}
              <div>
                <div className="mb-1 text-[11px]" style={{ color: '#98abbd' }}>Property</div>
                <div className="mb-2 inline-flex rounded-xl p-0.5" style={{ background: '#16232f', border: '1px solid rgba(140,170,200,0.18)' }}>
                  {([['site', 'Sites'], ['opp', 'Opportunities'], ['custom', 'Custom']] as const).map(([k, lbl]) => (
                    <button key={k} onClick={() => setPropTab(k)} className="rounded-lg px-3 py-1 text-[11px] font-semibold" style={{ background: propTab === k ? 'rgba(95,184,224,0.2)' : 'transparent', color: propTab === k ? '#bfe6ff' : '#8ba0b4' }}>{lbl}</button>
                  ))}
                </div>
                {form.property_name && (
                  <div className="mb-2 flex items-center justify-between rounded-xl px-3 py-2" style={{ background: 'rgba(95,184,224,0.12)', border: '1px solid rgba(95,184,224,0.4)' }}>
                    <span className="text-[12px] font-semibold" style={{ color: '#eaf2fb' }}>{form.property_name}{form.site_id ? '  · linked to site' : ''}</span>
                    <button onClick={() => setForm(f => ({ ...f, property_name: '', site_id: '', aria_property_id: '' }))} className="text-[11px]" style={{ color: '#9FD8EC' }}>Change</button>
                  </div>
                )}
                {propTab !== 'custom' ? (
                  <>
                    <input value={propQuery} onChange={e => setPropQuery(e.target.value)} placeholder={propTab === 'site' ? 'Search your sites…' : 'Search opportunities…'} className="mb-1.5 w-full rounded-xl px-3 py-2 text-sm outline-none" style={INPUT_STYLE} />
                    <div className="max-h-40 overflow-y-auto rounded-xl" style={{ background: '#16232f', border: '1px solid rgba(140,170,200,0.18)' }}>
                      {propTab === 'site' ? (
                        filteredSites.length === 0 ? <div className="px-3 py-3 text-[11px]" style={{ color: '#6f8397' }}>No sites match.</div> :
                        filteredSites.map(s => (
                          <button key={s.id} onClick={() => setForm(f => ({ ...f, property_name: s.name, site_id: s.id, aria_property_id: '' }))} className="block w-full px-3 py-2 text-left text-[12px] hover:bg-white/5" style={{ color: '#d6e2ee', borderBottom: '1px solid rgba(140,170,200,0.08)' }}>
                            {s.name}{(s.city || s.state) && <span className="text-[10px]" style={{ color: '#7f96ab' }}> · {[s.city, s.state].filter(Boolean).join(', ')}</span>}
                          </button>
                        ))
                      ) : (
                        filteredOpps.length === 0 ? <div className="px-3 py-3 text-[11px]" style={{ color: '#6f8397' }}>No opportunities match.</div> :
                        filteredOpps.map(o => (
                          <button key={o.id} onClick={() => setForm(f => ({ ...f, property_name: o.name, site_id: o.site_id || '', aria_property_id: '' }))} className="block w-full px-3 py-2 text-left text-[12px] hover:bg-white/5" style={{ color: '#d6e2ee', borderBottom: '1px solid rgba(140,170,200,0.08)' }}>
                            {o.name}{o.stage && <span className="text-[10px]" style={{ color: '#7f96ab' }}> · {o.stage}</span>}
                          </button>
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  <input value={form.property_name} onChange={e => setForm({ ...form, property_name: e.target.value, site_id: '' })} placeholder="Property / venue name" className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={INPUT_STYLE} />
                )}
              </div>

              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Event title" className="rounded-xl px-3 py-2 text-sm outline-none" style={INPUT_STYLE} />
              <div className="grid grid-cols-2 gap-2">
                <select value={form.event_type} onChange={e => setForm({ ...form, event_type: e.target.value })} className="rounded-xl px-3 py-2 text-sm outline-none" style={INPUT_STYLE}>
                  {EVENT_TYPES.map(t => <option key={t.id} value={t.id} className="bg-neutral-900">{t.label}</option>)}
                </select>
                <input type="date" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} className="rounded-xl px-3 py-2 text-sm outline-none" style={INPUT_STYLE} />
              </div>
              <input value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value.replace(/[^\d.]/g, '') })} inputMode="decimal" placeholder="Budget (optional)" className="rounded-xl px-3 py-2 text-sm outline-none" style={INPUT_STYLE} />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setCreateOpen(false)} className="rounded-xl px-3 py-2 text-xs" style={{ color: '#98abbd' }}>Cancel</button>
              <button onClick={createEvent} disabled={busy || !form.title.trim()} className="rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-40" style={{ background: '#26374a', border: '1px solid rgba(140,170,200,0.3)', color: '#cfe0f0' }}>{busy ? 'Creating…' : 'Create event'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Template manager */}
      {tplOpen && <TemplateManager templates={templates} onClose={() => setTplOpen(false)} onChanged={loadTemplates} />}

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setDetail(null)}>
          <div className="max-h-[86dvh] w-full max-w-2xl overflow-y-auto rounded-3xl p-5" style={MODAL_STYLE} onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#5FB8E0' }}>{TYPE_LABEL[detail.event.event_type] ?? detail.event.event_type}</div>
                <div className="text-lg font-extrabold" style={{ color: '#eaf2fb' }}>{detail.event.title}</div>
                <div className="text-xs" style={{ color: '#98abbd' }}>{detail.event.property_name || 'No property'} · {fmtDate(detail.event.event_date)}{detail.event.budget != null ? ` · ${money(detail.event.budget)}` : ''}</div>
              </div>
              <button onClick={() => setDetail(null)} className="rounded-full px-2 py-1 text-xs" style={{ color: '#98abbd' }}>Close</button>
            </div>
            {/* stepper */}
            <div className="relative my-4">
              <div className="absolute left-2 right-2 top-2.5 h-0.5" style={{ background: 'rgba(140,170,200,0.18)' }} />
              <div className="relative flex justify-between">
                {STAGES.map((st, i) => {
                  const cur = STATUS_STAGE[detail.event.status] ?? 0
                  const done = i <= cur
                  return (
                    <div key={st} className="flex w-[12.5%] flex-col items-center gap-1">
                      <span className="h-3.5 w-3.5 rounded-full" style={{ background: done ? '#2f7fb8' : '#16232f', border: `2px solid ${done ? '#5FB8E0' : '#3a4b5c'}` }} />
                      <span className="text-center text-[9px]" style={{ color: done ? '#bfe6ff' : '#6f8397' }}>{st}</span>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailList title="Pre-event checklist" empty="No checklist yet" items={detail.checklist.map(c => ({ main: c.title, sub: `${c.category ?? ''}${c.due_date ? ' · ' + fmtDate(c.due_date) : ''}` }))} />
              <DetailList title="Email campaign" empty="No campaign steps" items={detail.campaign.map(c => ({ main: (c.step || '').replace(/_/g, ' '), sub: `${c.status ?? ''}${c.send_at ? ' · ' + fmtDate(c.send_at) : ''}` }))} />
              <DetailList title="Supplies & materials" empty="No supplies" items={detail.supplies.map(s => ({ main: s.item, sub: `${s.status ?? ''}${s.vendor ? ' · ' + s.vendor : ''}` }))} />
              <DetailList title="Guests" empty="No guests yet" items={detail.guests.map(g => ({ main: g.name || g.email || 'Guest', sub: g.rsvp ?? '' }))} />
            </div>
            <div className="mt-3 text-[10px]" style={{ color: '#6f8397' }}>Actions (check off tasks, send campaign steps, RSVP → lead) come in the next build stage.</div>
          </div>
        </div>
      )}
    </section>
  )
}

function Kpi({ glyph, value, label, sub }: { glyph: string; value: string | number; label: string; sub?: string }) {
  return (
    <div className="rounded-2xl p-3.5" style={TILE_STYLE}>
      <div className="text-[15px]" aria-hidden style={{ color: '#9FD8EC' }}>{glyph}</div>
      <div className="mt-0.5 text-[24px] font-extrabold leading-none" style={{ color: '#eaf2fb' }}>{value}</div>
      <div className="mt-0.5 text-[10px]" style={{ color: '#98abbd' }}>{label}</div>
      {sub && <div className="mt-1 text-[9px]" style={{ color: '#7f96ab' }}>{sub}</div>}
    </div>
  )
}

function DetailList({ title, items, empty }: { title: string; items: { main: string; sub: string }[]; empty: string }) {
  return (
    <div className="rounded-2xl p-3" style={{ background: '#16232f', border: '1px solid rgba(140,170,200,0.18)' }}>
      <div className="mb-2 text-[11px] font-bold" style={{ color: '#9FD8EC' }}>{title}</div>
      {items.length === 0 ? <div className="text-[11px]" style={{ color: '#6f8397' }}>{empty}</div> : (
        <div className="flex flex-col gap-1.5">
          {items.map((it, i) => (
            <div key={i} className="text-[12px]">
              <span className="capitalize" style={{ color: '#e2ebf4' }}>{it.main}</span>
              {it.sub && <span className="text-[10px] capitalize" style={{ color: '#7f96ab' }}> · {it.sub}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Template manager: create / edit editable templates (org-owned). Starters
// (org_id null) are edit-locked unless the caller is corporate — the API enforces it. ----
function TemplateManager({ templates, onClose, onChanged }: { templates: TemplateRow[]; onClose: () => void; onChanged: () => Promise<void> | void }) {
  const blank = { id: '', name: '', event_type: 'launch_party', description: '', default_budget: '' }
  const [draft, setDraft] = useState(blank)
  const [busy, setBusy] = useState(false)
  const editing = !!draft.id

  function edit(t: TemplateRow) {
    setDraft({ id: t.id, name: t.name, event_type: t.event_type, description: t.description ?? '', default_budget: t.default_budget != null ? String(t.default_budget) : '' })
  }
  async function save() {
    if (!draft.name.trim()) return
    setBusy(true)
    try {
      const payload = { name: draft.name.trim(), event_type: draft.event_type, description: draft.description || null, default_budget: draft.default_budget ? Number(draft.default_budget) : null }
      if (editing) {
        await fetch('/api/events/templates', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: draft.id, ...payload }) })
      } else {
        await fetch('/api/events/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      }
      setDraft(blank)
      await onChanged()
    } catch { /* ignore */ } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-[91] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-3xl p-5" style={MODAL_STYLE} onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: '#5FB8E0' }}>Event Templates</div>
            <div className="text-lg font-bold" style={{ color: '#eaf2fb' }}>Template manager</div>
          </div>
          <button onClick={onClose} className="rounded-full px-2 py-1 text-xs" style={{ color: '#98abbd' }}>Close</button>
        </div>

        {/* Existing templates */}
        <div className="mb-4 flex flex-col gap-1.5">
          {templates.length === 0 && <div className="text-[11px]" style={{ color: '#6f8397' }}>No templates yet — build one below.</div>}
          {templates.map(t => (
            <div key={t.id} className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: '#16232f', border: '1px solid rgba(140,170,200,0.18)' }}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[12.5px] font-semibold" style={{ color: '#eaf2fb' }}>{t.name}</span>
                  <span className="rounded-full px-1.5 py-0.5 text-[8.5px] font-bold uppercase" style={{ background: 'rgba(20,32,44,0.6)', color: '#9FD8EC' }}>{TYPE_LABEL[t.event_type] ?? t.event_type}</span>
                  {t.is_starter && <span className="rounded-full px-1.5 py-0.5 text-[8.5px] font-bold uppercase" style={{ background: 'rgba(126,224,168,0.14)', color: '#7ee0a8' }}>Starter</span>}
                </div>
                {t.description && <div className="text-[10.5px]" style={{ color: '#8ba0b4' }}>{t.description}</div>}
              </div>
              <button onClick={() => edit(t)} className="rounded-lg px-2.5 py-1 text-[11px] font-semibold" style={{ background: '#22303f', border: '1px solid rgba(95,184,224,0.28)', color: '#9FD8EC' }}>Edit</button>
            </div>
          ))}
        </div>

        {/* Draft editor */}
        <div className="rounded-2xl p-3.5" style={{ background: WELL, border: '1px solid rgba(140,170,200,0.2)' }}>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: '#9FD8EC' }}>{editing ? 'Edit template' : 'New template'}</div>
          <div className="flex flex-col gap-2 text-sm">
            <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Template name (e.g. Property Launch)" className="rounded-xl px-3 py-2 text-sm outline-none" style={INPUT_STYLE} />
            <div className="grid grid-cols-2 gap-2">
              <select value={draft.event_type} onChange={e => setDraft({ ...draft, event_type: e.target.value })} className="rounded-xl px-3 py-2 text-sm outline-none" style={INPUT_STYLE}>
                {EVENT_TYPES.map(t => <option key={t.id} value={t.id} className="bg-neutral-900">{t.label}</option>)}
              </select>
              <input value={draft.default_budget} onChange={e => setDraft({ ...draft, default_budget: e.target.value.replace(/[^\d.]/g, '') })} inputMode="decimal" placeholder="Default budget" className="rounded-xl px-3 py-2 text-sm outline-none" style={INPUT_STYLE} />
            </div>
            <textarea value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} placeholder="Short description" rows={2} className="rounded-xl px-3 py-2 text-sm outline-none" style={INPUT_STYLE} />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            {editing && <button onClick={() => setDraft(blank)} className="rounded-xl px-3 py-2 text-xs" style={{ color: '#98abbd' }}>New instead</button>}
            <button onClick={save} disabled={busy || !draft.name.trim()} className="rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-40" style={{ background: '#26374a', border: '1px solid rgba(140,170,200,0.3)', color: '#cfe0f0' }}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add template'}</button>
          </div>
          <div className="mt-2 text-[10px]" style={{ color: '#6f8397' }}>Starter templates are managed by Gate Guard corporate. Your org&apos;s own templates are fully editable here.</div>
        </div>
      </div>
    </div>
  )
}
