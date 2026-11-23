'use client'

/**
 * ServiceClient — property portal → Service. Request service, see open tickets,
 * service history (12 months) and what the AI found (Gate Watch "gate left open"
 * requests etc.). API: GET /api/portal/[slug]/service (lib/portal-service.ts),
 * POST /api/portal/[slug]/request-service. View + request = portal code (a
 * signed-in manager is filled in as the contact).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { OpsShell, useOpsManager, C } from '@/components/portal/ops/OpsShell'
import { OK_CSS, Sheet, Dot, DOT, useToast, call, when, day, type Any } from '@/components/portal/ops/opsKit'

const STAGE_DOT: Record<string, string> = { received: DOT.orange, scheduled: DOT.blue, working: DOT.blue, waiting: DOT.orange, done: DOT.green, closed: DOT.gray }
const AiTag = () => <span className="ok-pill" style={{ background: '#EEF4FF', color: C.blue }}>Found by AI</span>

function Item({ it, onOpen }: { it: Any; onOpen: () => void }) {
  return (
    <button type="button" className="ok-row" onClick={onOpen} style={{ width: '100%', background: 'none', border: 0, borderTop: '1px solid rgba(0,0,0,.06)', font: 'inherit', textAlign: 'left', cursor: 'pointer', color: 'inherit' }}>
      <Dot c={STAGE_DOT[it.stage] ?? DOT.gray} />
      <div className="main">
        <div className="t">{it.number ? `#${it.number} · ` : ''}{it.title}</div>
        <div className="m">{[it.where, it.stage === 'done' || it.stage === 'closed' ? `Finished ${day(it.done)}` : `Opened ${when(it.opened)}`, it.scheduled && it.stage !== 'done' ? `Scheduled ${day(it.scheduled)}` : null].filter(Boolean).join(' · ')}</div>
      </div>
      {it.ai && <AiTag />}
      <span className="ok-pill">{it.status}</span>
    </button>
  )
}

function Inner({ slug }: { slug: string }) {
  const { manager } = useOpsManager()
  const [toast, flash] = useToast()
  const [d, setD] = useState<Any | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [view, setView] = useState<'open' | 'history' | 'ai'>('open')
  const [asking, setAsking] = useState(false)
  const [open, setOpen] = useState<Any | null>(null)
  const load = useCallback(async () => {
    const r = await call(`/api/portal/${slug}/service`)
    setD(r.data); setErr(r.ok ? null : (r.data.error || 'Could not load service.'))
  }, [slug])
  useEffect(() => { void load() }, [load])

  const list: Any[] = useMemo(() => {
    if (!d) return []
    if (view === 'open') return d.open ?? []
    if (view === 'history') return d.history ?? []
    return [...(d.open ?? []), ...(d.history ?? [])].filter((i: Any) => i.ai).sort((a: Any, b: Any) => String(b.opened).localeCompare(String(a.opened)))
  }, [d, view])
  const c = d?.counts ?? {}

  return (
    <div className="ok-wrap">
      <style dangerouslySetInnerHTML={{ __html: OK_CSS }} />
      <div className="ok-kpis">
        <button type="button" className="ok-kpi" onClick={() => setView('open')}><div className="ok-k"><Dot c={DOT.orange} />Open</div><div className="ok-num">{d ? c.open ?? 0 : '—'}</div><div className="ok-s">Requests and jobs not finished</div></button>
        <button type="button" className="ok-kpi" onClick={() => setView('open')}><div className="ok-k"><Dot c={DOT.blue} />Scheduled or in progress</div><div className="ok-num">{d ? c.working ?? 0 : '—'}</div><div className="ok-s">A tech is on it</div></button>
        <button type="button" className="ok-kpi" onClick={() => setView('ai')}><div className="ok-k"><Dot c={DOT.blue} />Found by AI · 30 days</div><div className="ok-num">{d ? c.ai_30d ?? 0 : '—'}</div><div className="ok-s">Spotted before anyone called</div></button>
        <button type="button" className="ok-kpi" onClick={() => setView('history')}><div className="ok-k"><Dot c={DOT.green} />Finished · 30 days</div><div className="ok-num">{d ? c.done_30d ?? 0 : '—'}</div><div className="ok-s">Jobs completed</div></button>
      </div>

      <div className="ok-card">
        <div className="ok-hd">
          <div className="ok-seg" role="group" aria-label="Show">
            <button type="button" aria-pressed={view === 'open'} onClick={() => setView('open')}>Open</button>
            <button type="button" aria-pressed={view === 'history'} onClick={() => setView('history')}>History</button>
            <button type="button" aria-pressed={view === 'ai'} onClick={() => setView('ai')}>Found by AI</button>
          </div>
          <button type="button" className="ok-btn pri" onClick={() => setAsking(true)}>Request service</button>
        </div>
        {err && <div className="ok-note red">{err}</div>}
        {!d ? <div className="ok-empty">Loading…</div> : !list.length ? (
          <div className="ok-empty">{view === 'open' ? 'Nothing open — everything’s working.' : view === 'history' ? 'No service in the last 12 months.' : 'The AI hasn’t flagged anything yet.'}</div>
        ) : <div>{list.map(it => <Item key={`${it.kind}-${it.id}`} it={it} onOpen={() => setOpen(it)} />)}</div>}
      </div>

      {open && (
        <Sheet title={open.title} sub={open.number ? `Job #${open.number}` : 'Service request'} onClose={() => setOpen(null)}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="ok-pill"><Dot c={STAGE_DOT[open.stage] ?? DOT.gray} />{open.status}</span>
            {open.ai && <AiTag />}
            {open.priority && open.priority !== 'normal' && <span className="ok-pill">{String(open.priority).replace(/^./, (m: string) => m.toUpperCase())} priority</span>}
          </div>
          {open.details && <div style={{ fontSize: 14, lineHeight: 1.5 }}>{open.details}</div>}
          <div style={{ display: 'grid', gap: 6, fontSize: 13.5 }}>
            {open.where && <div><span style={{ color: C.ink3 }}>Where: </span>{open.where}</div>}
            <div><span style={{ color: C.ink3 }}>Opened: </span>{when(open.opened)}</div>
            {open.scheduled && <div><span style={{ color: C.ink3 }}>Scheduled: </span>{day(open.scheduled)}</div>}
            {open.tech && <div><span style={{ color: C.ink3 }}>Tech: </span>{open.tech}</div>}
            {open.done && <div><span style={{ color: C.ink3 }}>Finished: </span>{when(open.done)}</div>}
          </div>
          {open.ai && <div className="ok-note blue">Gate Guard’s AI spotted this from the cameras and opened the ticket — no call needed.</div>}
        </Sheet>
      )}
      {asking && <RequestSheet slug={slug} managerName={manager?.name ?? null} onClose={() => setAsking(false)} onDone={() => { setAsking(false); flash('Request sent — Gate Guard will be in touch.'); setView('open'); void load() }} flash={flash} />}
      {toast}
    </div>
  )
}

function RequestSheet({ slug, managerName, onClose, onDone, flash }: { slug: string; managerName: string | null; onClose: () => void; onDone: () => void; flash: (t: string, ok?: boolean) => void }) {
  const [f, setF] = useState({ title: '', area: '', description: '', priority: 'normal', contact_name: managerName ?? '', contact_phone: '' })
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f, v: string) => setF(x => ({ ...x, [k]: v }))
  async function send() {
    setBusy(true)
    const r = await call(`/api/portal/${slug}/request-service`, { method: 'POST', body: JSON.stringify(f) })
    setBusy(false)
    if (!r.ok) { flash(r.data.error || 'Could not send it.', false); return }
    onDone()
  }
  return (
    <Sheet title="Request service" sub="Goes straight to Gate Guard’s service team." onClose={onClose}>
      <label><span className="ok-lbl">What’s wrong?</span><input className="ok-in" autoFocus value={f.title} onChange={e => set('title', e.target.value)} placeholder="Front gate won’t close" /></label>
      <label><span className="ok-lbl">Where? (optional)</span><input className="ok-in" value={f.area} onChange={e => set('area', e.target.value)} placeholder="Main entry gate" /></label>
      <label><span className="ok-lbl">Anything else we should know? (optional)</span><textarea className="ok-in" rows={3} value={f.description} onChange={e => set('description', e.target.value)} /></label>
      <div>
        <span className="ok-lbl">How urgent?</span>
        <div className="ok-seg" role="group" aria-label="How urgent">
          {[['urgent', 'Urgent — safety or security'], ['normal', 'Normal'], ['low', 'When you can']].map(([k, l]) => <button key={k} type="button" aria-pressed={f.priority === k} onClick={() => set('priority', k)}>{l}</button>)}
        </div>
      </div>
      <div className="ok-grid2">
        <label><span className="ok-lbl">Your name</span><input className="ok-in" value={f.contact_name} onChange={e => set('contact_name', e.target.value)} /></label>
        <label><span className="ok-lbl">Best phone</span><input className="ok-in" type="tel" value={f.contact_phone} onChange={e => set('contact_phone', e.target.value)} /></label>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="ok-btn" onClick={onClose}>Cancel</button>
        <button type="button" className="ok-btn pri" disabled={busy || !f.title.trim()} onClick={() => void send()}>{busy ? 'Sending…' : 'Send request'}</button>
      </div>
    </Sheet>
  )
}

export default function ServiceClient({ slug, displayName }: { slug: string; displayName: string }) {
  return <OpsShell slug={slug} displayName={displayName} active="service"><Inner slug={slug} /></OpsShell>
}
