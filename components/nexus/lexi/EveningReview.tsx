'use client'
/**
 * Lexi — nightly "Close out today, plan tomorrow".
 *
 *   EveningCard     on the Lexi home screen: start tonight's review + the opt-in
 *                   settings (text me every evening at…, which evenings, email too,
 *                   send a test).
 *   EveningReview   the review itself (full screen):
 *                     1. How today went — last night's top 3 (done or not), finished, left over
 *                        (each left-over task gets Tomorrow / pick a day / Done / No date)
 *                     2. Tomorrow by area — Sales, Operations, Customers, Dealers, Admin, Money + calendar
 *                     3. Bring tomorrow — tick-off list (+ your "always bring" items)
 *                     4. Your top 3 for tomorrow — Lexi suggests, you edit, Commit makes them
 *                        high-priority tasks due tomorrow; tomorrow night Lexi asks how they went.
 * Data: /api/lexi/evening. Task changes: /api/todos (its own permission checks).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { T, FONT } from '@/components/nexus/tasks/shared'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = Record<string, any>
type Tone = 'red' | 'orange' | 'green' | 'blue' | 'gray'
type Area = { key: string; title: string; summary: string; items: { title: string; detail?: string; href?: string; tone?: Tone }[]; note?: string }
type Review = {
  today: string; tomorrow: string; tomorrowLabel: string; name: string
  top3: { for: string; items: { title: string; task_id: string | null; done: boolean | null }[] } | null
  doneToday: { tasks: { id: string; title: string }[]; jobs: { id: string; title: string }[] }
  leftover: { id: string; title: string; due: string | null; linked: string | null; overdue: boolean }[]
  areas: Area[]; calendar: { title: string; time: string; where?: string | null }[]
  bring: { key: string; text: string; detail?: string; source: 'job' | 'meeting' | 'always'; warn?: string }[]
  suggestTop3: string[]; summary: string
}
type Settings = { on: boolean; time: string; days: number[]; phoneLast4: string | null; email: boolean; emailAddress: string; bringAlways: string[]; lastSent: string | null; error?: string }

const DOT: Record<Tone, string> = { red: '#FF453A', orange: '#FF9F0A', green: '#30D158', blue: '#0A84FF', gray: '#C7C7CC' }
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const short = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
const hm12 = (hm: string) => { const [h, m] = hm.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}` }
const SHADOW = '0 1px 2px rgba(10,20,40,.06),0 8px 24px rgba(10,20,40,.08)'

const CSS = `
.ev-card{background:#fff;border-radius:16px;box-shadow:${SHADOW};margin-bottom:16px;padding:14px 16px;font-family:${FONT};color:${T.ink}}
.ev-card h3{margin:0;font-size:16px;font-weight:600}
.ev-card .s{font-size:13px;color:${T.ink3};margin-top:2px;line-height:1.4}
.ev-b{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:36px;padding:0 14px;border-radius:10px;border:0;font:600 13px ${FONT};cursor:pointer;white-space:nowrap;text-decoration:none}
.ev-b.sm{height:30px;padding:0 10px;font-size:12.5px;border-radius:8px}
.ev-b.pri{background:${T.blue};color:#fff}
.ev-b.line{background:#fff;border:1px solid ${T.line2};color:${T.ink};font-weight:500}
.ev-b.go{background:#E8F6EC;border:1px solid rgba(26,107,50,.25);color:${T.green}}
.ev-b:disabled{opacity:.5;cursor:default}
.ev-in{height:36px;border-radius:10px;border:1px solid ${T.line2};padding:0 10px;font:14px ${FONT};color:${T.ink};background:#fff;min-width:0}
.ev-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.ev-sw{position:relative;width:40px;height:24px;border-radius:12px;border:0;cursor:pointer;flex:none;transition:background .15s}
.ev-sw i{position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
.ev-sw[aria-checked=true] i{transform:translateX(16px)}
.ev-chip{height:30px;padding:0 10px;border-radius:8px;border:1px solid ${T.line2};background:#fff;font:500 12.5px ${FONT};color:${T.ink2};cursor:pointer}
.ev-chip[aria-pressed=true]{background:${T.blue};border-color:${T.blue};color:#fff}
.ev-msg{font-size:12.5px;margin-top:8px}
.ev-bg{position:fixed;inset:0;z-index:150;background:#EEF2F7;overflow-y:auto;-webkit-overflow-scrolling:touch;font-family:${FONT};color:${T.ink}}
.ev-top{position:sticky;top:0;z-index:2;background:#0E1726;color:#fff;padding:14px 16px calc(14px);display:flex;align-items:center;gap:12px}
.ev-top .t{flex:1;min-width:0}.ev-top h2{margin:0;font-size:19px;font-weight:600}.ev-top .d{font-size:13px;color:#8EC1FF;margin-top:2px}
.ev-wrap{max-width:820px;margin:0 auto;padding:16px 16px calc(120px + env(safe-area-inset-bottom))}
.ev-lead{font-size:15px;line-height:1.55;margin:0 0 14px;color:${T.ink}}
.ev-sec{background:#fff;border-radius:16px;box-shadow:${SHADOW};margin-bottom:14px;overflow:hidden}
.ev-sec>.hd{padding:14px 16px 6px;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.ev-sec>.hd .n{width:22px;height:22px;border-radius:11px;background:${T.blue};color:#fff;font-size:12px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;flex:none;align-self:center}
.ev-sec>.hd h3{margin:0;font-size:16px;font-weight:600}
.ev-sec>.hd .s{font-size:12.5px;color:${T.ink3}}
.ev-sec>.bd{padding:4px 16px 14px}
.ev-li{display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-top:1px solid ${T.line}}
.ev-li:first-child{border-top:0}
.ev-li .main{flex:1;min-width:0}.ev-li .t{font-size:14px;font-weight:500;line-height:1.35}.ev-li .m{font-size:12.5px;color:${T.ink3};margin-top:2px}
.ev-li .a{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.ev-dot{width:8px;height:8px;border-radius:50%;flex:none;margin-top:6px}
.ev-area{border-top:1px solid ${T.line};padding:10px 0}
.ev-area:first-child{border-top:0}
.ev-area>button{all:unset;display:flex;align-items:center;gap:10px;width:100%;cursor:pointer}
.ev-area .at{font-size:14.5px;font-weight:600;flex:none;min-width:120px}
.ev-area .as{flex:1;font-size:13px;color:${T.ink3}}
.ev-area .chev{color:${T.ink3};font-size:13px}
.ev-check{display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-top:1px solid ${T.line};cursor:pointer}
.ev-check:first-child{border-top:0}
.ev-check input{width:20px;height:20px;margin:1px 0 0;accent-color:${T.blue};flex:none}
.ev-check.done .t{text-decoration:line-through;color:${T.ink3}}
.ev-tag{font-size:11px;font-weight:600;border-radius:6px;padding:1px 7px;background:#F0F0F3;color:${T.ink3};margin-left:6px;white-space:nowrap}
.ev-tag.warn{background:#FFF4E5;color:${T.orange}}
.ev-goal{display:flex;align-items:center;gap:10px;margin:8px 0}
.ev-goal .n{width:26px;height:26px;border-radius:13px;background:#EEF4FF;color:${T.blue};font-weight:600;display:flex;align-items:center;justify-content:center;flex:none}
.ev-goal input{flex:1}
@media (max-width:640px){.ev-li{flex-wrap:wrap}.ev-li .a{width:100%;justify-content:flex-start;padding-left:18px}.ev-area .at{min-width:0}}
`

async function call(url: string, method = 'GET', body?: unknown): Promise<{ ok: boolean; data: Any }> {
  try {
    const r = await fetch(url, { method, cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
    return { ok: r.ok, data: await r.json().catch(() => ({})) }
  } catch (e) { return { ok: false, data: { error: e instanceof Error ? e.message : 'Network error' } } }
}

// ── Home-screen card + opt-in settings ───────────────────────────────────────
export function EveningCard({ onOpen }: { onOpen: () => void }) {
  const [s, setS] = useState<Settings | null>(null)
  const [edit, setEdit] = useState(false)
  const [f, setF] = useState({ time: '18:00', days: [0, 1, 2, 3, 4], phone: '', email: false })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null)

  useEffect(() => { void call('/api/lexi/evening?view=settings').then(r => { if (r.ok && r.data.settings) { setS(r.data.settings); setF(v => ({ ...v, time: r.data.settings.time, days: r.data.settings.days, email: r.data.settings.email })) } }) }, [])

  async function save(on: boolean) {
    setBusy(true); setMsg(null)
    const r = await call('/api/lexi/evening', 'POST', { action: 'settings', on, time: f.time, days: f.days, email: f.email, ...(f.phone.trim() ? { phone: f.phone } : {}) })
    setBusy(false)
    if (!r.ok) { setMsg({ t: r.data.error || 'That didn’t save.', ok: false }); return }
    setS(r.data.settings); setEdit(false); setF(v => ({ ...v, phone: '' }))
    setMsg({ t: on ? `On. Lexi will reach you at ${hm12(f.time)} on ${f.days.map(d => DAYS[d]).join(', ')}.` : 'Turned off.', ok: true })
  }
  async function test() {
    setBusy(true); setMsg(null)
    const r = await call('/api/lexi/evening', 'POST', { action: 'send_now' })
    setBusy(false)
    setMsg(r.ok ? { t: `Sent (${(r.data.sent ?? []).join(' + ')}).${r.data.warning ? ` ${r.data.warning}` : ''}`, ok: true } : { t: r.data.error || 'Didn’t send.', ok: false })
  }

  return (
    <section className="ev-card" aria-label="Close out today">
      <style>{CSS}</style>
      <div className="ev-row" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h3>Close out today · plan tomorrow</h3>
          <div className="s">Go over what got done, give every leftover a day, see tomorrow across sales, jobs, customers and money, and get your bring list and top 3.</div>
        </div>
        <button type="button" className="ev-b pri" onClick={onOpen}>Start tonight’s review</button>
      </div>
      <div className="ev-row" style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.line}` }}>
        <button type="button" role="switch" aria-checked={!!s?.on} aria-label="Remind me every evening" className="ev-sw" disabled={!s || busy || !!s.error}
          onClick={() => { if (s?.on) void save(false); else setEdit(true) }} style={{ background: s?.on ? '#34C759' : '#D1D1D6' }}><i /></button>
        <span style={{ flex: 1, minWidth: 180, fontSize: 13.5 }}>
          {s?.on ? <>Lexi reminds you at <b>{hm12(s.time)}</b> on {s.days.map(d => DAYS[d]).join(', ')}{s.phoneLast4 ? ` · text to …${s.phoneLast4}` : ''}{s.email ? ' · email' : ''}</> : 'Remind me every evening (off)'}
        </span>
        {s?.on && !edit && <button type="button" className="ev-b line sm" onClick={() => setEdit(true)}>Change</button>}
        {s?.on && <button type="button" className="ev-b line sm" onClick={test} disabled={busy}>Send a test</button>}
      </div>
      {edit && <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
        <div className="ev-row">
          <label className="ev-row" style={{ gap: 6, fontSize: 13 }}>At <input className="ev-in" type="time" value={f.time} onChange={e => setF({ ...f, time: e.target.value })} aria-label="Time" style={{ width: 120 }} /></label>
          <div className="ev-row" role="group" aria-label="Evenings" style={{ gap: 4 }}>{DAYS.map((d, i) => <button key={d} type="button" className="ev-chip" aria-pressed={f.days.includes(i)} onClick={() => setF({ ...f, days: f.days.includes(i) ? f.days.filter(x => x !== i) : [...f.days, i].sort() })}>{d}</button>)}</div>
        </div>
        <div className="ev-row">
          <input className="ev-in" style={{ flex: 1, minWidth: 180 }} inputMode="tel" placeholder={s?.phoneLast4 ? `Cell (now …${s.phoneLast4}) — leave blank to keep` : 'Your cell number for the text'} value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} aria-label="Cell number" />
          <label className="ev-row" style={{ gap: 6, fontSize: 13 }}><input type="checkbox" checked={f.email} onChange={e => setF({ ...f, email: e.target.checked })} />Email it too{s?.emailAddress ? ` (${s.emailAddress})` : ''}</label>
        </div>
        <div className="ev-row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="ev-b line sm" onClick={() => setEdit(false)}>Cancel</button>
          <button type="button" className="ev-b pri sm" onClick={() => save(true)} disabled={busy || !f.days.length}>{busy ? 'Saving…' : 'Turn on'}</button>
        </div>
      </div>}
      {(msg || s?.error) && <div className="ev-msg" role="status" style={{ color: msg?.ok ? T.green : T.red }}>{msg?.t ?? s?.error}</div>}
    </section>
  )
}

// ── The review ───────────────────────────────────────────────────────────────
export function EveningReview({ onClose, onAsk }: { onClose: () => void; onAsk: (text: string) => void }) {
  const [r, setR] = useState<Review | null>(null)
  const [s, setS] = useState<Settings | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [moved, setMoved] = useState<Record<string, string>>({})        // task id → what happened
  const [busyId, setBusyId] = useState<string | null>(null)
  const [openArea, setOpenArea] = useState<string | null>('ops')
  const [ticked, setTicked] = useState<Record<string, boolean>>({})
  const [newBring, setNewBring] = useState('')
  const [goals, setGoals] = useState<string[]>(['', '', ''])
  const [committed, setCommitted] = useState(false)
  const [commitBusy, setCommitBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const load = useCallback(async () => {
    const x = await call('/api/lexi/evening')
    if (!x.ok) { setErr(x.data.error || 'Couldn’t build tonight’s review.'); return }
    setR(x.data.review); setS(x.data.settings)
    setGoals(g => (g.some(Boolean) ? g : [0, 1, 2].map(i => x.data.review.suggestTop3?.[i] ?? '')))
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  // Bring-list ticks are per evening, on this device.
  const tickKey = r ? `lexi_bring_${r.tomorrow}` : ''
  useEffect(() => { if (!tickKey) return; try { setTicked(JSON.parse(localStorage.getItem(tickKey) || '{}')) } catch { /* private mode */ } }, [tickKey])
  const tick = (k: string) => setTicked(t => { const n = { ...t, [k]: !t[k] }; try { localStorage.setItem(tickKey, JSON.stringify(n)) } catch { /* ignore */ } return n })

  async function moveTask(id: string, patch: Any, label: string) {
    setBusyId(id)
    const x = await call(`/api/todos/${id}`, 'PATCH', patch)
    setBusyId(null)
    if (x.ok) setMoved(m => ({ ...m, [id]: label })); else setNote(x.data.error || 'That task didn’t update.')
  }
  async function saveBring(list: string[]) {
    const x = await call('/api/lexi/evening', 'POST', { action: 'bring', bringAlways: list })
    if (!x.ok) { setNote(x.data.error || 'Didn’t save your list.'); return }
    setS(x.data.settings); void load()
  }
  async function commit() {
    if (!r) return
    const items = goals.map(g => g.trim()).filter(Boolean)
    if (!items.length) { setNote('Write at least one thing for tomorrow.'); return }
    setCommitBusy(true); setNote(null)
    const made: { title: string; task_id: string | null }[] = []
    for (const title of items) {
      const x = await call('/api/todos', 'POST', { title, due_date: r.tomorrow, priority: 'high', tags: ['top3'] })
      made.push({ title, task_id: x.ok ? String(x.data.id ?? '') || null : null })
    }
    const c = await call('/api/lexi/evening', 'POST', { action: 'commit', for: r.tomorrow, items: made })
    setCommitBusy(false)
    if (!c.ok) { setNote(c.data.error || 'Didn’t save your top 3.'); return }
    const failed = made.filter(m => !m.task_id).length
    setCommitted(true)
    setNote(failed ? `Saved, but ${failed} couldn’t be made into a task.` : null)
  }

  const leftOpen = useMemo(() => (r?.leftover ?? []).filter(t => !moved[t.id]).length, [r, moved])
  const top3Done = r?.top3 ? r.top3.items.filter(i => i.done).length : 0
  const bringLeft = (r?.bring ?? []).filter(b => !ticked[b.key]).length

  return (
    <div className="ev-bg" role="dialog" aria-modal="true" aria-label="Close out today and plan tomorrow">
      <style>{CSS}</style>
      <div className="ev-top">
        <div className="t"><h2>Close out today</h2><div className="d">{r ? `Plan for ${r.tomorrowLabel}` : 'Getting your day together…'}</div></div>
        <button type="button" className="ev-b line sm" onClick={onClose}>Done</button>
      </div>
      <div className="ev-wrap">
        {err && <div className="ev-sec"><div className="bd" style={{ paddingTop: 14, color: T.red }}>{err}</div></div>}
        {!r && !err && <div className="ev-lead" style={{ color: T.ink3 }}>Lexi is reading your tasks, jobs, deals, inbox and money…</div>}
        {r && <>
          <p className="ev-lead">
            {r.name}, {r.top3 ? `you got ${top3Done} of your ${r.top3.items.length} top things done today. ` : ''}
            You finished {r.doneToday.tasks.length} task{r.doneToday.tasks.length === 1 ? '' : 's'}{r.doneToday.jobs.length ? ` and your team closed ${r.doneToday.jobs.length} job${r.doneToday.jobs.length === 1 ? '' : 's'}` : ''}.
            {leftOpen ? ` ${leftOpen} thing${leftOpen === 1 ? ' is' : 's are'} left — let’s give each one a day.` : ' Nothing is left hanging. Nice work.'}
          </p>

          {/* 1. How today went */}
          <section className="ev-sec" aria-label="How today went">
            <div className="hd"><span className="n">1</span><h3>How today went</h3><span className="s">Give every leftover a day, or mark it done</span></div>
            <div className="bd">
              {r.top3 && r.top3.items.map((i, k) => (
                <div key={`t${k}`} className="ev-li">
                  <span className="ev-dot" style={{ background: i.done ? DOT.green : DOT.orange }} />
                  <div className="main"><div className="t">{i.done ? '✓ ' : ''}{i.title}</div><div className="m">Your top 3 for today · {i.done ? 'done' : 'not done yet'}</div></div>
                  {!i.done && i.task_id && <div className="a">{moved[i.task_id] ? <span className="ev-tag">{moved[i.task_id]}</span> : <>
                    <button type="button" className="ev-b line sm" disabled={busyId === i.task_id} onClick={() => moveTask(i.task_id!, { due_date: r.tomorrow }, `Moved to ${short(r.tomorrow)}`)}>Tomorrow</button>
                    <button type="button" className="ev-b go sm" disabled={busyId === i.task_id} onClick={() => moveTask(i.task_id!, { status: 'done' }, 'Done')}>Done</button></>}</div>}
                </div>
              ))}
              {r.leftover.map(t => (
                <div key={t.id} className="ev-li">
                  <span className="ev-dot" style={{ background: moved[t.id] ? DOT.green : t.overdue ? DOT.red : DOT.orange }} />
                  <div className="main"><div className="t">{t.title}</div><div className="m">{[t.overdue && t.due ? `late — was due ${short(t.due)}` : 'due today', t.linked].filter(Boolean).join(' · ')}</div></div>
                  <div className="a">{moved[t.id] ? <span className="ev-tag">{moved[t.id]}</span> : <>
                    <button type="button" className="ev-b line sm" disabled={busyId === t.id} onClick={() => moveTask(t.id, { due_date: r.tomorrow }, `Moved to ${short(r.tomorrow)}`)}>Tomorrow</button>
                    <input className="ev-in" type="date" min={r.tomorrow} aria-label={`Pick a day for ${t.title}`} style={{ height: 30, width: 140, fontSize: 12.5 }} disabled={busyId === t.id} onChange={e => e.target.value && moveTask(t.id, { due_date: e.target.value }, `Moved to ${short(e.target.value)}`)} />
                    <button type="button" className="ev-b go sm" disabled={busyId === t.id} onClick={() => moveTask(t.id, { status: 'done' }, 'Done')}>Done</button>
                    <button type="button" className="ev-b line sm" disabled={busyId === t.id} onClick={() => moveTask(t.id, { due_date: null }, 'No date')} title="Take the date off (it shows under Needs a date)">No date</button></>}</div>
                </div>
              ))}
              {!r.top3 && !r.leftover.length && <div className="ev-li"><span className="ev-dot" style={{ background: DOT.green }} /><div className="main"><div className="t">Nothing left over from today.</div></div></div>}
              {(r.doneToday.tasks.length > 0 || r.doneToday.jobs.length > 0) && <details style={{ marginTop: 8 }}>
                <summary style={{ fontSize: 13, color: T.blue, cursor: 'pointer' }}>What got finished today ({r.doneToday.tasks.length + r.doneToday.jobs.length})</summary>
                {[...r.doneToday.tasks.map(x => ({ ...x, k: 'Task' })), ...r.doneToday.jobs.map(x => ({ ...x, k: 'Job' }))].map(x => <div key={x.id} className="ev-li"><span className="ev-dot" style={{ background: DOT.green }} /><div className="main"><div className="t">{x.title}</div><div className="m">{x.k}</div></div></div>)}
              </details>}
            </div>
          </section>

          {/* 2. Tomorrow */}
          <section className="ev-sec" aria-label="Tomorrow">
            <div className="hd"><span className="n">2</span><h3>Tomorrow — {r.tomorrowLabel}</h3><span className="s">Tap an area to see it</span></div>
            <div className="bd">
              {r.areas.map(a => {
                const open = openArea === a.key
                return (
                  <div key={a.key} className="ev-area">
                    <button type="button" aria-expanded={open} onClick={() => setOpenArea(open ? null : a.key)}>
                      <span className="at">{a.title}</span><span className="as">{a.summary}</span><span className="chev" aria-hidden>{open ? '▴' : '▾'}</span>
                    </button>
                    {open && <div style={{ marginTop: 6 }}>
                      {a.note && <div className="ev-msg" style={{ color: T.orange, marginTop: 0 }}>{a.note}</div>}
                      {a.items.length === 0 ? <div style={{ fontSize: 13, color: T.ink3, padding: '6px 0' }}>Nothing here for tomorrow.</div>
                        : a.items.map((i, k) => <div key={k} className="ev-li">
                          <span className="ev-dot" style={{ background: DOT[i.tone ?? 'blue'] }} />
                          <div className="main"><div className="t">{i.title}</div>{i.detail && <div className="m">{i.detail}</div>}</div>
                          {i.href && <div className="a"><a className="ev-b line sm" href={i.href}>Open</a></div>}
                        </div>)}
                      <button type="button" className="ev-b line sm" style={{ marginTop: 6 }} onClick={() => onAsk(`Help me plan tomorrow (${r.tomorrowLabel}) for ${a.title}. What should I do first, and what can I hand off? Here's what's on it: ${a.summary}.`)}>Ask Lexi about {a.title.toLowerCase()}</button>
                    </div>}
                  </div>
                )
              })}
              <div className="ev-area">
                <button type="button" aria-expanded={openArea === 'cal'} onClick={() => setOpenArea(openArea === 'cal' ? null : 'cal')}>
                  <span className="at">Calendar</span><span className="as">{r.calendar.length ? `${r.calendar.length} event${r.calendar.length === 1 ? '' : 's'}${r.calendar[0] ? ` · first at ${r.calendar[0].time}` : ''}` : 'Nothing on your calendar'}</span><span className="chev" aria-hidden>{openArea === 'cal' ? '▴' : '▾'}</span>
                </button>
                {openArea === 'cal' && r.calendar.map((e, k) => <div key={k} className="ev-li"><span className="ev-dot" style={{ background: DOT.blue }} /><div className="main"><div className="t">{e.title}</div><div className="m">{[e.time, e.where].filter(Boolean).join(' · ')}</div></div></div>)}
              </div>
            </div>
          </section>

          {/* 3. Bring tomorrow */}
          <section className="ev-sec" aria-label="Bring tomorrow">
            <div className="hd"><span className="n">3</span><h3>Bring tomorrow</h3><span className="s">{r.bring.length ? `${bringLeft} of ${r.bring.length} left to pack` : 'Parts on tomorrow’s jobs and papers for meetings show here'}</span></div>
            <div className="bd">
              {r.bring.map(b => (
                <label key={b.key} className={`ev-check${ticked[b.key] ? ' done' : ''}`}>
                  <input type="checkbox" checked={!!ticked[b.key]} onChange={() => tick(b.key)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="t" style={{ fontSize: 14 }}>{b.text}{b.warn && <span className="ev-tag warn">{b.warn}</span>}{b.source === 'always' && <span className="ev-tag">always</span>}</div>
                    {b.detail && <div style={{ fontSize: 12.5, color: T.ink3 }}>{b.detail}</div>}
                  </div>
                  {b.source === 'always' && <button type="button" className="ev-b line sm" onClick={e => { e.preventDefault(); void saveBring((s?.bringAlways ?? []).filter(x => x.toLowerCase() !== b.text.toLowerCase())) }} aria-label={`Take ${b.text} off your always list`}>Remove</button>}
                </label>
              ))}
              <form className="ev-row" style={{ marginTop: 10 }} onSubmit={e => { e.preventDefault(); const v = newBring.trim(); if (!v) return; setNewBring(''); void saveBring([...(s?.bringAlways ?? []), v]) }}>
                <input className="ev-in" style={{ flex: 1, minWidth: 180 }} value={newBring} onChange={e => setNewBring(e.target.value)} placeholder="Something you always need (laptop charger, ladder, gate remote…)" aria-label="Add to your always-bring list" />
                <button type="submit" className="ev-b line sm" disabled={!newBring.trim()}>Add to always</button>
              </form>
            </div>
          </section>

          {/* 4. Top 3 */}
          <section className="ev-sec" aria-label="Your top 3 for tomorrow">
            <div className="hd"><span className="n">4</span><h3>Your top 3 for tomorrow</h3><span className="s">{committed ? 'Locked in' : 'Lexi’s picks — change them to yours'}</span></div>
            <div className="bd">
              {goals.map((g, i) => <div key={i} className="ev-goal"><span className="n">{i + 1}</span><input className="ev-in" value={g} disabled={committed} onChange={e => setGoals(v => v.map((x, k) => (k === i ? e.target.value : x)))} placeholder={i === 0 ? 'The one thing that matters most' : 'Next most important'} aria-label={`Top thing ${i + 1}`} /></div>)}
              {!committed ? <div className="ev-row" style={{ justifyContent: 'flex-end', marginTop: 6 }}>
                <span style={{ flex: 1, fontSize: 12.5, color: T.ink3, minWidth: 200 }}>Commit makes these high-priority tasks due {short(r.tomorrow)}. Tomorrow night Lexi will ask how they went.</span>
                <button type="button" className="ev-b pri" onClick={commit} disabled={commitBusy}>{commitBusy ? 'Saving…' : 'Commit to these'}</button>
              </div> : <div className="ev-row" style={{ marginTop: 6 }}>
                <span style={{ flex: 1, fontSize: 13.5, color: T.green }}>Locked in. I’ll check on these tomorrow night.</span>
                <button type="button" className="ev-b line sm" onClick={() => onAsk(`Help me get a head start on tomorrow's #1: "${goals.find(Boolean)}". What do I need ready tonight?`)}>Get a head start with Lexi</button>
                <button type="button" className="ev-b pri sm" onClick={onClose}>Done for today</button>
              </div>}
            </div>
          </section>
          {note && <div className="ev-msg" role="status" style={{ color: T.red }}>{note}</div>}
        </>}
      </div>
    </div>
  )
}
