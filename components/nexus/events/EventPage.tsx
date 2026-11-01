'use client'
/**
 * Event page — full screen, light look (same shell as the product / job pages).
 *   Status path + next-step button · KPIs (countdown, plan, orders, guests, budget)
 *   Tabs: Overview · Plan · Orders & budget · Emails · Guests · Day-of · Results
 * Data: /api/events/[id] (+ /items, /campaign, /leads), /api/events/templates.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fillMerge, MERGE_FIELDS, sanitizeEmailHtml } from '@/lib/events-merge'
import {
  AUDIENCES, BOOTH_TYPES, BRAND, EVENT_TYPES, FLOW, FONT, GREEN, LINE, MUTED, ORANGE, PLAN_CATS, PLAN_LABEL, RED, RSVPS,
  SHADOW, STATUS_COLOR, STATUS_LABEL, SUPPLY_CATS, SUPPLY_LABEL, SUPPLY_STATUS, TEXT, TYPE_LABEL,
  clockAt, countdown, daysUntil, eventHref, fmtDate, fmtTime, htmlToText, lineTotal, money, offsetFor, parseGuestLine, planCat,
  stepLabel, textToHtml, toHHMM, todayISO,
  type CampaignStep, type ChecklistItem, type Detail, type EventRow, type Guest, type RunItem, type Supply,
} from '@/components/nexus/events/shared'

const TABS = ['Overview', 'Plan', 'Orders & budget', 'Emails', 'Guests', 'Day-of', 'Results'] as const
type Tab = (typeof TABS)[number]
type Kind = 'checklist' | 'supply' | 'campaign' | 'guest'

const CSS = `
.ep{position:fixed;inset:0;z-index:130;overflow-y:auto;background-color:#EEF2F7;background-image:linear-gradient(180deg,#0E1726 0px,#18263F 200px,#283B5E 380px,#5D7193 560px,#B4C1D6 760px,#E2E8F1 940px,#EEF2F7 1100px);background-repeat:no-repeat;background-attachment:local;color:${TEXT};font-family:${FONT};letter-spacing:-.01em;-webkit-overflow-scrolling:touch}
.ep-wrap{max-width:1180px;margin:0 auto;padding:20px 24px calc(140px + env(safe-area-inset-bottom))}
.ep-top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.ep-back{display:inline-flex;align-items:center;gap:6px;min-height:34px;border:0;background:none;color:#8EC1FF;font:500 14px ${FONT};cursor:pointer;padding:0 2px}
.ep-tb{display:flex;gap:8px;flex-wrap:wrap}
.ep-tbtn{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 12px;border-radius:10px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);color:#fff;font:500 13px ${FONT};cursor:pointer;white-space:nowrap}
.ep-hd{margin:14px 0 14px}
.ep-hd .ty{color:#8EC1FF;font-size:13px;font-weight:500}
.ep-hd h1{margin:2px 0 0;color:#fff;font-size:28px;font-weight:600;letter-spacing:-.025em;line-height:1.2}
.ep-hd .sub{color:rgba(255,255,255,.75);font-size:14px;margin-top:6px;display:flex;gap:6px 14px;flex-wrap:wrap;align-items:center}
.ep-hd .sub a{color:#8EC1FF;text-decoration:none}
.ep-flow{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px}
.ep-steps{display:flex;gap:2px;padding:3px;border-radius:12px;background:rgba(255,255,255,.1);overflow-x:auto;max-width:100%}
.ep-steps button{border:0;background:none;height:32px;padding:0 12px;border-radius:9px;font:500 13px ${FONT};color:rgba(255,255,255,.7);cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:6px}
.ep-steps button.done{color:#fff}
.ep-steps button[aria-current=step]{background:#fff;color:${TEXT};font-weight:600}
.ep-steps .ck{width:14px;height:14px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:9px;background:rgba(255,255,255,.2)}
.ep-steps button.done .ck{background:${GREEN};color:#fff}
.ep-next{height:36px;padding:0 16px;border-radius:10px;border:0;background:${BRAND};color:#fff;font:600 13.5px ${FONT};cursor:pointer}
.ep-cmd{background:#fff;border-radius:16px;box-shadow:${SHADOW};padding:14px 18px;margin-bottom:16px;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));row-gap:12px}
.ep-k{padding:0 14px;border-left:1px solid ${LINE};min-width:0}
.ep-k:first-child{border-left:0;padding-left:0}
.ep-k .l{font-size:12px;color:${MUTED};font-weight:500}
.ep-k .v{font-size:19px;font-weight:600;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ep-k .s{font-size:12px;color:${MUTED};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ep-tabs{display:flex;gap:2px;padding:3px;border-radius:12px;background:#E8EBF0;width:max-content;max-width:100%;overflow-x:auto;position:sticky;top:8px;z-index:3;box-shadow:0 1px 2px rgba(0,0,0,.06);margin-bottom:16px}
.ep-tabs button{min-height:34px;padding:0 14px;border-radius:9px;border:0;background:none;font:500 13.5px ${FONT};color:#3A3A3C;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:6px}
.ep-tabs button[aria-selected=true]{background:#fff;color:${TEXT};font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.ep-tabs .bd{min-width:18px;height:18px;border-radius:9px;background:${RED};color:#fff;font-size:11px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;padding:0 5px}
.ep-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:16px;align-items:start}
.ep-card{background:#fff;border-radius:16px;box-shadow:${SHADOW};padding:16px 18px;min-width:0}
.ep-card+.ep-card{margin-top:16px}
.ep-card h2{margin:0 0 4px;font-size:15px;font-weight:600;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.ep-card .hint{font-size:12.5px;color:${MUTED};margin-bottom:12px}
.ep-row{display:flex;align-items:center;gap:8px;padding:7px 0;border-top:1px solid ${LINE};min-width:0}
.ep-row:first-of-type{border-top:0}
.ep-cb{width:20px;height:20px;border-radius:6px;border:1.5px solid rgba(0,0,0,.25);background:#fff;flex:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:12px;padding:0}
.ep-cb.on{background:${GREEN};border-color:${GREEN}}
.ep-flat{border:0;background:transparent;font:400 14px ${FONT};color:${TEXT};padding:4px 6px;border-radius:6px;min-width:0}
.ep-flat:hover{background:#F5F6F8}.ep-flat:focus{background:#fff;outline:2px solid rgba(0,113,227,.35)}
.ep-flat.done{color:${MUTED};text-decoration:line-through}
.ep-flat.late{color:${RED};font-weight:500}
.ep-del{border:0;background:none;color:#AEAEB2;cursor:pointer;font-size:16px;width:26px;height:26px;border-radius:6px;flex:none}
.ep-del:hover{background:#FFF0F0;color:${RED}}
.ep-grp{margin-top:14px}
.ep-grp h3{margin:0 0 4px;font-size:13px;font-weight:600;display:flex;align-items:center;gap:8px}
.ep-grp h3 .n{color:${MUTED};font-weight:500}
.ep-add{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap}
.ep-bar{height:8px;border-radius:4px;background:#E8EBF0;overflow:hidden}
.ep-bar i{display:block;height:100%;border-radius:4px}
.ep-dl{display:grid;grid-template-columns:130px minmax(0,1fr);row-gap:8px;column-gap:10px;align-items:center;font-size:14px}
.ep-dl dt{color:${MUTED};font-size:13px}.ep-dl dd{margin:0;min-width:0}
.ep-dl .ev-in{width:100%;height:34px}
.ep-mail{border:1px solid ${LINE};border-radius:12px;margin-top:10px;overflow:hidden}
.ep-mail .mh{display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;flex-wrap:wrap}
.ep-mail .mh .t{font-weight:600;font-size:14px;flex:1;min-width:140px}
.ep-mail .mb{padding:12px;border-top:1px solid ${LINE};background:#FAFAFB}
.ep-prev{background:#fff;border:1px solid ${LINE};border-radius:10px;padding:14px 16px;font-size:14px;line-height:1.55}
.ep-prev p{margin:0 0 10px}
.ep-fld{display:inline-flex;border:1px dashed rgba(0,113,227,.4);background:#F2F7FF;color:#0B4FA0;border-radius:6px;padding:2px 7px;font:500 12px ${FONT};cursor:pointer;margin:0 4px 4px 0}
.ep-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.ep-stat{background:#F7F8FA;border-radius:12px;padding:12px}
.ep-stat .l{font-size:12px;color:${MUTED}}.ep-stat .v{font-size:20px;font-weight:600;margin-top:2px}.ep-stat .s{font-size:12px;color:${MUTED}}
.ep-toast{position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom));transform:translateX(-50%);background:#1D1D1F;color:#fff;padding:10px 16px;border-radius:12px;font-size:14px;z-index:150;box-shadow:0 10px 30px rgba(0,0,0,.3);max-width:calc(100vw - 32px)}
.ep-toast.err{background:${RED}}
.ep-scroll{overflow-x:auto}
@media (max-width:900px){.ep-grid{grid-template-columns:minmax(0,1fr)}.ep-cmd{grid-template-columns:repeat(3,minmax(0,1fr))}.ep-k:nth-child(4){border-left:0;padding-left:0}}
@media (max-width:600px){.ep-wrap{padding:14px 14px calc(140px + env(safe-area-inset-bottom))}.ep-hd h1{font-size:23px}.ep-cmd{grid-template-columns:repeat(2,minmax(0,1fr))}.ep-k{border-left:0!important;padding-left:0!important}.ep-dl{grid-template-columns:minmax(0,1fr)}.ep-dl dt{margin-top:4px}.ep-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.hide-sm{display:none}}
`

async function jsonOrErr(r: Response | null) {
  const j = r ? await r.json().catch(() => ({})) : {}
  if (!r || !r.ok) throw new Error(j.error || 'Something went wrong — try again.')
  return j
}

export function EventPage({ eventId, onClose, onChanged }: { eventId: string; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<Detail | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('Overview')
  const [toast, setToast] = useState<{ m: string; err?: boolean } | null>(null)
  const toastTimer = useRef<number | null>(null)
  const say = useCallback((m: string, err = false) => {
    setToast({ m, err })
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), err ? 5000 : 2600)
  }, [])

  const load = useCallback(async () => {
    try {
      const j = await jsonOrErr(await fetch(`/api/events/${eventId}`, { cache: 'no-store' }).catch(() => null))
      setD(j as Detail); setLoadErr(null)
    } catch (e) { setLoadErr((e as Error).message) }
  }, [eventId])
  useEffect(() => { void load() }, [load])
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.ev-mod')) onClose() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])

  const patchEvent = useCallback(async (patch: Record<string, unknown>) => {
    try {
      const j = await jsonOrErr(await fetch(`/api/events/${eventId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }).catch(() => null))
      setD(x => (x ? { ...x, event: { ...x.event, ...j.event } } : x))
      if (j.shifted) { say(`Moved ${j.shifted} dates with the event`); void load() }
      onChanged()
      return true
    } catch (e) { say((e as Error).message, true); return false }
  }, [eventId, load, onChanged, say])

  const listKey: Record<Kind, 'checklist' | 'supplies' | 'campaign' | 'guests'> = { checklist: 'checklist', supply: 'supplies', campaign: 'campaign', guest: 'guests' }
  const addItem = useCallback(async (kind: Kind, fields: Record<string, unknown>) => {
    try {
      const j = await jsonOrErr(await fetch(`/api/events/${eventId}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, ...fields }) }).catch(() => null))
      setD(x => (x ? { ...x, [listKey[kind]]: [...(x[listKey[kind]] as unknown[]), j.item] } : x))
      onChanged(); return true
    } catch (e) { say((e as Error).message, true); return false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, onChanged, say])
  const updItem = useCallback(async (kind: Kind, id: string, fields: Record<string, unknown>) => {
    // Remember just this item's old values, so a failed save undoes only this change.
    let prev: Record<string, unknown> | null = null
    setD(x => {
      if (!x) return x
      const list = x[listKey[kind]] as unknown as Record<string, unknown>[]
      const row = list.find(r => r.id === id)
      if (row) { prev = {}; for (const k of Object.keys(fields)) prev[k] = row[k] }
      return { ...x, [listKey[kind]]: list.map(r => (r.id === id ? { ...r, ...fields } : r)) }
    })
    try {
      const j = await jsonOrErr(await fetch(`/api/events/${eventId}/items`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, item_id: id, ...fields }) }).catch(() => null))
      if (j?.item) setD(x => (x ? { ...x, [listKey[kind]]: (x[listKey[kind]] as unknown as Record<string, unknown>[]).map(r => (r.id === id ? { ...r, ...j.item } : r)) } : x))
      onChanged(); return true
    } catch (e) {
      const back = prev as Record<string, unknown> | null
      if (back) setD(x => (x ? { ...x, [listKey[kind]]: (x[listKey[kind]] as unknown as Record<string, unknown>[]).map(r => (r.id === id ? { ...r, ...back } : r)) } : x))
      say((e as Error).message, true); return false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, onChanged, say])
  const delItem = useCallback(async (kind: Kind, id: string) => {
    let removed: { row: unknown; at: number } | null = null
    setD(x => {
      if (!x) return x
      const list = x[listKey[kind]] as unknown as { id: string }[]
      const at = list.findIndex(r => r.id === id)
      if (at >= 0) removed = { row: list[at], at }
      return { ...x, [listKey[kind]]: list.filter(r => r.id !== id) }
    })
    try {
      await jsonOrErr(await fetch(`/api/events/${eventId}/items?kind=${kind}&item_id=${id}`, { method: 'DELETE' }).catch(() => null))
      onChanged()
    } catch (e) {
      const back = removed as { row: unknown; at: number } | null
      if (back) setD(x => { if (!x) return x; const list = [...(x[listKey[kind]] as unknown as unknown[])]; list.splice(back.at, 0, back.row); return { ...x, [listKey[kind]]: list } })
      say((e as Error).message, true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, onChanged, say])

  const stats = useMemo(() => {
    if (!d) return null
    const t = todayISO()
    const done = d.checklist.filter(c => c.status === 'done').length
    const late = d.checklist.filter(c => c.status !== 'done' && c.due_date && c.due_date < t).length
    const spent = d.supplies.reduce((a, s) => a + lineTotal(s), 0)
    const toOrder = d.supplies.filter(s => (s.status ?? 'needed') === 'needed').length
    const yes = d.guests.filter(g => g.rsvp === 'yes' || g.rsvp === 'attended').length
    const came = d.guests.filter(g => g.rsvp === 'attended' || g.checked_in_at).length
    const leads = d.guests.filter(g => g.lead_id).length
    const dueMail = d.campaign.filter(c => c.status !== 'sent' && !c.auto_send && c.send_at && c.send_at <= t).length
    return { done, total: d.checklist.length, late, spent, toOrder, yes, came, leads, invited: d.guests.length, dueMail }
  }, [d])

  if (!d || !stats) {
    return (
      <div className="ep"><style>{CSS}</style>
        <div className="ep-wrap">
          <button className="ep-back" onClick={onClose}>‹ Events</button>
          <div className="ep-card" style={{ marginTop: 16 }}>{loadErr ? <><div style={{ color: RED, marginBottom: 10 }}>{loadErr}</div><button className="ev-b line" onClick={load}>Try again</button></> : 'Loading event…'}</div>
        </div>
      </div>
    )
  }
  const e = d.event
  const flowIdx = FLOW.findIndex(f => f.id === e.status)
  const nextStep = flowIdx >= 0 && flowIdx < FLOW.length - 1 ? FLOW[flowIdx + 1] : null
  const budget = Number(e.budget) || 0

  const saveAsPlan = async () => {
    const name = window.prompt('Name this plan', `${TYPE_LABEL[e.event_type] ?? 'Event'} — ${e.title}`)
    if (name == null) return
    try { await jsonOrErr(await fetch('/api/events/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from_event_id: e.id, name }) }).catch(() => null)); say('Saved as a plan — pick it next time under New event'); onChanged() } catch (er) { say((er as Error).message, true) }
  }
  const copyLink = async () => { try { await navigator.clipboard.writeText(new URL(eventHref(e.id), window.location.origin).toString()); say('Link copied') } catch { say('Couldn’t copy the link', true) } }
  const remove = async () => {
    if (!window.confirm(`Delete “${e.title}” and its plan, orders, emails and guest list? This can’t be undone.`)) return
    try { await jsonOrErr(await fetch(`/api/events/${e.id}`, { method: 'DELETE' }).catch(() => null)); onChanged(); onClose() } catch (er) { say((er as Error).message, true) }
  }

  return (
    <div className="ep" role="dialog" aria-modal="true" aria-label={e.title}>
      <style>{CSS}</style>
      <div className="ep-wrap">
        <div className="ep-top">
          <button className="ep-back" onClick={onClose}>‹ Events</button>
          <div className="ep-tb">
            <button className="ep-tbtn" onClick={() => downloadIcs(e)}>Add to calendar</button>
            <button className="ep-tbtn" onClick={saveAsPlan}>Save as plan</button>
            <button className="ep-tbtn" onClick={copyLink}>Copy link</button>
            <button className="ep-tbtn" onClick={remove} aria-label="Delete event">Delete</button>
          </div>
        </div>

        <div className="ep-hd">
          <div className="ty">{TYPE_LABEL[e.event_type] ?? e.event_type}</div>
          <h1>{e.title}</h1>
          <div className="sub">
            <span>{fmtDate(e.event_date, true)}{e.start_time ? ` · ${fmtTime(e.start_time)}${e.end_time ? `–${fmtTime(e.end_time)}` : ''}` : ''}</span>
            {(e.venue || e.property_name) && <span>{e.venue || e.property_name}{e.booth_number ? ` · Booth ${e.booth_number}` : ''}</span>}
            {d.site && <a href={`/?tab=systems&site=${d.site.id}`}>Property: {d.site.name}</a>}
            {d.deal && <a href={`/crm/opportunities/${d.deal.id}`}>Deal: {d.deal.name}</a>}
            {e.host_name && <span>Host: {e.host_name}</span>}
          </div>
        </div>

        <div className="ep-flow">
          <div className="ep-steps" role="list" aria-label="Status">
            {FLOW.map((f, i) => (
              <button key={f.id} role="listitem" className={flowIdx > i ? 'done' : ''} aria-current={e.status === f.id ? 'step' : undefined} onClick={() => void patchEvent({ status: f.id })}>
                <span className="ck">{flowIdx > i ? '✓' : ''}</span>{f.label}
              </button>
            ))}
          </div>
          {e.status === 'delayed' || e.status === 'cancelled'
            ? <><span className="ev-tag" style={{ background: '#fff', color: STATUS_COLOR[e.status] }}>{STATUS_LABEL[e.status]}</span><button className="ep-next" onClick={() => void patchEvent({ status: 'planning' })}>Reopen</button></>
            : <>
                {nextStep && <button className="ep-next" onClick={() => void patchEvent({ status: nextStep.id })}>{FLOW[flowIdx].next}</button>}
                <button className="ep-tbtn" onClick={() => void patchEvent({ status: 'delayed' })}>Put on hold</button>
                <button className="ep-tbtn" onClick={() => { if (window.confirm('Cancel this event? You can reopen it later.')) void patchEvent({ status: 'cancelled' }) }}>Cancel event</button>
              </>}
        </div>

        <div className="ep-cmd">
          <div className="ep-k"><div className="l">Event day</div><div className="v" style={{ color: (daysUntil(e.event_date) ?? 99) <= 7 && (daysUntil(e.event_date) ?? -1) >= 0 ? ORANGE : undefined }}>{countdown(e.event_date)}</div><div className="s">{fmtDate(e.event_date)}</div></div>
          <div className="ep-k"><div className="l">Plan</div><div className="v">{stats.done}/{stats.total}</div><div className="s" style={{ color: stats.late ? RED : undefined }}>{stats.late ? `${stats.late} late` : stats.total && stats.done === stats.total ? 'All done' : 'on track'}</div></div>
          <div className="ep-k"><div className="l">Orders</div><div className="v">{stats.toOrder}</div><div className="s">to order · {d.supplies.length} items</div></div>
          <div className="ep-k"><div className="l">Guests</div><div className="v">{stats.yes}{e.expected_attendance ? <span style={{ fontSize: 13, color: MUTED, fontWeight: 500 }}> / {e.expected_attendance}</span> : null}</div><div className="s">said yes · {stats.came} came</div></div>
          <div className="ep-k"><div className="l">Budget</div><div className="v" style={{ color: budget && stats.spent > budget ? RED : undefined }}>{money(stats.spent)}</div><div className="s">of {budget ? money(budget) : 'no budget'}</div></div>
        </div>

        <div className="ep-tabs" role="tablist">
          {TABS.map(t => {
            const badge = t === 'Plan' ? stats.late : t === 'Emails' ? stats.dueMail : 0
            return <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}{badge ? <span className="bd">{badge}</span> : null}</button>
          })}
        </div>

        {tab === 'Overview' && <Overview d={d} stats={stats} patchEvent={patchEvent} updItem={updItem} goTab={setTab} />}
        {tab === 'Plan' && <PlanTab items={d.checklist} host={e.host_name} addItem={addItem} updItem={updItem} delItem={delItem} />}
        {tab === 'Orders & budget' && <OrdersTab supplies={d.supplies} budget={budget} addItem={addItem} updItem={updItem} delItem={delItem} patchEvent={patchEvent} />}
        {tab === 'Emails' && <EmailsTab event={e} steps={d.campaign} guests={d.guests} addItem={addItem} updItem={updItem} delItem={delItem} say={say} reload={load} />}
        {tab === 'Guests' && <GuestsTab eventId={e.id} guests={d.guests} addItem={addItem} updItem={updItem} delItem={delItem} say={say} reload={load} />}
        {tab === 'Day-of' && <DayOfTab d={d} patchEvent={patchEvent} updItem={updItem} />}
        {tab === 'Results' && <ResultsTab d={d} stats={stats} patchEvent={patchEvent} say={say} reload={load} />}
      </div>
      {toast && <div className={`ep-toast${toast.err ? ' err' : ''}`} role="status">{toast.m}</div>}
    </div>
  )
}

type Stats = { done: number; total: number; late: number; spent: number; toOrder: number; yes: number; came: number; leads: number; invited: number; dueMail: number }
type AddFn = (kind: Kind, f: Record<string, unknown>) => Promise<boolean>
type UpdFn = (kind: Kind, id: string, f: Record<string, unknown>) => Promise<boolean>
type DelFn = (kind: Kind, id: string) => Promise<void>
type PatchFn = (p: Record<string, unknown>) => Promise<boolean>

/** Text input that saves on blur / Enter when the value changed. */
function Inline({ value, onSave, className = 'ep-flat', placeholder, type = 'text', style, ariaLabel }: { value: string; onSave: (v: string) => void; className?: string; placeholder?: string; type?: string; style?: React.CSSProperties; ariaLabel?: string }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  const commit = () => { if (v !== value) onSave(v) }
  return <input className={className} type={type} value={v} placeholder={placeholder} style={style} aria-label={ariaLabel ?? placeholder}
    onChange={ev => setV(ev.target.value)}
    onBlur={commit}
    onKeyDown={ev => { if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur() }} />
}

