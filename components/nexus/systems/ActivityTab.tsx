'use client'
/**
 * Systems → Activity: one feed of everything that happened at the property —
 * Brivo door access + Nexus site events (unlocks, relay switches, installs,
 * alerts) — with search, a source filter and "denied only". Plus Eagle Eye
 * camera events (motion, plates, tamper…) for a chosen window. Refreshes live.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { type Any, Card, Dot, DOT, MUTED, Note, NotConnected, fmtWhen, getJson, type SiteCtx } from './shared'

type Item = { id: string; when: string | null; text: string; source: string; kind: 'access' | 'system'; tone: 'ok' | 'bad' | 'warn' | 'info' }
const DENIED = /denied|reject|fail|invalid|unknown card/i

export function normalizeFeed(internal: Any[], brivo: Any[]): Item[] {
  const a: Item[] = internal.map(e => ({
    id: `s-${e.id}`, when: e.created_at ?? null,
    text: String(e.summary || e.title || e.event_type || 'Event'),
    source: String(e.event_source || 'nexus'), kind: /access|unlock|door/i.test(String(e.event_type)) ? 'access' : 'system',
    tone: e.severity === 'critical' ? 'bad' : e.severity === 'warning' ? 'warn' : 'info',
  }))
  const b: Item[] = brivo.map(e => {
    const text = String(e.summary || 'Access event')
    return { id: String(e.id), when: e.created_at ?? null, text, source: 'brivo', kind: 'access', tone: DENIED.test(text) ? 'bad' : 'ok' }
  })
  return [...a, ...b].sort((x, y) => (y.when ? Date.parse(y.when) : 0) - (x.when ? Date.parse(x.when) : 0))
}

export function ActivityTab({ ctx, brivoEvents, brivoErr, who, setWho }: { ctx: SiteCtx; brivoEvents: Any[] | null; brivoErr: string | null; who: string; setWho: (s: string) => void }) {
  const { siteId, isCorporate, openSetup } = ctx
  const [internal, setInternal] = useState<Any[] | null>(null)
  const [src, setSrc] = useState<'all' | 'access' | 'system'>('all')
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    let alive = true
    const run = () => { if (!document.hidden) void getJson(`/api/sites/${siteId}`).then(r => { if (alive) setInternal(Array.isArray(r.data.events) ? r.data.events : []) }) }
    run()
    const t = setInterval(run, 20000)
    return () => { alive = false; clearInterval(t) }
  }, [siteId])

  const feed = useMemo(() => normalizeFeed(internal ?? [], brivoEvents ?? []), [internal, brivoEvents])
  const shown = useMemo(() => {
    const t = who.trim().toLowerCase()
    return feed.filter(i => (src === 'all' || i.kind === src) && (!denied || i.tone === 'bad') && (!t || i.text.toLowerCase().includes(t))).slice(0, 200)
  }, [feed, src, denied, who])
  const loading = internal == null || brivoEvents == null
  const brivoNote = brivoErr && !(brivoEvents ?? []).length
    ? (/no door access/i.test(brivoErr) ? 'You don’t have door access here, so door events are hidden.' : /no brivo login|outside your access/i.test(brivoErr) ? null : `Door events are unavailable right now (${brivoErr}).`)
    : null
  const brivoMissing = brivoErr && /no brivo login|outside your access/i.test(brivoErr) && !(brivoEvents ?? []).length

  return (
    <div className="sy-split">
      <Card title="Activity" sub="Door access and system events, newest first. Updates every 20 seconds.">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <input className="sy-in" style={{ flex: '1 1 200px' }} value={who} onChange={e => setWho(e.target.value)} placeholder="Search a name, door or event" aria-label="Search activity" />
          <div className="sy-chips" role="group" aria-label="Filter activity">
            {([['all', 'All'], ['access', 'Door access'], ['system', 'System']] as const).map(([k, l]) => <button key={k} type="button" className="sy-chip" aria-pressed={src === k} onClick={() => setSrc(k)}>{l}</button>)}
            <button type="button" className="sy-chip" aria-pressed={denied} onClick={() => setDenied(v => !v)}>Denied only</button>
          </div>
        </div>
        {brivoNote && <div style={{ marginBottom: 8 }}><Note tone="orange">{brivoNote}</Note></div>}
        {brivoMissing && <div style={{ marginBottom: 8 }}><NotConnected what="Brivo (door events)" isCorporate={isCorporate} onSetup={openSetup} /></div>}
        {loading ? <div className="sy-empty">Loading activity…</div>
          : !shown.length ? <div className="sy-empty">{feed.length ? 'Nothing matches.' : 'No activity yet. Door unlocks, relay switches and alerts show up here.'}</div>
          : <div className="sy-feed">{shown.map(i => (
            <div key={i.id} className="sy-row">
              <Dot c={i.tone === 'bad' ? DOT.red : i.tone === 'warn' ? DOT.orange : i.kind === 'access' ? DOT.green : DOT.blue} />
              <div className="main"><div className="t" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{i.text}</div><div className="m">{fmtWhen(i.when)}{i.source ? ` · ${i.source === 'brivo' ? 'Brivo' : i.source === 'shelly' ? 'Shelly' : i.source === 'nexus' ? 'Nexus' : i.source}` : ''}</div></div>
            </div>
          ))}</div>}
      </Card>
      <CameraEvents siteId={siteId} />
    </div>
  )
}

function CameraEvents({ siteId }: { siteId: string }) {
  const [events, setEvents] = useState<Any[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [type, setType] = useState('')
  const [hours, setHours] = useState(24)
  useEffect(() => {
    let alive = true
    setEvents(null)
    const run = () => { if (!document.hidden) void getJson(`/api/eagle-eye/events?site_id=${siteId}&hours=${hours}`).then(r => {
      if (!alive) return
      if (Array.isArray(r.data.events)) { setEvents(r.data.events); setErr(null) } else { setEvents(e => e ?? []); setErr(r.data.error || 'unavailable') }
    }) }
    run()
    const t = setInterval(run, 20000)
    return () => { alive = false; clearInterval(t) }
  }, [siteId, hours])
  const types = useMemo(() => Array.from(new Set((events ?? []).map(e => String(e.label)))).slice(0, 20), [events])
  const shown = useMemo(() => (events ?? []).filter(e => !type || e.label === type).slice(0, 150), [events, type])
  return (
    <Card title="Camera events" sub="Eagle Eye motion, plates, tamper and more.">
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <select className="sy-in" value={type} onChange={e => setType(e.target.value)} aria-label="Camera event type"><option value="">All types</option>{types.map(t => <option key={t} value={t}>{t}</option>)}</select>
        <select className="sy-in" value={hours} onChange={e => setHours(Number(e.target.value))} aria-label="Time window" style={{ width: 130, flex: 'none' }}><option value={6}>Last 6 hours</option><option value={24}>Last 24 hours</option><option value={72}>Last 3 days</option><option value={168}>Last 7 days</option></select>
      </div>
      {events == null ? <div className="sy-empty">Loading…</div>
        : err && !events.length ? <div className="sy-empty">Camera events aren’t available for this property.</div>
        : !shown.length ? <div className="sy-empty">No camera events in this window.</div>
        : <div className="sy-feed" style={{ maxHeight: 460 }}>{shown.map((e, i) => (
          <div key={e.id ?? i} className="sy-row">
            <Dot c={/tamper|intrusion|loiter/i.test(String(e.label)) ? DOT.red : DOT.gray} />
            <div className="main"><div className="t" style={{ fontSize: 13 }}>{e.label}{e.ongoing ? ' · ongoing' : ''}</div><div className="m">{[e.cameraName, fmtWhen(e.when)].filter(Boolean).join(' · ')}</div></div>
          </div>
        ))}</div>}
      <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>Open a camera on the Live tab to watch its recording.</div>
    </Card>
  )
}
