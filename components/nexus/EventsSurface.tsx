'use client'

// EventsSurface — property-events board (lunch & learns, launch parties, meet &
// greets, trade shows). P1: board + New-Event-from-template + read-only detail.
// Interactions on checklist/supplies/campaign land in P2.
import { useCallback, useEffect, useState } from 'react'

interface EventRow {
  id: string; title: string; event_type: string; status: string; event_date?: string | null
  property_name?: string | null; host_name?: string | null; start_time?: string | null
  expected_attendance?: number | null; budget?: number | null
}
interface TemplateRow { id: string; name: string; event_type: string; description?: string | null; default_budget?: number | null }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Detail { event: EventRow; checklist: any[]; supplies: any[]; campaign: any[]; guests: any[] }

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

function fmtDate(d?: string | null) { if (!d) return 'No date'; const dt = new Date(`${d}T00:00:00`); return isNaN(dt.getTime()) ? d : dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) }

export function EventsSurface() {
  const [events, setEvents] = useState<EventRow[]>([])
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [form, setForm] = useState({ title: '', event_type: 'lunch_learn', event_date: '', property_name: '', template_id: '', budget: '' })
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/events', { cache: 'no-store' }).then(x => x.json())
      setEvents(Array.isArray(r.events) ? r.events : [])
    } catch { setEvents([]) } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => { fetch('/api/events/templates').then(r => r.json()).then(j => setTemplates(j.templates ?? [])).catch(() => {}) }, [])

  async function createEvent() {
    if (!form.title.trim()) return
    setBusy(true)
    try {
      await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, budget: form.budget ? Number(form.budget) : null }) })
      setCreateOpen(false)
      setForm({ title: '', event_type: 'lunch_learn', event_date: '', property_name: '', template_id: '', budget: '' })
      await load()
    } catch { /* ignore */ } finally { setBusy(false) }
  }

  async function openDetail(id: string) {
    try { const d = await fetch(`/api/events/${id}`).then(r => r.json()); if (d.event) setDetail(d) } catch { /* ignore */ }
  }

  return (
    <section className="mt-8 w-full max-w-6xl px-1">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">Property Events</div>
          <h2 className="text-xl font-extrabold text-white">Events</h2>
        </div>
        <button onClick={() => setCreateOpen(true)} className="rounded-xl px-4 py-1.5 text-xs font-bold" style={{ background: 'rgba(0,124,255,0.3)', border: '1px solid rgba(0,200,255,0.45)', color: '#bfe6ff' }}>+ New Event</button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-400">Loading events…</div>
      ) : events.length === 0 ? (
        <div className="rounded-3xl border border-white/10 py-16 text-center" style={{ background: 'rgba(15,23,42,0.6)' }}>
          <div className="text-sm text-slate-300">No events yet.</div>
          <div className="mt-1 text-xs text-slate-500">Create one from a template — lunch &amp; learn, trade show, and more come pre-loaded.</div>
          <button onClick={() => setCreateOpen(true)} className="mt-4 rounded-xl px-4 py-2 text-xs font-bold" style={{ background: 'rgba(0,124,255,0.3)', border: '1px solid rgba(0,200,255,0.45)', color: '#bfe6ff' }}>+ New Event</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {events.map(e => {
            const stage = STATUS_STAGE[e.status] ?? 0
            return (
              <button key={e.id} onClick={() => openDetail(e.id)} className="group relative overflow-hidden rounded-2xl border border-white/10 p-4 text-left backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-white/20" style={{ background: 'rgba(15,23,42,0.66)' }}>
                <div className="pointer-events-none absolute inset-x-6 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,200,255,0.5), transparent)' }} />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-cyan-300">{TYPE_LABEL[e.event_type] ?? e.event_type}</span>
                  <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase" style={{ background: 'rgba(0,124,255,0.16)', border: '1px solid rgba(0,200,255,0.3)', color: '#bfe6ff' }}>{STATUS_LABEL[e.status] ?? e.status}</span>
                </div>
                <div className="mt-1.5 text-sm font-bold text-white">{e.title}</div>
                <div className="mt-0.5 text-[11px] text-slate-400">{e.property_name || 'No property'} · {fmtDate(e.event_date)}</div>
                <div className="mt-3 flex h-1.5 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div style={{ width: `${((stage + 1) / STAGES.length) * 100}%`, background: 'linear-gradient(90deg,#007cff,#00c8ff)' }} />
                </div>
                <div className="mt-1 text-[10px] text-slate-500">{STAGES[stage]} · hosted by {e.host_name || '—'}</div>
              </button>
            )
          })}
        </div>
      )}

      {/* Create modal */}
      {createOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setCreateOpen(false)}>
          <div className="w-full max-w-md rounded-3xl border border-white/10 p-5" style={{ background: 'rgba(11,19,41,0.98)' }} onClick={e => e.stopPropagation()}>
            <div className="mb-3 text-lg font-bold text-white">New event</div>
            <div className="flex flex-col gap-3 text-sm">
              <div>
                <div className="mb-1 text-[11px] text-slate-400">Start from a template</div>
                <div className="grid grid-cols-1 gap-1.5">
                  {templates.map(t => (
                    <button key={t.id} onClick={() => setForm(f => ({ ...f, template_id: f.template_id === t.id ? '' : t.id, event_type: t.event_type, title: f.title || t.name, budget: t.default_budget ? String(t.default_budget) : f.budget }))} className="rounded-xl px-3 py-2 text-left transition-all" style={{ background: form.template_id === t.id ? 'rgba(0,124,255,0.18)' : 'rgba(255,255,255,0.04)', border: `1px solid ${form.template_id === t.id ? 'rgba(0,200,255,0.45)' : 'rgba(255,255,255,0.1)'}` }}>
                      <div className="text-[12.5px] font-semibold text-white">{t.name}</div>
                      {t.description && <div className="text-[10.5px] text-slate-400">{t.description}</div>}
                    </button>
                  ))}
                  <div className="text-[10px] text-slate-500">Or leave blank for a scratch event.</div>
                </div>
              </div>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Event title" className="rounded-xl px-3 py-2 text-sm text-slate-100 outline-none" style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.1)' }} />
              <div className="grid grid-cols-2 gap-2">
                <select value={form.event_type} onChange={e => setForm({ ...form, event_type: e.target.value })} className="rounded-xl px-3 py-2 text-sm text-slate-100 outline-none" style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {EVENT_TYPES.map(t => <option key={t.id} value={t.id} className="bg-neutral-900">{t.label}</option>)}
                </select>
                <input type="date" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} className="rounded-xl px-3 py-2 text-sm text-slate-100 outline-none" style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
              <input value={form.property_name} onChange={e => setForm({ ...form, property_name: e.target.value })} placeholder="Property / venue (optional)" className="rounded-xl px-3 py-2 text-sm text-slate-100 outline-none" style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.1)' }} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setCreateOpen(false)} className="rounded-xl px-3 py-2 text-xs text-slate-400 hover:text-white">Cancel</button>
              <button onClick={createEvent} disabled={busy || !form.title.trim()} className="rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-40" style={{ background: 'rgba(0,124,255,0.3)', border: '1px solid rgba(0,200,255,0.45)', color: '#bfe6ff' }}>{busy ? 'Creating…' : 'Create event'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal (P1 read-only workflow) */}
      {detail && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setDetail(null)}>
          <div className="max-h-[86dvh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 p-5" style={{ background: 'rgba(11,19,41,0.98)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">{TYPE_LABEL[detail.event.event_type] ?? detail.event.event_type}</div>
                <div className="text-lg font-extrabold text-white">{detail.event.title}</div>
                <div className="text-xs text-slate-400">{detail.event.property_name || 'No property'} · {fmtDate(detail.event.event_date)}</div>
              </div>
              <button onClick={() => setDetail(null)} className="rounded-full px-2 py-1 text-xs text-slate-400 hover:text-white">Close</button>
            </div>
            {/* stepper */}
            <div className="relative my-4">
              <div className="absolute left-2 right-2 top-2.5 h-0.5" style={{ background: 'rgba(255,255,255,0.12)' }} />
              <div className="relative flex justify-between">
                {STAGES.map((st, i) => {
                  const cur = STATUS_STAGE[detail.event.status] ?? 0
                  const done = i <= cur
                  return (
                    <div key={st} className="flex w-[12.5%] flex-col items-center gap-1">
                      <span className="h-3.5 w-3.5 rounded-full" style={{ background: done ? '#007cff' : '#1e293b', border: `2px solid ${i === cur ? '#00c8ff' : done ? '#00c8ff' : '#334155'}` }} />
                      <span className="text-center text-[9px]" style={{ color: done ? '#bfe6ff' : '#64748b' }}>{st}</span>
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
            <div className="mt-3 text-[10px] text-slate-500">Actions (check off tasks, send campaign steps, RSVP → lead) come in the next build stage.</div>
          </div>
        </div>
      )}
    </section>
  )
}

function DetailList({ title, items, empty }: { title: string; items: { main: string; sub: string }[]; empty: string }) {
  return (
    <div className="rounded-2xl border border-white/8 p-3" style={{ background: 'rgba(15,23,42,0.6)' }}>
      <div className="mb-2 text-[11px] font-bold text-slate-300">{title}</div>
      {items.length === 0 ? <div className="text-[11px] text-slate-500">{empty}</div> : (
        <div className="flex flex-col gap-1.5">
          {items.map((it, i) => (
            <div key={i} className="text-[12px]">
              <span className="capitalize text-slate-100">{it.main}</span>
              {it.sub && <span className="text-[10px] capitalize text-slate-500"> · {it.sub}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