// ── Overview ─────────────────────────────────────────────────────────────────
function Overview({ d, stats, patchEvent, updItem, goTab }: { d: Detail; stats: Stats; patchEvent: PatchFn; updItem: UpdFn; goTab: (t: Tab) => void }) {
  const e = d.event
  const t = todayISO()
  const upNext = d.checklist.filter(c => c.status !== 'done').sort((a, b) => String(a.due_date ?? '9').localeCompare(String(b.due_date ?? '9'))).slice(0, 7)
  const byCat = PLAN_CATS.map(c => {
    const list = d.checklist.filter(x => planCat(x.category) === c.id)
    return { ...c, total: list.length, done: list.filter(x => x.status === 'done').length, late: list.filter(x => x.status !== 'done' && x.due_date && x.due_date < t).length }
  }).filter(c => c.total)
  // Changing the date asks (in plain buttons) whether the plan moves with it.
  const [pendingDate, setPendingDate] = useState<string | null>(null)
  const hasPlan = !!(d.checklist.length || d.supplies.length || d.campaign.length)
  const setDate = (v: string) => {
    if (!v || v === e.event_date) return
    if (e.event_date && hasPlan) { setPendingDate(v); return }
    void patchEvent({ event_date: v })
  }
  const applyDate = async (move: boolean) => { const v = pendingDate; setPendingDate(null); if (v) await patchEvent({ event_date: v, shift_dates: move }) }
  return (
    <div className="ep-grid">
      <div>
        <div className="ep-card">
          <h2>Up next <button className="ev-b line sm" onClick={() => goTab('Plan')}>Full plan</button></h2>
          <div className="hint">The next things to get done, soonest first.</div>
          {!upNext.length ? <div className="ev-note">{d.checklist.length ? 'Every step is done.' : 'No steps yet — add them on the Plan tab.'}</div> : upNext.map(c => (
            <div className="ep-row" key={c.id}>
              <button className="ep-cb" aria-label={`Mark “${c.title}” done`} onClick={() => void updItem('checklist', c.id, { status: 'done' })} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14 }}>{c.title}</div>
                <div className="ev-note">{PLAN_LABEL[planCat(c.category)]}{c.owner_name ? ` · ${c.owner_name}` : ''}</div>
              </div>
              <div style={{ fontSize: 13, whiteSpace: 'nowrap', color: c.due_date && c.due_date < t ? RED : MUTED, fontWeight: c.due_date && c.due_date < t ? 600 : 400 }}>{c.due_date ? (c.due_date < t ? `Late · ${fmtDate(c.due_date)}` : fmtDate(c.due_date)) : 'No date'}</div>
            </div>
          ))}
        </div>
        {!!byCat.length && (
          <div className="ep-card">
            <h2>Progress by area</h2>
            <div className="hint">{stats.done} of {stats.total} steps done.</div>
            {byCat.map(c => (
              <div key={c.id} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}><span>{c.label}</span><span style={{ color: c.late ? RED : MUTED }}>{c.done}/{c.total}{c.late ? ` · ${c.late} late` : ''}</span></div>
                <div className="ep-bar"><i style={{ width: `${(c.done / c.total) * 100}%`, background: c.done === c.total ? GREEN : c.late ? ORANGE : BRAND }} /></div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <div className="ep-card">
          <h2>Details</h2>
          <div className="hint">Changes save as you go.</div>
          <dl className="ep-dl">
            <dt>Name</dt><dd><Inline className="ev-in" value={e.title} onSave={v => v.trim() && void patchEvent({ title: v.trim() })} ariaLabel="Name" /></dd>
            <dt>Type</dt><dd><select className="ev-in" value={e.event_type} onChange={ev => void patchEvent({ event_type: ev.target.value })} aria-label="Type">{EVENT_TYPES.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}{!TYPE_LABEL[e.event_type] && <option value={e.event_type}>{e.event_type}</option>}</select></dd>
            <dt>Date</dt><dd><input className="ev-in" type="date" defaultValue={e.event_date ?? ''} key={`${e.event_date ?? 'none'}-${pendingDate ?? ''}`} onBlur={ev => setDate(ev.target.value)} aria-label="Date" />
              {pendingDate && <div className="ev-msg" role="alertdialog" aria-label="Move the plan?" style={{ marginTop: 8, marginBottom: 0 }}>
                Moving to {fmtDate(pendingDate)}. Move every open step, order and unsent email by the same number of days?
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  <button className="ev-b pri sm" onClick={() => void applyDate(true)}>Move the plan too</button>
                  <button className="ev-b line sm" onClick={() => void applyDate(false)}>Only the event date</button>
                  <button className="ev-b line sm" onClick={() => setPendingDate(null)}>Cancel</button>
                </div>
              </div>}
            </dd>
            <dt>Time</dt><dd style={{ display: 'flex', gap: 6 }}><Inline className="ev-in" type="time" value={e.start_time ?? ''} onSave={v => void patchEvent({ start_time: v })} ariaLabel="Starts" /><Inline className="ev-in" type="time" value={e.end_time ?? ''} onSave={v => void patchEvent({ end_time: v })} ariaLabel="Ends" /></dd>
            <dt>Property / account</dt><dd><Inline className="ev-in" value={e.property_name ?? ''} onSave={v => void patchEvent({ property_name: v })} ariaLabel="Property" /></dd>
            <dt>Venue</dt><dd><Inline className="ev-in" value={e.venue ?? ''} onSave={v => void patchEvent({ venue: v })} ariaLabel="Venue" /></dd>
            {BOOTH_TYPES.has(e.event_type) && <><dt>Booth #</dt><dd><Inline className="ev-in" value={e.booth_number ?? ''} onSave={v => void patchEvent({ booth_number: v })} ariaLabel="Booth" /></dd></>}
            <dt>Host</dt><dd><Inline className="ev-in" value={e.host_name ?? ''} onSave={v => void patchEvent({ host_name: v })} ariaLabel="Host" /></dd>
            <dt>Budget</dt><dd><Inline className="ev-in" value={e.budget != null ? String(e.budget) : ''} onSave={v => void patchEvent({ budget: v.replace(/[^\d.]/g, '') })} placeholder="$" ariaLabel="Budget" /></dd>
            <dt>Expected guests</dt><dd><Inline className="ev-in" value={e.expected_attendance != null ? String(e.expected_attendance) : ''} onSave={v => void patchEvent({ expected_attendance: v.replace(/\D/g, '') })} ariaLabel="Expected guests" /></dd>
            <dt>Goal</dt><dd><Inline className="ev-in" value={e.goal ?? ''} onSave={v => void patchEvent({ goal: v })} placeholder="What does a win look like?" ariaLabel="Goal" /></dd>
          </dl>
        </div>
        {(d.site || d.deal) && (
          <div className="ep-card">
            <h2>Linked</h2>
            {d.site && <a className="ep-row" style={{ textDecoration: 'none', color: 'inherit' }} href={`/?tab=systems&site=${d.site.id}`}><span style={{ flex: 1 }}>Property · <b>{d.site.name}</b></span><span style={{ color: BRAND }}>Open ›</span></a>}
            {d.deal && <a className="ep-row" style={{ textDecoration: 'none', color: 'inherit' }} href={`/crm/opportunities/${d.deal.id}`}><span style={{ flex: 1 }}>Deal · <b>{d.deal.name}</b>{d.deal.stage ? <span className="ev-note"> · {d.deal.stage}</span> : null}</span><span style={{ color: BRAND }}>Open ›</span></a>}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Plan ─────────────────────────────────────────────────────────────────────
function PlanTab({ items, host, addItem, updItem, delItem }: { items: ChecklistItem[]; host?: string | null; addItem: AddFn; updItem: UpdFn; delItem: DelFn }) {
  const [filter, setFilter] = useState<'all' | 'open' | 'late'>('all')
  const t = todayISO()
  const isLate = (c: ChecklistItem) => c.status !== 'done' && !!c.due_date && c.due_date < t
  const shown = items.filter(c => filter === 'all' || (filter === 'open' ? c.status !== 'done' : isLate(c)))
  const cats = [...PLAN_CATS.map(c => c.id as string)]
  return (
    <div className="ep-card">
      <h2>
        <span>Plan</span>
        <div className="ev-seg" role="group" aria-label="Show">
          <button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All</button>
          <button aria-pressed={filter === 'open'} onClick={() => setFilter('open')}>To do</button>
          <button aria-pressed={filter === 'late'} onClick={() => setFilter('late')}>Late</button>
        </div>
      </h2>
      <div className="hint">Every step from venue to follow-up. Click any text or date to change it.</div>
      {cats.map(cat => {
        const list = shown.filter(c => planCat(c.category) === cat).sort((a, b) => String(a.due_date ?? '9').localeCompare(String(b.due_date ?? '9')))
        const all = items.filter(c => planCat(c.category) === cat)
        if (!list.length) return null
        return (
          <div className="ep-grp" key={cat}>
            <h3>{PLAN_LABEL[cat]} <span className="n">{all.filter(c => c.status === 'done').length}/{all.length}</span></h3>
            {list.map(c => (
              <div className="ep-row" key={c.id}>
                <button className={`ep-cb${c.status === 'done' ? ' on' : ''}`} aria-label={c.status === 'done' ? 'Mark not done' : 'Mark done'} onClick={() => void updItem('checklist', c.id, { status: c.status === 'done' ? 'open' : 'done' })}>{c.status === 'done' ? '✓' : ''}</button>
                <Inline className={`ep-flat${c.status === 'done' ? ' done' : ''}`} style={{ flex: 1 }} value={c.title} onSave={v => v.trim() && void updItem('checklist', c.id, { title: v.trim() })} ariaLabel="Step" />
                <Inline className="ep-flat hide-sm" style={{ width: 130, color: MUTED, fontSize: 13 }} value={c.owner_name ?? ''} placeholder="Who" onSave={v => void updItem('checklist', c.id, { owner_name: v })} ariaLabel="Owner" />
                <Inline className={`ep-flat${isLate(c) ? ' late' : ''}`} type="date" style={{ width: 140, fontSize: 13 }} value={c.due_date ?? ''} onSave={v => void updItem('checklist', c.id, { due_date: v })} ariaLabel="Due date" />
                <button className="ep-del" aria-label="Delete step" onClick={() => void delItem('checklist', c.id)}>×</button>
              </div>
            ))}
            {filter === 'all' && <AddStep cat={cat} host={host} addItem={addItem} />}
          </div>
        )
      })}
      {filter !== 'all' && !shown.length && <div className="ev-note" style={{ marginTop: 12 }}>{filter === 'late' ? 'Nothing is late.' : 'Everything is done.'}</div>}
      {filter === 'all' && <AddAnyStep host={host} addItem={addItem} empty={!items.length} />}
    </div>
  )
}
function AddAnyStep({ host, addItem, empty }: { host?: string | null; addItem: AddFn; empty: boolean }) {
  const [cat, setCat] = useState('venue'); const [v, setV] = useState(''); const [due, setDue] = useState('')
  const add = async () => { if (!v.trim()) return; if (await addItem('checklist', { category: cat, title: v.trim(), due_date: due || null, owner_name: host ?? null })) { setV(''); setDue('') } }
  return (
    <div className="ep-grp" style={{ borderTop: `1px solid ${LINE}`, paddingTop: 12 }}>
      <h3>{empty ? 'Add your first step' : 'Add a step in another area'}</h3>
      <div className="ep-add">
        <select className="ev-in" style={{ height: 32 }} value={cat} onChange={e => setCat(e.target.value)} aria-label="Area">{PLAN_CATS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
        <input className="ev-in" style={{ flex: '1 1 200px', height: 32 }} placeholder="What needs doing" value={v} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void add() }} />
        <input className="ev-in" type="date" style={{ height: 32 }} value={due} onChange={e => setDue(e.target.value)} aria-label="Due date" />
        <button className="ev-b pri sm" disabled={!v.trim()} onClick={add}>Add</button>
      </div>
    </div>
  )
}
function AddStep({ cat, host, addItem }: { cat: string; host?: string | null; addItem: AddFn }) {
  const [v, setV] = useState(''); const [due, setDue] = useState('')
  const add = async () => { if (!v.trim()) return; if (await addItem('checklist', { category: cat, title: v.trim(), due_date: due || null, owner_name: host ?? null })) { setV(''); setDue('') } }
  return (
    <div className="ep-add">
      <input className="ep-flat" style={{ flex: '1 1 200px', height: 32, color: v ? TEXT : MUTED, fontSize: 13.5 }} placeholder="+ Add a step" aria-label={`Add a step to ${PLAN_LABEL[cat]}`} value={v} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void add() }} />
      {v && <><input className="ev-in" type="date" style={{ height: 32 }} value={due} onChange={e => setDue(e.target.value)} aria-label="Due date" /><button className="ev-b pri sm" onClick={add}>Add</button></>}
    </div>
  )
}

// ── Orders & budget ──────────────────────────────────────────────────────────
function OrdersTab({ supplies, budget, addItem, updItem, delItem, patchEvent }: { supplies: Supply[]; budget: number; addItem: AddFn; updItem: UpdFn; delItem: DelFn; patchEvent: PatchFn }) {
  const [f, setF] = useState({ category: 'print', item: '', qty: '1', cost: '', vendor: '', needed_by: '' })
  const total = supplies.reduce((a, s) => a + lineTotal(s), 0)
  const byCat = SUPPLY_CATS.map(c => ({ ...c, list: supplies.filter(s => (s.category ?? 'other') === c.id || (c.id === 'other' && !SUPPLY_LABEL[s.category ?? ''])) })).filter(c => c.list.length)
  const t = todayISO()
  const add = async () => { if (!f.item.trim()) return; if (await addItem('supply', { ...f, item: f.item.trim() })) setF({ ...f, item: '', qty: '1', cost: '', vendor: '', needed_by: '' }) }
  const pct = budget ? Math.min(100, (total / budget) * 100) : 0
  const counts = SUPPLY_STATUS.map(s => ({ ...s, n: supplies.filter(x => (x.status ?? 'needed') === s.id).length }))
  return (
    <>
      <div className="ep-card">
        <h2>Budget</h2>
        <div className="hint">Order list total vs. the event budget.</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <span style={{ fontSize: 24, fontWeight: 600, color: budget && total > budget ? RED : TEXT }}>{money(total)}</span>
          <span className="ev-note">of</span>
          <Inline className="ev-in" style={{ width: 120, height: 32 }} value={budget ? String(budget) : ''} placeholder="Set budget" onSave={v => void patchEvent({ budget: v.replace(/[^\d.]/g, '') })} ariaLabel="Budget" />
          {budget > 0 && <span className="ev-note" style={{ color: total > budget ? RED : GREEN }}>{total > budget ? `${money(total - budget)} over` : `${money(budget - total)} left`}</span>}
        </div>
        {budget > 0 && <div className="ep-bar" style={{ marginBottom: 12 }}><i style={{ width: `${pct}%`, background: total > budget ? RED : pct > 85 ? ORANGE : BRAND }} /></div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {byCat.map(c => <span key={c.id} className="ev-tag" style={{ background: '#F2F2F7', color: TEXT, fontWeight: 500 }}>{c.label}: {money(c.list.reduce((a, s) => a + lineTotal(s), 0))}</span>)}
        </div>
        <div className="ev-note" style={{ marginTop: 10 }}>{counts.map(c => `${c.n} ${c.label.toLowerCase()}`).join(' · ')}</div>
      </div>
      <div className="ep-card">
        <h2>Order list</h2>
        <div className="hint">Print pieces, food, giveaways, booth and rentals. Late orders show in red.</div>
        <div className="ep-scroll">
          <table className="ev-tbl" style={{ minWidth: 720 }}>
            <thead><tr><th>Item</th><th style={{ width: 70 }}>Qty</th><th style={{ width: 100 }}>Each</th><th style={{ width: 90, textAlign: 'right' }}>Total</th><th>Vendor</th><th style={{ width: 140 }}>Needed by</th><th style={{ width: 120 }}>Status</th><th style={{ width: 30 }} /></tr></thead>
            {byCat.map(c => (
              <tbody key={c.id}>
                <tr><td colSpan={8} style={{ background: '#FAFAFB', fontWeight: 600, fontSize: 12.5 }}>{c.label}</td></tr>
                {c.list.map(s => {
                  const late = (s.status ?? 'needed') === 'needed' && s.needed_by && s.needed_by < t
                  return (
                    <tr key={s.id}>
                      <td><Inline value={s.item} onSave={v => v.trim() && void updItem('supply', s.id, { item: v.trim() })} style={{ width: '100%' }} ariaLabel="Item" /></td>
                      <td><Inline value={String(s.qty ?? 1)} onSave={v => void updItem('supply', s.id, { qty: v.replace(/\D/g, '') || 1 })} style={{ width: 56 }} ariaLabel="Quantity" /></td>
                      <td><Inline value={s.cost != null ? String(s.cost) : ''} placeholder="$" onSave={v => void updItem('supply', s.id, { cost: v.replace(/[^\d.]/g, '') })} style={{ width: 84 }} ariaLabel="Cost each" /></td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>{money(lineTotal(s))}</td>
                      <td><Inline value={s.vendor ?? ''} placeholder="Vendor" onSave={v => void updItem('supply', s.id, { vendor: v })} style={{ width: '100%' }} ariaLabel="Vendor" /></td>
                      <td><Inline type="date" className={`ep-flat${late ? ' late' : ''}`} value={s.needed_by ?? ''} onSave={v => void updItem('supply', s.id, { needed_by: v })} style={{ fontSize: 13 }} ariaLabel="Needed by" /></td>
                      <td><select className="ev-in" style={{ height: 30, fontSize: 13, color: s.status === 'received' || s.status === 'packed' ? GREEN : s.status === 'ordered' ? BRAND : TEXT }} value={s.status ?? 'needed'} onChange={ev => void updItem('supply', s.id, { status: ev.target.value })} aria-label="Status">{SUPPLY_STATUS.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select></td>
                      <td><button className="ep-del" aria-label="Delete item" onClick={() => void delItem('supply', s.id)}>×</button></td>
                    </tr>
                  )
                })}
              </tbody>
            ))}
            {!supplies.length && <tbody><tr><td colSpan={8} className="ev-empty">Nothing to order yet.</td></tr></tbody>}
          </table>
        </div>
        <div className="ep-add" style={{ marginTop: 12 }}>
          <select className="ev-in" style={{ height: 34 }} value={f.category} onChange={e => setF({ ...f, category: e.target.value })} aria-label="Category">{SUPPLY_CATS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
          <input className="ev-in" style={{ flex: '1 1 180px', height: 34 }} placeholder="+ Item to order" value={f.item} onChange={e => setF({ ...f, item: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') void add() }} />
          <input className="ev-in" style={{ width: 64, height: 34 }} placeholder="Qty" inputMode="numeric" value={f.qty} onChange={e => setF({ ...f, qty: e.target.value.replace(/\D/g, '') })} aria-label="Quantity" />
          <input className="ev-in" style={{ width: 90, height: 34 }} placeholder="$ each" inputMode="decimal" value={f.cost} onChange={e => setF({ ...f, cost: e.target.value.replace(/[^\d.]/g, '') })} aria-label="Cost each" />
          <input className="ev-in" style={{ width: 140, height: 34 }} placeholder="Vendor" value={f.vendor} onChange={e => setF({ ...f, vendor: e.target.value })} aria-label="Vendor" />
          <input className="ev-in" type="date" style={{ height: 34 }} value={f.needed_by} onChange={e => setF({ ...f, needed_by: e.target.value })} aria-label="Needed by" />
          <button className="ev-b pri" style={{ height: 34 }} onClick={add}>Add</button>
        </div>
      </div>
    </>
  )
}

// ── Emails ───────────────────────────────────────────────────────────────────
function EmailsTab({ event, steps, guests, addItem, updItem, delItem, say, reload }: { event: EventRow; steps: CampaignStep[]; guests: Guest[]; addItem: AddFn; updItem: UpdFn; delItem: DelFn; say: (m: string, err?: boolean) => void; reload: () => Promise<void> }) {
  const [open, setOpen] = useState<string | null>(null)
  const sorted = [...steps].sort((a, b) => String(a.send_at ?? '9').localeCompare(String(b.send_at ?? '9')) || (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const t = todayISO()
  const addNew = async () => {
    const ok = await addItem('campaign', { step: 'follow_up', email_subject: `About ${event.property_name || event.title}`, email_html: textToHtml('Hi {{first_name}},\n\n\n\n— {{host_name}}'), sort_order: steps.length + 1, send_at: event.event_date ?? null })
    if (ok) say('Email added — open it to write it')
  }
  return (
    <div className="ep-card">
      <h2><span>Email campaign</span><button className="ev-b line sm" onClick={addNew}>+ Add email</button></h2>
      <div className="hint">Invites, reminders and thank-yous, in send order. Each guest gets their own copy with their name filled in. Emails come from noreply@gateguard.co and replies go to you.</div>
      {!sorted.length && <div className="ev-note">No emails yet.</div>}
      {sorted.map(s => {
        const due = s.status !== 'sent' && !s.auto_send && s.send_at && s.send_at <= t
        const isOpen = open === s.id
        return (
          <div className="ep-mail" key={s.id}>
            <div className="mh" onClick={() => setOpen(isOpen ? null : s.id)} role="button" aria-expanded={isOpen} tabIndex={0} onKeyDown={ev => { if (ev.key === 'Enter') setOpen(isOpen ? null : s.id) }}>
              <span className="ev-dot" style={{ background: s.status === 'sent' ? GREEN : s.status === 'partial' ? ORANGE : due ? ORANGE : '#C7C7CC' }} />
              <div className="t">{stepLabel(s.step)}<div className="ev-note" style={{ fontWeight: 400 }}>{s.email_subject ? fillMerge(s.email_subject, event, null, event.host_name ?? '', false) : 'No subject'}</div></div>
              <span className="ev-note" style={{ whiteSpace: 'nowrap', color: due ? ORANGE : undefined, fontWeight: due ? 600 : 400 }}>{s.status === 'sent' ? `Sent${(s.sent_guest_ids ?? []).length ? ` to ${(s.sent_guest_ids ?? []).length}` : ''}` : s.status === 'partial' ? `Partly sent (${(s.sent_guest_ids ?? []).length})` : s.status === 'sending' ? 'Sending…' : s.send_at ? `${due ? 'Send now · ' : s.auto_send ? 'Auto-sends ' : 'Send '}${fmtDate(s.send_at)}` : 'No send date'}</span>
              <span style={{ color: MUTED }}>{isOpen ? '▴' : '▾'}</span>
            </div>
            {isOpen && <EmailEditor event={event} step={s} guests={guests} updItem={updItem} delItem={delItem} say={say} reload={reload} />}
          </div>
        )
      })}
    </div>
  )
}
function EmailEditor({ event, step, guests, updItem, delItem, say, reload }: { event: EventRow; step: CampaignStep; guests: Guest[]; updItem: UpdFn; delItem: DelFn; say: (m: string, err?: boolean) => void; reload: () => Promise<void> }) {
  const [subject, setSubject] = useState(step.email_subject ?? '')
  const [body, setBody] = useState(htmlToText(step.email_html))
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const ta = useRef<HTMLTextAreaElement>(null)
  const dirty = subject !== (step.email_subject ?? '') || body !== htmlToText(step.email_html)
  const audience = step.audience ?? 'all'
  // Only guests who haven't had this email yet — sending again never repeats anyone.
  const already = new Set((step.sent_guest_ids ?? []).map(String))
  const reach = guests.filter(g => {
    const r = g.rsvp ?? 'invited'
    if (already.has(g.id) || !/.+@.+\..+/.test(String(g.email ?? ''))) return false
    return audience === 'invited' ? r === 'invited' : audience === 'yes' ? r === 'yes' : audience === 'attended' ? (r === 'attended' || !!g.checked_in_at) : audience === 'no_show' ? (r === 'yes' && !g.checked_in_at) : r !== 'no'
  }).length
  const sentCount = already.size
  const insert = (f: string) => {
    const el = ta.current; const tok = `{{${f}}}`
    if (!el) { setBody(b => b + tok); return }
    const a = el.selectionStart ?? body.length, b = el.selectionEnd ?? body.length
    setBody(body.slice(0, a) + tok + body.slice(b))
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = a + tok.length })
  }
  const save = async (quiet = false): Promise<boolean> => {
    const ok = await updItem('campaign', step.id, { email_subject: subject, email_html: textToHtml(body) })
    if (ok && !quiet) say('Email saved')
    return ok
  }
  const send = async (test: boolean) => {
    // Never send an old copy: if the latest edits didn't save, stop here.
    if (dirty && !(await save(true))) return
    if (!test && !window.confirm(`Send “${subject}” to ${reach} ${sentCount ? 'more ' : ''}guest${reach === 1 ? '' : 's'} now?`)) return
    setBusy(true)
    try {
      const r = await fetch(`/api/events/${event.id}/campaign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ step_id: step.id, test }) }).catch(() => null)
      const j = await jsonOrErr(r)
      const extra = [j.failed ? `${j.failed} failed${j.errors?.[0] ? ` (${j.errors[0]})` : ''}` : '', j.skipped ? `${j.skipped} had no email` : '', j.remaining ? `${j.remaining} still to send — press Send again` : ''].filter(Boolean).join(' · ')
      say(test ? 'Test sent to your inbox' : `Sent to ${j.sent} guest${j.sent === 1 ? '' : 's'}${extra ? ` · ${extra}` : ''}`, !!j.failed)
      if (!test) await reload()
    } catch (e) { say((e as Error).message, true) }
    setBusy(false)
  }
  const copy = async () => { try { await navigator.clipboard.writeText(`${fillMerge(subject, event, null, event.host_name ?? '', false)}\n\n${htmlToText(fillMerge(textToHtml(body), event, null, event.host_name ?? ''))}`); say('Copied — paste it into your own email') } catch { say('Couldn’t copy', true) } }
  return (
    <div className="mb">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ flex: '1 1 160px' }}><label className="ev-lbl">Send on</label><Inline className="ev-in" type="date" style={{ width: '100%' }} value={step.send_at ?? ''} onSave={v => void updItem('campaign', step.id, { send_at: v })} ariaLabel="Send on" /></div>
        <div style={{ flex: '1 1 200px' }}><label className="ev-lbl">Send to</label><select className="ev-in" style={{ width: '100%' }} value={audience} onChange={e => void updItem('campaign', step.id, { audience: e.target.value })} aria-label="Send to">{AUDIENCES.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}</select></div>
      </div>
      <label className="ev-lbl">Subject</label>
      <input className="ev-in" style={{ width: '100%', marginBottom: 10 }} value={subject} onChange={e => setSubject(e.target.value)} />
      <label className="ev-lbl">Message</label>
      <div style={{ marginBottom: 6 }}><span className="ev-note" style={{ marginRight: 6 }}>Insert:</span>{MERGE_FIELDS.map(f => <button key={f} className="ep-fld" onClick={() => insert(f)}>{f.replace(/_/g, ' ')}</button>)}</div>
      {preview
        ? <div className="ep-prev">
            {/* Subject as plain text; body through the same cleaner the sender uses. */}
            <div style={{ fontWeight: 600, marginBottom: 10 }}>{fillMerge(subject, event, { name: 'Jordan Smith' }, event.host_name ?? '', false)}</div>
            <div dangerouslySetInnerHTML={{ __html: fillMerge(sanitizeEmailHtml(textToHtml(body)), event, { name: 'Jordan Smith' }, event.host_name ?? '', true, { rsvp_link: '#' }) }} />
          </div>
        : <textarea ref={ta} className="ev-ta" rows={9} value={body} onChange={e => setBody(e.target.value)} />}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
        <button className="ev-b pri sm" disabled={!dirty} onClick={() => void save()}>Save</button>
        <button className="ev-b line sm" onClick={() => setPreview(p => !p)}>{preview ? 'Edit' : 'Preview'}</button>
        <button className="ev-b line sm" disabled={busy} onClick={() => void send(true)}>Send me a test</button>
        <button className="ev-b line sm" onClick={copy}>Copy text</button>
        <button className="ev-b pri sm" disabled={busy || !reach} onClick={() => void send(false)}>{busy ? 'Sending…' : sentCount ? `Send to ${reach} new guest${reach === 1 ? '' : 's'}` : `Send to ${reach} guest${reach === 1 ? '' : 's'}`}</button>
        <span style={{ flex: 1 }} />
        <button className="ev-b red sm" onClick={() => { if (window.confirm('Delete this email?')) void delItem('campaign', step.id) }}>Delete</button>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13.5 }}>
        <input type="checkbox" checked={!!step.auto_send} disabled={!step.send_at} onChange={e => void updItem('campaign', step.id, { auto_send: e.target.checked })} />
        Send automatically on {step.send_at ? fmtDate(step.send_at) : 'the send date'} at 9 AM Eastern{!step.send_at ? ' (set a send date first)' : ''}
      </label>
      {sentCount > 0 && <div className="ev-note" style={{ marginTop: 6 }}>Already sent to {sentCount} guest{sentCount === 1 ? '' : 's'}{step.sent_at ? ` (${fmtDate(String(step.sent_at).slice(0, 10))})` : ''}. Sending again only reaches guests who haven’t had it.</div>}
      {!reach && <div className="ev-note" style={{ marginTop: 8 }}>{sentCount ? 'Everyone in this group already got it.' : <>No guests with an email address match “{AUDIENCES.find(a => a.id === audience)?.label}”. Add guests on the Guests tab.</>}</div>}
      <div className="ev-note" style={{ marginTop: 6 }}>Tip: **bold** and [link text](https://…) work in the message. “rsvp link” lets guests reply to you to RSVP.</div>
    </div>
  )
}

// ── Guests ───────────────────────────────────────────────────────────────────
function GuestsTab({ eventId, guests, addItem, updItem, delItem, say, reload }: { eventId: string; guests: Guest[]; addItem: AddFn; updItem: UpdFn; delItem: DelFn; say: (m: string, err?: boolean) => void; reload: () => Promise<void> }) {
  const [q, setQ] = useState('')
  const [f, setF] = useState({ name: '', email: '', company: '', phone: '' })
  const [importing, setImporting] = useState(false)
  const [paste, setPaste] = useState('')
  const [busy, setBusy] = useState(false)
  const s = q.trim().toLowerCase()
  const shown = guests.filter(g => !s || [g.name, g.email, g.company, g.phone].some(v => String(v ?? '').toLowerCase().includes(s)))
  const counts = RSVPS.map(r => ({ ...r, n: guests.filter(g => (g.rsvp ?? 'invited') === r.id).length }))
  const checkedIn = guests.filter(g => g.checked_in_at || g.rsvp === 'attended').length
  const leadReady = guests.filter(g => !g.lead_id && (g.rsvp === 'yes' || g.rsvp === 'attended' || g.checked_in_at)).length
  const add = async () => { if (!f.name.trim() && !f.email.trim()) return; if (await addItem('guest', { ...f, name: f.name.trim() || f.email.trim() })) setF({ name: '', email: '', company: '', phone: '' }) }
  const parsed = paste.split(/\r?\n/).map(l => l.trim()).filter(Boolean).filter((l, i) => !(i === 0 && /name/i.test(l) && /email/i.test(l))).map(parseGuestLine).filter(g => g.name || g.email)
  const doImport = async () => {
    setBusy(true)
    try {
      const j = await jsonOrErr(await fetch(`/api/events/${eventId}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'guest', rows: parsed }) }).catch(() => null))
      say(`Added ${j.items.length} guest${j.items.length === 1 ? '' : 's'}${j.skipped ? ` · ${j.skipped} skipped (blank or already on the list)` : ''}`)
      setPaste(''); setImporting(false); await reload()
    } catch (e) { say((e as Error).message, true) }
    setBusy(false)
  }
  const makeLeads = async () => {
    setBusy(true)
    try {
      const j = await jsonOrErr(await fetch(`/api/events/${eventId}/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => null))
      say(j.created ? `Created ${j.created} lead${j.created === 1 ? '' : 's'} in Sales` : 'Everyone who came already has a lead')
      await reload()
    } catch (e) { say((e as Error).message, true) }
    setBusy(false)
  }
  const checkIn = (g: Guest) => {
    const on = !(g.checked_in_at || g.rsvp === 'attended')
    void updItem('guest', g.id, on ? { checked_in_at: new Date().toISOString(), rsvp: 'attended' } : { checked_in_at: null, rsvp: 'yes' })
  }
  return (
    <div className="ep-card">
      <h2>
        <span>Guests</span>
        <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="ev-b line sm" onClick={() => setImporting(i => !i)}>Paste or import list</button>
          <button className="ev-b pri sm" disabled={busy || !leadReady} onClick={makeLeads} title="Guests who said yes or came, without a lead yet">Turn into leads{leadReady ? ` (${leadReady})` : ''}</button>
        </span>
      </h2>
      <div className="hint">{guests.length} invited · {counts.filter(c => c.id !== 'invited').map(c => `${c.n} ${c.label.toLowerCase()}`).join(' · ')} · {checkedIn} checked in</div>
      {importing && (
        <div style={{ background: '#FAFAFB', border: `1px solid ${LINE}`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <div className="ev-note" style={{ marginBottom: 6 }}>One guest per line — name, email, company, phone in any order (paste from Excel or a sign-up sheet works). Or choose a CSV file.</div>
          <textarea className="ev-ta" rows={6} placeholder={'Jordan Smith, jordan@acme.com, Acme Residential\nPriya Patel, priya@greystar.com, Greystar, 404-555-0100'} value={paste} onChange={e => setPaste(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
            <label className="ev-b line sm" style={{ cursor: 'pointer' }}>Choose CSV<input type="file" accept=".csv,.txt,text/csv" style={{ display: 'none' }} onChange={async e => { const file = e.target.files?.[0]; if (file) setPaste(await file.text()) }} /></label>
            <span className="ev-note">{parsed.length} guest{parsed.length === 1 ? '' : 's'} found</span>
            <span style={{ flex: 1 }} />
            <button className="ev-b line sm" onClick={() => { setImporting(false); setPaste('') }}>Cancel</button>
            <button className="ev-b pri sm" disabled={busy || !parsed.length} onClick={doImport}>Add {parsed.length || ''} guests</button>
          </div>
        </div>
      )}
      <div className="ep-add" style={{ marginBottom: 10 }}>
        <input className="ev-in" style={{ flex: '1 1 150px', height: 34 }} placeholder="+ Name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') void add() }} />
        <input className="ev-in" style={{ flex: '1 1 170px', height: 34 }} placeholder="Email" type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') void add() }} />
        <input className="ev-in" style={{ flex: '1 1 140px', height: 34 }} placeholder="Company" value={f.company} onChange={e => setF({ ...f, company: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') void add() }} />
        <input className="ev-in" style={{ flex: '1 1 120px', height: 34 }} placeholder="Phone" type="tel" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') void add() }} />
        <button className="ev-b pri" style={{ height: 34 }} onClick={add}>Add</button>
      </div>
      {guests.length > 6 && <input className="ev-in" style={{ width: '100%', marginBottom: 8 }} placeholder="Find a guest… (great for check-in at the door)" value={q} onChange={e => setQ(e.target.value)} aria-label="Find a guest" />}
      <div className="ep-scroll">
        <table className="ev-tbl" style={{ minWidth: 640 }}>
          <thead><tr><th>Guest</th><th>Contact</th><th style={{ width: 120 }}>RSVP</th><th style={{ width: 130 }}>Check-in</th><th style={{ width: 90 }}>Lead</th><th style={{ width: 30 }} /></tr></thead>
          <tbody>
            {shown.map(g => {
              const inNow = !!(g.checked_in_at || g.rsvp === 'attended')
              return (
                <tr key={g.id}>
                  <td><Inline value={g.name ?? ''} onSave={v => void updItem('guest', g.id, { name: v })} style={{ fontWeight: 600, width: '100%' }} ariaLabel="Name" /><Inline value={g.company ?? ''} placeholder="Company" onSave={v => void updItem('guest', g.id, { company: v })} style={{ fontSize: 12.5, color: MUTED, width: '100%' }} ariaLabel="Company" /></td>
                  <td><Inline value={g.email ?? ''} placeholder="Email" onSave={v => void updItem('guest', g.id, { email: v })} style={{ fontSize: 13, width: '100%' }} ariaLabel="Email" /><Inline value={g.phone ?? ''} placeholder="Phone" onSave={v => void updItem('guest', g.id, { phone: v })} style={{ fontSize: 12.5, color: MUTED, width: '100%' }} ariaLabel="Phone" /></td>
                  <td><select className="ev-in" style={{ height: 30, fontSize: 13 }} value={g.rsvp ?? 'invited'} onChange={e => void updItem('guest', g.id, { rsvp: e.target.value })} aria-label="RSVP">{RSVPS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select></td>
                  <td><button className={`ev-b sm ${inNow ? '' : 'line'}`} style={inNow ? { background: '#E8F5EC', color: GREEN } : undefined} onClick={() => checkIn(g)}>{inNow ? '✓ Here' : 'Check in'}</button></td>
                  <td>{g.lead_id ? <a href={`/crm/leads/${g.lead_id}`} style={{ color: BRAND, fontSize: 13, textDecoration: 'none' }}>Open ›</a> : <span className="ev-note">—</span>}</td>
                  <td><button className="ep-del" aria-label="Remove guest" onClick={() => void delItem('guest', g.id)}>×</button></td>
                </tr>
              )
            })}
            {!shown.length && <tr><td colSpan={6} className="ev-empty">{guests.length ? 'No guest matches.' : 'No guests yet — add them above or paste a list.'}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Day-of ───────────────────────────────────────────────────────────────────
function DayOfTab({ d, patchEvent, updItem }: { d: Detail; patchEvent: PatchFn; updItem: UpdFn }) {
  const e = d.event
  const initial = useMemo(() => (Array.isArray(e.run_of_show) ? e.run_of_show : []).slice().sort((a, b) => a.offset_min - b.offset_min), [e.run_of_show])
  const [rows, setRows] = useState<RunItem[]>(initial)
  useEffect(() => setRows(initial), [initial])
  const dirty = JSON.stringify(rows) !== JSON.stringify(initial)
  const hasStart = /^\d{1,2}:\d{2}/.test(e.start_time ?? '')
  const pack = d.supplies
  const save = async () => { const clean = rows.filter(r => r.item.trim()).sort((a, b) => a.offset_min - b.offset_min); if (await patchEvent({ run_of_show: clean })) setRows(clean) }
  return (
    <div className="ep-grid">
      <div>
        <div className="ep-card">
          <h2><span>Day-of schedule</span><span style={{ display: 'flex', gap: 8 }}><button className="ev-b line sm" onClick={() => printRunSheet(d)}>Print run sheet</button>{dirty && <button className="ev-b pri sm" onClick={save}>Save</button>}</span></h2>
          <div className="hint">{hasStart ? `Times follow the ${fmtTime(e.start_time)} start — change the start time and the whole day moves.` : 'Set a start time on Overview to see clock times. Until then, times are minutes before / after the start.'}</div>
          {rows.map((r, i) => (
            <div className="ep-row" key={i}>
              {hasStart
                ? <input className="ep-flat" type="time" style={{ width: 120, fontSize: 13 }} value={toHHMM(e.start_time, r.offset_min)} onChange={ev => setRows(rs => rs.map((x, j) => (j === i ? { ...x, offset_min: offsetFor(e.start_time, ev.target.value) } : x)))} aria-label="Time" />
                : <input className="ep-flat" style={{ width: 90, fontSize: 13 }} inputMode="numeric" value={String(r.offset_min)} onChange={ev => setRows(rs => rs.map((x, j) => (j === i ? { ...x, offset_min: parseInt(ev.target.value.replace(/[^\d-]/g, ''), 10) || 0 } : x)))} aria-label="Minutes from start" />}
              <input className="ep-flat" style={{ flex: 1 }} value={r.item} placeholder="What happens" onChange={ev => setRows(rs => rs.map((x, j) => (j === i ? { ...x, item: ev.target.value } : x)))} aria-label="What happens" />
              <input className="ep-flat hide-sm" style={{ width: 110, color: MUTED, fontSize: 13 }} value={r.owner ?? ''} placeholder="Who" onChange={ev => setRows(rs => rs.map((x, j) => (j === i ? { ...x, owner: ev.target.value } : x)))} aria-label="Who" />
              <button className="ep-del" aria-label="Remove row" onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <div className="ep-add"><button className="ev-b line sm" onClick={() => setRows(rs => [...rs, { offset_min: (rs[rs.length - 1]?.offset_min ?? -30) + 30, item: '', owner: '' }])}>+ Add a time</button></div>
        </div>
      </div>
      <div>
        <div className="ep-card">
          <h2>Venue & contacts</h2>
          <dl className="ep-dl" style={{ marginTop: 8 }}>
            <dt>Venue</dt><dd><Inline className="ev-in" value={e.venue ?? ''} onSave={v => void patchEvent({ venue: v })} ariaLabel="Venue" /></dd>
            <dt>Address</dt><dd><Inline className="ev-in" value={e.venue_address ?? ''} onSave={v => void patchEvent({ venue_address: v })} ariaLabel="Address" />{e.venue_address && <a className="ev-note" style={{ color: BRAND, textDecoration: 'none' }} target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${encodeURIComponent(e.venue_address)}`}>Directions ›</a>}</dd>
            <dt>Venue contact</dt><dd><Inline className="ev-in" value={e.venue_contact ?? ''} onSave={v => void patchEvent({ venue_contact: v })} ariaLabel="Venue contact" /></dd>
            <dt>Contact phone</dt><dd><Inline className="ev-in" value={e.venue_phone ?? ''} onSave={v => void patchEvent({ venue_phone: v })} ariaLabel="Contact phone" />{e.venue_phone && <a className="ev-note" style={{ color: BRAND, textDecoration: 'none' }} href={`tel:${e.venue_phone.replace(/[^\d+]/g, '')}`}>Call ›</a>}</dd>
            {BOOTH_TYPES.has(e.event_type) && <><dt>Booth #</dt><dd><Inline className="ev-in" value={e.booth_number ?? ''} onSave={v => void patchEvent({ booth_number: v })} ariaLabel="Booth" /></dd></>}
          </dl>
        </div>
        <div className="ep-card">
          <h2>Pack list</h2>
          <div className="hint">Tick each item as it goes in the car.</div>
          {!pack.length ? <div className="ev-note">Nothing on the order list.</div> : pack.map(s => (
            <div className="ep-row" key={s.id}>
              <button className={`ep-cb${s.status === 'packed' ? ' on' : ''}`} aria-label={s.status === 'packed' ? 'Unpack' : 'Mark packed'} onClick={() => void updItem('supply', s.id, { status: s.status === 'packed' ? 'received' : 'packed' })}>{s.status === 'packed' ? '✓' : ''}</button>
              <span style={{ flex: 1, fontSize: 14, color: s.status === 'packed' ? MUTED : TEXT }}>{s.item}{(s.qty ?? 1) > 1 ? ` × ${s.qty}` : ''}</span>
              {(s.status ?? 'needed') === 'needed' && <span className="ev-note" style={{ color: ORANGE }}>not ordered</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Results ──────────────────────────────────────────────────────────────────
function ResultsTab({ d, stats, patchEvent, say, reload }: { d: Detail; stats: Stats; patchEvent: PatchFn; say: (m: string, err?: boolean) => void; reload: () => Promise<void> }) {
  const e = d.event
  const att = e.actual_attendance ?? (stats.came || null)
  const cost = e.actual_cost ?? (stats.spent || null)
  const leads = d.guests.filter(g => g.lead_id)
  const [busy, setBusy] = useState(false)
  const makeLeads = async () => {
    setBusy(true)
    try { const j = await jsonOrErr(await fetch(`/api/events/${e.id}/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => null)); say(j.created ? `Created ${j.created} lead${j.created === 1 ? '' : 's'}` : 'Everyone who came already has a lead'); await reload() } catch (er) { say((er as Error).message, true) }
    setBusy(false)
  }
  const per = (n: number | null, by: number) => (n != null && by > 0 ? money(n / by) : '—')
  return (
    <div className="ep-grid">
      <div>
        <div className="ep-card">
          <h2>How it went</h2>
          <div className="hint">Numbers fill in from check-ins and the order list — type over them if they’re off.</div>
          <div className="ep-stats" style={{ marginBottom: 14 }}>
            <div className="ep-stat"><div className="l">Came</div><div className="v">{att ?? '—'}</div><div className="s">{e.expected_attendance ? `of ${e.expected_attendance} expected` : `${stats.yes} said yes`}</div></div>
            <div className="ep-stat"><div className="l">Show rate</div><div className="v">{stats.yes ? `${Math.round((stats.came / stats.yes) * 100)}%` : '—'}</div><div className="s">came ÷ said yes</div></div>
            <div className="ep-stat"><div className="l">Leads</div><div className="v">{leads.length}</div><div className="s">in Sales</div></div>
            <div className="ep-stat"><div className="l">Total cost</div><div className="v">{money(cost)}</div><div className="s" style={{ color: e.budget && cost && cost > e.budget ? RED : undefined }}>{e.budget ? `${cost && cost > e.budget ? 'over' : 'under'} budget by ${money(Math.abs((cost ?? 0) - e.budget))}` : 'no budget set'}</div></div>
            <div className="ep-stat"><div className="l">Cost per guest</div><div className="v">{per(cost, Number(att) || 0)}</div><div className="s">cost ÷ came</div></div>
            <div className="ep-stat"><div className="l">Cost per lead</div><div className="v">{per(cost, leads.length)}</div><div className="s">cost ÷ leads</div></div>
          </div>
          <div className="ev-form">
            <div><label className="ev-lbl">Actual attendance</label><Inline className="ev-in" style={{ width: '100%' }} value={e.actual_attendance != null ? String(e.actual_attendance) : ''} placeholder={stats.came ? String(stats.came) : ''} onSave={v => void patchEvent({ actual_attendance: v.replace(/\D/g, '') })} ariaLabel="Actual attendance" /></div>
            <div><label className="ev-lbl">Actual cost</label><Inline className="ev-in" style={{ width: '100%' }} value={e.actual_cost != null ? String(e.actual_cost) : ''} placeholder={stats.spent ? String(Math.round(stats.spent)) : '$'} onSave={v => void patchEvent({ actual_cost: v.replace(/[^\d.]/g, '') })} ariaLabel="Actual cost" /></div>
            <div className="full"><label className="ev-lbl">Notes — what worked, what to change next time</label><NotesBox value={e.outcome_notes ?? ''} onSave={v => void patchEvent({ outcome_notes: v })} /></div>
          </div>
          {e.status !== 'complete' && <div style={{ marginTop: 12 }}><button className="ev-b pri" onClick={() => void patchEvent({ status: 'complete' })}>Mark event complete</button></div>}
        </div>
      </div>
      <div>
        <div className="ep-card">
          <h2><span>Leads from this event</span><button className="ev-b line sm" disabled={busy} onClick={makeLeads}>Turn guests into leads</button></h2>
          <div className="hint">Everyone who said yes or checked in becomes a lead in Sales, with a note naming this event.</div>
          {!leads.length ? <div className="ev-note">No leads yet.</div> : leads.map(g => (
            <a key={g.id} className="ep-row" href={`/crm/leads/${g.lead_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <span style={{ flex: 1 }}><b>{g.name}</b>{g.company ? <span className="ev-note"> · {g.company}</span> : null}</span><span style={{ color: BRAND, fontSize: 13 }}>Open ›</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
function NotesBox({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  return <textarea className="ev-ta" rows={4} value={v} onChange={e => setV(e.target.value)} onBlur={() => { if (v !== value) onSave(v) }} aria-label="Notes" />
}

// ── Calendar file + run sheet ────────────────────────────────────────────────
function downloadIcs(e: EventRow) {
  if (!e.event_date) { window.alert('Add the event date first.'); return }
  const ymd = e.event_date.replace(/-/g, '')
  const hm = (t?: string | null) => (t && /^\d{1,2}:\d{2}/.test(t) ? t.slice(0, 5).replace(':', '').padStart(4, '0') + '00' : '')
  const s = hm(e.start_time), en = hm(e.end_time)
  const esc = (x: string) => x.replace(/[\\;,]/g, m => `\\${m}`).replace(/\n/g, '\\n')
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Gate Guard//Nexus Events//EN', 'BEGIN:VEVENT',
    `UID:${e.id}@gateguard.co`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    s ? `DTSTART:${ymd}T${s}` : `DTSTART;VALUE=DATE:${ymd}`,
    s ? `DTEND:${ymd}T${en || s}` : '',
    `SUMMARY:${esc(e.title)}`,
    e.venue || e.venue_address ? `LOCATION:${esc([e.venue, e.venue_address].filter(Boolean).join(', '))}` : '',
    `URL:${new URL(eventHref(e.id), window.location.origin).toString()}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean)
  const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' }))
  const a = document.createElement('a'); a.href = url; a.download = `${e.title.replace(/[^\w-]+/g, '-').slice(0, 60) || 'event'}.ics`; a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function printRunSheet(d: Detail) {
  const e = d.event
  const esc = (x: unknown) => String(x ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
  const ros = (Array.isArray(e.run_of_show) ? e.run_of_show : []).slice().sort((a, b) => a.offset_min - b.offset_min)
  const w = window.open('', '_blank'); if (!w) return
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(e.title)} — run sheet</title><style>
body{font:14px/1.45 -apple-system,Segoe UI,Inter,sans-serif;color:#1D1D1F;margin:32px}h1{font-size:22px;margin:0}h2{font-size:15px;margin:22px 0 6px;border-bottom:1px solid #ddd;padding-bottom:4px}
table{width:100%;border-collapse:collapse}td{padding:6px 4px;border-bottom:1px solid #eee;vertical-align:top}.t{width:90px;font-weight:600}.m{color:#6E6E73}.box{display:inline-block;width:12px;height:12px;border:1.5px solid #888;border-radius:3px;margin-right:8px;vertical-align:-1px}
</style></head><body>
<h1>${esc(e.title)}</h1><div class="m">${esc(fmtDate(e.event_date, true))}${e.start_time ? ` · ${esc(fmtTime(e.start_time))}` : ''}${e.venue ? ` · ${esc(e.venue)}` : ''}${e.booth_number ? ` · Booth ${esc(e.booth_number)}` : ''}</div>
${e.venue_address || e.venue_contact ? `<div class="m">${esc(e.venue_address ?? '')}${e.venue_contact ? ` · Contact: ${esc(e.venue_contact)} ${esc(e.venue_phone ?? '')}` : ''}</div>` : ''}
<h2>Schedule</h2><table>${ros.map(r => `<tr><td class="t">${esc(clockAt(e.start_time, r.offset_min))}</td><td>${esc(r.item)}</td><td class="m">${esc(r.owner ?? '')}</td></tr>`).join('') || '<tr><td class="m">No schedule yet.</td></tr>'}</table>
<h2>Pack list</h2><table>${d.supplies.map(s => `<tr><td><span class="box"></span>${esc(s.item)}${(s.qty ?? 1) > 1 ? ` × ${esc(s.qty)}` : ''}</td><td class="m">${esc(s.vendor ?? '')}</td></tr>`).join('') || '<tr><td class="m">Nothing listed.</td></tr>'}</table>
<h2>Day-of steps</h2><table>${d.checklist.filter(c => c.due_date === e.event_date).map(c => `<tr><td><span class="box"></span>${esc(c.title)}</td><td class="m">${esc(c.owner_name ?? '')}</td></tr>`).join('') || '<tr><td class="m">None.</td></tr>'}</table>
<h2>Guests (${d.guests.length})</h2><table>${d.guests.map(g => `<tr><td><span class="box"></span>${esc(g.name)}</td><td class="m">${esc(g.company ?? '')}</td><td class="m">${esc(g.rsvp ?? '')}</td></tr>`).join('')}</table>
<script>window.onload=function(){window.print()}</script></body></html>`)
  w.document.close()
}
