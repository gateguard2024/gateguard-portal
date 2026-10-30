'use client'

/**
 * Deal page (Part 1 · Dealer) — the full opportunity record, HubSpot / Salesforce style.
 *   Header + stage path (days per stage) + 7 numbers incl. Deal health
 *   Left:   every CRM field (DealFields — shared with the board's deal panel)
 *   Middle: composer (note / call / email / task / meeting) + coming up + one merged timeline
 *   Right:  quotes (primary quote ⇄ deal values) · health risks with fixes · files · related
 * Data: GET /api/sales/deals/[id]/page. Stage moves go through MoveDialog (always asks why).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DealFields } from './DealFields'
import { MoveDialog } from './MoveDialog'
import { SALES_CSS } from './salesCss'
import { STAGES, fmtDate, initials, localISO, money, stageIndex, type Deal } from './salesShared'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>
type Risk = { key: string; level: 'red' | 'orange'; text: string; fix: string }
type PageData = {
  deal: Row; card: Deal; health: { score: number; label: string; risks: Risk[]; ok: string[] } | null
  timeline: { id: string; kind: string; at: string; title: string; body?: string | null; meta?: string | null; who?: string | null; href?: string | null }[]
  upcoming: { id: string; source: 'activity' | 'task'; type: string; title: string; due: string | null; key?: string | null }[]
  stageDays: Record<string, number>
  contacts: Row[]; quotes: Row[]; primaryQuoteId: string | null; valuesLocked: boolean
  surveys: Row[]; files: Row[]; todos: Row[]; invoices: Row[]; jobs: Row[]; threads: number
  lead: Row | null; aria: Row | null; dealer: string | null; owner: string | null
  reps: { id: string; name: string }[]; activities: Row[]
  can: { edit: boolean; reassign: boolean; money: boolean }
}

const ICON: Record<string, string> = { call: '☎', email: '✉', meeting: '◷', visit: '⌂', task: '✓', note: '✎', stage_change: '→', quote: '$', survey: '⌖', file: '⎙', demo: '▶' }
const FILTERS: { key: string; label: string; kinds: string[] }[] = [
  { key: 'all', label: 'All', kinds: [] },
  { key: 'email', label: 'Emails', kinds: ['email'] },
  { key: 'call', label: 'Calls', kinds: ['call'] },
  { key: 'note', label: 'Notes', kinds: ['note'] },
  { key: 'meeting', label: 'Meetings', kinds: ['meeting', 'visit', 'demo'] },
  { key: 'stage', label: 'Stage changes', kinds: ['stage_change'] },
  { key: 'quote', label: 'Quotes', kinds: ['quote'] },
  { key: 'task', label: 'Tasks', kinds: ['task'] },
  { key: 'file', label: 'Files & surveys', kinds: ['file', 'survey'] },
]
const CALL_OUTCOMES = ['Connected', 'Left voicemail', 'No answer', 'Verbal yes', 'Needs follow-up', 'Not interested']
const FILE_CATS = [
  { key: 'document', label: 'Documents' }, { key: 'quote_survey', label: 'Quotes & surveys' }, { key: 'survey_photo', label: 'Survey photos' },
  { key: 'install_photo', label: 'Install photos' }, { key: 'service_photo', label: 'Service photos' },
]

const PAGE_CSS = `
.dpg{position:fixed;inset:0;z-index:97;overflow-y:auto}
.dpg .sb-main{gap:12px}
.dpg-hd{display:flex;gap:16px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}
.dpg-key{font:600 12px ui-monospace,SFMono-Regular,Menlo,monospace;color:#8EA3C4;letter-spacing:.02em}
.dpg-hd h1{margin:2px 0 0;color:#fff;font-size:28px;font-weight:600;letter-spacing:-.02em}
.dpg-sub{color:rgba(255,255,255,.66);font-size:14px;margin-top:2px}.dpg-sub b{color:#fff;font-weight:600}
.dpg-acts{display:flex;gap:8px;flex-wrap:wrap}
.dpg-dark{height:38px;padding:0 14px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.08);color:#fff;font:600 13px inherit;display:inline-flex;align-items:center;gap:6px;cursor:pointer;white-space:nowrap}
.dpg-dark.g{background:#248A3D;border-color:#248A3D}.dpg-dark.b{background:#0071E3;border-color:#0071E3}
a.dpg-dark{color:#fff}
.dpg-path{display:flex;gap:3px;overflow-x:auto}
.dpg-path button{flex:1;min-height:44px;border:0;background:rgba(255,255,255,.1);color:#C9D2E0;display:flex;flex-direction:column;align-items:center;justify-content:center;font:600 12px inherit;cursor:pointer;clip-path:polygon(0 0,95% 0,100% 50%,95% 100%,0 100%,5% 50%)}
.dpg-path button:first-child{clip-path:polygon(0 0,95% 0,100% 50%,95% 100%,0 100%)}
.dpg-path button span{font-size:10.5px;font-weight:500;opacity:.75}
.dpg-path button.done{background:#2D4A7A;color:#fff}.dpg-path button.on{background:#0071E3;color:#fff}
.dpg-path button.won{background:#248A3D;color:#fff}.dpg-path button.lost{background:#D70015;color:#fff}
.dpg-kpis{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:10px}
.dpg-k{background:#fff;border-radius:12px;padding:11px 14px;box-shadow:0 1px 2px rgba(10,20,40,.06),0 8px 24px rgba(10,20,40,.08);min-width:0}
.dpg-k .l{font-size:11.5px;color:#6E6E73;font-weight:500}.dpg-k .v{font-size:20px;font-weight:600;letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dpg-k .s{font-size:11.5px;color:#6E6E73;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dpg-k .s.r{color:#D70015}.dpg-k .s.g{color:#1A7F37}
.dpg-grid{display:grid;grid-template-columns:380px minmax(0,1fr) 380px;gap:14px;align-items:start}
.dpg-card{background:#fff;border-radius:14px;box-shadow:0 1px 2px rgba(10,20,40,.06),0 8px 24px rgba(10,20,40,.08);overflow:hidden}
.dpg-card > .dp-body{padding:12px 16px 16px}
.dpg-ch{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 16px;border-bottom:1px solid rgba(0,0,0,.08);font-weight:600;font-size:14px}
.dpg-ch a,.dpg-ch button{font-size:12.5px;color:#0071E3;font-weight:500;border:0;background:none;cursor:pointer;padding:0}
.dpg-comp{padding:12px 16px;border-bottom:1px solid rgba(0,0,0,.08);display:flex;flex-direction:column;gap:8px}
.dpg-tabs{display:flex;gap:4px;flex-wrap:wrap}
.dpg-tabs button{padding:6px 12px;border-radius:8px;border:0;background:none;font:500 13px inherit;color:#3A3A3C;cursor:pointer}
.dpg-tabs button[aria-pressed=true]{background:#1D1D1F;color:#fff}
.dpg-row2{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.dpg-row2 .sb-in{width:auto}
.dpg-up{padding:10px 16px;background:#FBFBFD;border-bottom:1px solid rgba(0,0,0,.08)}
.dpg-ut{font-size:12px;font-weight:600;color:#6E6E73;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px}
.dpg-flt{display:flex;gap:6px;padding:10px 16px;border-bottom:1px solid rgba(0,0,0,.08);flex-wrap:wrap}
.dpg-tl{padding:4px 16px 16px}
.dpg-day{font-size:11.5px;font-weight:600;color:#6E6E73;margin:14px 0 6px;text-transform:uppercase;letter-spacing:.04em}
.dpg-ev{display:flex;gap:10px;padding:7px 0}
.dpg-ev b{font-weight:600}.dpg-ev .m{font-size:12px;color:#6E6E73}
.dpg-ev .body{font-size:13px;color:#3A3A3C;margin-top:2px;white-space:pre-wrap;word-break:break-word}
.dpg-q{padding:12px 16px;border-bottom:1px solid rgba(0,0,0,.06)}
.dpg-qm{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px}
.dpg-qm div{background:#F7F8FA;border-radius:10px;padding:7px 10px;min-width:0}.dpg-qm .l{font-size:11px;color:#6E6E73}.dpg-qm .v{font-weight:600}
.dpg-sync{margin-top:8px;display:flex;gap:8px;align-items:center;font-size:12.5px;border-radius:8px;padding:6px 10px}
.dpg-sync.ok{color:#1A7F37;background:#E8F6EC}.dpg-sync.diff{color:#B25000;background:#FFF4E5}
.dpg-risk{display:flex;gap:8px;align-items:flex-start;padding:6px 0;font-size:13px}
.dpg-risk .dot{width:8px;height:8px;border-radius:50%;margin-top:6px;flex:none}
.dpg-risk button{margin-left:auto;font-size:12px;color:#0071E3;font-weight:600;white-space:nowrap;border:0;background:none;cursor:pointer;padding:0}
.dpg-files{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:12px 16px}
.dpg-files div{background:#F7F8FA;border-radius:10px;padding:8px;text-align:center;font-size:11.5px;color:#6E6E73}.dpg-files b{display:block;font-size:18px;color:#1D1D1F}
.dpg-rel{display:flex;gap:10px;align-items:center;padding:9px 16px;border-top:1px solid rgba(0,0,0,.05);font-size:13px}
.dpg-rel a{margin-left:auto;font-size:12.5px;color:#0071E3;font-weight:500;white-space:nowrap}
.dpg-ring{width:42px;height:42px;flex:none}
@media (max-width:1399px){.dpg-grid{grid-template-columns:340px minmax(0,1fr)}.dpg-right{grid-column:1/-1;display:grid !important;grid-template-columns:repeat(2,minmax(0,1fr))}.dpg-kpis{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media (max-width:899px){.dpg-grid{grid-template-columns:1fr}.dpg-right{grid-template-columns:1fr !important}.dpg-kpis{grid-template-columns:1fr 1fr}.dpg-path button{min-width:96px;flex:0 0 auto}.dpg-path button span{display:none}}
`

function dayLabel(iso: string) {
  const d = new Date(iso); const t = localISO(); const k = localISO(d)
  if (k === t) return 'Today'
  const y = new Date(); y.setDate(y.getDate() - 1)
  if (k === localISO(y)) return 'Yesterday'
  return fmtDate(k, true)
}
const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

export function DealPage({ dealId, onClose, onChanged }: { dealId: string; onClose: () => void; onChanged?: (card: Deal) => void }) {
  const [d, setD] = useState<PageData | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [moving, setMoving] = useState<string | null>(null)
  const [tab, setTab] = useState<'note' | 'call' | 'email' | 'task' | 'meeting'>('note')
  const [filter, setFilter] = useState('all')
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState({ text: '', subject: '', contact: '', outcome: '', minutes: '', follow: '', date: localISO(), time: '10:00', to: '' })
  const [fileCat, setFileCat] = useState('document')
  const [uploading, setUploading] = useState(false)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t) }, [toast])

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/sales/deals/${dealId}/page`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Could not load the deal.')
      setD(data as PageData); setErr(null)
      onChanged?.(data.card as Deal)
      return data as PageData
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not load the deal.'); return null }
  }, [dealId, onChanged])
  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const k = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || moving) return
      const t = e.target as HTMLElement | null
      if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) { t.blur(); return }
      e.stopImmediatePropagation(); onClose()
    }
    window.addEventListener('keydown', k, true)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', k, true) }
  }, [onClose, moving])

  const save = useCallback(async (k: string, v: unknown) => {
    try {
      const res = await fetch(`/api/sales/deals/${dealId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [k]: v }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Could not save.')
      await load(); return true
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save.'); return false }
  }, [dealId, load])

  const act = useCallback(async (body: Row, done?: string) => {
    try {
      const res = await fetch(`/api/sales/deals/${dealId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Could not save.')
      await load(); if (done) setToast(done); return true
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save.'); return false }
  }, [dealId, load])

  const contactCall = useCallback(async (method: 'POST' | 'PATCH' | 'DELETE', body?: Row, contactId?: string) => {
    const url = `/api/crm/opportunities/${dealId}/contacts${method === 'DELETE' ? `?contactId=${contactId}` : ''}`
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setErr(data?.error ?? 'Could not save the contact.'); return false }
    await load(); return true
  }, [dealId, load])

  const followUp = async (who: string) => {
    if (!f.follow) return true
    const due = new Date(); due.setDate(due.getDate() + Number(f.follow)); due.setHours(9, 0, 0, 0)
    return act({ action: 'add_activity', type: 'call', subject: `Follow up${who ? ` with ${who}` : ''}`, due_at: due.toISOString() })
  }

  async function submitComposer() {
    if (!d || busy) return
    setBusy(true); setErr(null)
    try {
      let ok = false
      if (tab === 'note') {
        if (!f.text.trim()) return
        ok = await act({ action: 'add_activity', type: 'note', subject: f.text.trim().split('\n')[0].slice(0, 80), body: f.text.trim(), done: true, contact_name: f.contact || null })
        ok = ok && await followUp(f.contact)
      } else if (tab === 'call') {
        ok = await act({ action: 'add_activity', type: 'call', subject: `Call${f.contact ? ` with ${f.contact}` : ''}`, body: f.text.trim() || null, outcome: f.outcome || null, duration_min: f.minutes || null, contact_name: f.contact || null, done: true })
        ok = ok && await followUp(f.contact)
      } else if (tab === 'meeting') {
        if (!f.subject.trim()) return
        ok = await act({ action: 'add_activity', type: 'meeting', subject: f.subject.trim(), body: f.text.trim() || null, contact_name: f.contact || null, due_at: new Date(`${f.date}T${f.time}:00`).toISOString() })
      } else if (tab === 'task') {
        if (!f.subject.trim()) return
        const res = await fetch('/api/todos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: f.subject.trim(), body: f.text.trim() || null, due_date: f.date || null, priority: 'normal', linked_type: 'opportunity', linked_id: dealId, linked_label: d.card.name }) })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error ?? 'Could not create the task.')
        await load(); ok = true
      } else if (tab === 'email') {
        if (!f.to.trim() || !f.subject.trim() || !f.text.trim()) { setErr('Add a recipient, subject and message.'); return }
        const res = await fetch(`/api/crm/opportunities/${dealId}/emails/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: f.to.trim(), subject: f.subject.trim(), text: f.text.trim() }) })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error ?? 'Could not send the email.')
        await load(); ok = true
      }
      if (ok) { setF(prev => ({ ...prev, text: '', subject: '', outcome: '', minutes: '', follow: '' })); setToast(tab === 'email' ? 'Email sent' : tab === 'task' ? 'Task added — it\'s in Tasks too' : 'Saved to the timeline') }
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save.') }
    finally { setBusy(false) }
  }

  async function upload(files: FileList) {
    setUploading(true); setErr(null)
    try {
      for (const file of Array.from(files)) {
        const u = await fetch(`/api/nexus/opps/opportunity-window/${dealId}/attachment-url`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: file.name, category: fileCat }) })
        const uj = await u.json().catch(() => ({}))
        if (!u.ok) throw new Error(uj.error || 'Could not start the upload.')
        const put = await fetch(uj.signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file })
        if (!put.ok) throw new Error('Upload failed.')
        const rec = await fetch(`/api/nexus/opps/opportunity-window/${dealId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add_attachment', file_name: file.name, url: uj.publicUrl, file_type: file.type || null, size_bytes: file.size, category: fileCat }) })
        const rj = await rec.json().catch(() => ({}))
        if (!rec.ok || rj.success === false) throw new Error(rj.message || 'Could not save the file.')
      }
      await load(); setToast('File uploaded')
    } catch (e) { setErr(e instanceof Error ? e.message : 'Upload failed.') }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  async function depositInvoice() {
    if (!d) return
    const amt = Number(d.deal.est_deposit)
    if (!amt) { setErr('Set the deposit amount first (Money → Deposit).'); document.getElementById('dp-est_deposit')?.focus(); return }
    setBusy(true)
    try {
      const res = await fetch('/api/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ opportunity_id: dealId, notes: `Deposit — ${d.card.name}`, line_items: [{ service_type: 'one_time', description: `Deposit — ${d.card.name}`, qty: 1, unit_price: amt, is_recurring: false }] }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Could not create the invoice.')
      await load(); setToast('Deposit invoice created (draft) — open Billing to send it')
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not create the invoice.') }
    finally { setBusy(false) }
  }

  const fix = (key: string) => {
    if (!d) return
    if (key === 'steps') { setTab('task'); composerRef.current?.scrollIntoView({ block: 'center' }); setTimeout(() => document.getElementById('dpg-subject')?.focus(), 50); return }
    if (key === 'contacts') { document.getElementById('dp-sec-people')?.scrollIntoView({ block: 'center' }); return }
    if (key === 'quote') { window.location.href = d.primaryQuoteId ? `/quotes/${d.primaryQuoteId}` : `/quotes/new?opportunity_id=${dealId}`; return }
    if (key === 'stage') { const i = stageIndex(d.card.stage); if (i >= 0 && i < STAGES.length - 1) setMoving(STAGES[i + 1].key); return }
    const el = document.getElementById(`dp-${key}`) as HTMLInputElement | null
    if (el) { el.scrollIntoView({ block: 'center' }); el.focus() }
  }

  const shown = useMemo(() => {
    if (!d) return []
    const kinds = FILTERS.find(x => x.key === filter)?.kinds ?? []
    return kinds.length ? d.timeline.filter(t => kinds.includes(t.kind)) : d.timeline
  }, [d, filter])
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const x of FILTERS) c[x.key] = x.kinds.length ? (d?.timeline ?? []).filter(t => x.kinds.includes(t.kind)).length : (d?.timeline ?? []).length
    return c
  }, [d])

  const shell = (inner: React.ReactNode) => createPortal(
    <div className="sb-root dpg" role="dialog" aria-modal="true" aria-label="Deal">
      <style dangerouslySetInnerHTML={{ __html: SALES_CSS + PAGE_CSS }} />
      <div className="sb-main">{inner}</div>
      {moving && d && (
        <MoveDialog deal={d.card} to={moving} onCancel={() => setMoving(null)}
          onDone={card => { setMoving(null); setToast(card.tab === 'won' ? 'Marked won 🎉' : card.tab === 'lost' ? 'Marked lost' : `Moved to ${card.stage_label}`); void load() }} />
      )}
      {toast && <div className="sb-toast" role="status">{toast}</div>}
    </div>, document.body)

  if (!d) return shell(<>
    <button type="button" className="sb-back" onClick={onClose}>‹ Back</button>
    <div className="sb-empty">{err ?? 'Loading deal…'}</div>
  </>)

  const { deal, card, health, can } = d
  const closed = card.tab === 'won' || card.tab === 'lost'
  const si = stageIndex(card.stage)
  const primary = d.quotes.find(q => q.id === d.primaryQuoteId) ?? null
  const differs = primary && can.money && (Number(primary.total_mrr ?? 0) !== Number(deal.est_mrr ?? 0) || Number(primary.total_one_time ?? 0) !== Number(deal.install_fee ?? 0))
  const today = localISO()
  const closePassed = !!card.close_date && card.close_date < today && !closed
  const daysTo = card.close_date ? Math.round((Date.parse(card.close_date) - Date.parse(today)) / 86400000) : null
  const depositInv = d.invoices[0] ?? null
  const fileCounts = FILE_CATS.map(c => ({ ...c, n: d.files.filter(x => (x.category ?? 'document') === c.key).length })).filter(c => c.n > 0)
  const created = deal.created_at ? Math.max(0, Math.round((Date.now() - Date.parse(deal.created_at)) / 86400000)) : null
  const contactsWithEmail = d.contacts.filter(c => c.contact_email)
  const hc = health ? (health.score >= 80 ? '#30A14E' : health.score >= 60 ? '#FF9500' : '#FF3B30') : '#AEAEB2'

  let lastDay = ''
  return shell(<>
    <div><button type="button" className="sb-back" onClick={onClose}>‹ Back</button></div>
    <div className="dpg-hd">
      <div style={{ minWidth: 0 }}>
        <div className="dpg-key">{card.key} · {card.tab === 'won' ? 'WON' : card.tab === 'lost' ? 'LOST' : 'OPPORTUNITY'}{card.type ? ` · ${String(card.type).toUpperCase()}` : ''}</div>
        <h1>{card.name}</h1>
        <div className="dpg-sub">
          {[card.account, card.city].filter(Boolean).join(' · ')}{card.account || card.city ? ' · ' : ''}Owner <b>{d.owner ?? '—'}</b>
          {d.dealer && <> · Dealer <b>{d.dealer}</b></>}{created != null && <> · Created {fmtDate(deal.created_at)} ({created} days)</>}
        </div>
      </div>
      <div className="dpg-acts">
        {card.tab !== 'won' && <button type="button" className="dpg-dark g" onClick={() => setMoving('won')}>✓ Mark won</button>}
        {card.tab !== 'lost' && <button type="button" className="dpg-dark" onClick={() => setMoving('lost')}>✕ Mark lost</button>}
        <a className="dpg-dark b" href={`/quotes/new?opportunity_id=${deal.id}`}>+ Create quote</a>
        <button type="button" className="dpg-dark" onClick={() => { setTab('call'); composerRef.current?.scrollIntoView({ block: 'center' }) }}>☎ Log call</button>
        <button type="button" className="dpg-dark" onClick={() => { setTab('email'); composerRef.current?.scrollIntoView({ block: 'center' }) }}>✉ Email</button>
        {card.tab === 'archived'
          ? <button type="button" className="dpg-dark" onClick={() => void act({ action: 'unarchive' }, 'Restored to the board')}>Restore</button>
          : !closed && <button type="button" className="dpg-dark" onClick={() => { if (confirm('Archive this deal? It leaves the board; you can restore it later.')) void act({ action: 'archive' }, 'Archived') }}>Archive</button>}
      </div>
    </div>

    <div className="dpg-path" role="group" aria-label="Stage">
      {STAGES.map((s, i) => {
        const days = d.stageDays[s.key]
        const cls = closed ? (i <= 5 ? 'done' : '') : i < si ? 'done' : i === si ? 'on' : ''
        return (
          <button key={s.key} type="button" className={cls} aria-current={!closed && i === si ? 'step' : undefined} onClick={() => { if (closed || i !== si) setMoving(s.key) }} title={`Move to ${s.label}`}>
            {s.label}<span>{!closed && i === si ? `${card.days_in_stage}d · ${card.probability}%` : days != null ? `${days} day${days === 1 ? '' : 's'}` : ' '}</span>
          </button>
        )
      })}
      <button type="button" className={card.tab === 'won' ? 'won' : card.tab === 'lost' ? 'lost' : ''} onClick={() => { if (!closed) setMoving('won') }}>
        {card.tab === 'lost' ? 'Lost' : 'Won'}<span>{card.tab === 'won' ? fmtDate(card.won_at) : card.tab === 'lost' ? (card.lost_reason ?? '') : ' '}</span>
      </button>
    </div>

    <div className="dpg-kpis">
      {can.money && <div className="dpg-k"><div className="l">Monthly (MRR)</div><div className="v">{money(card.mrr, false)}</div><div className="s">{primary && !d.valuesLocked ? `from quote ${primary.quote_number ?? ''}` : 'entered on the deal'}</div></div>}
      {can.money && <div className="dpg-k"><div className="l">Install fee</div><div className="v">{money(deal.install_fee ?? deal.est_setup, false)}</div><div className="s">{primary && !d.valuesLocked ? `from quote ${primary.quote_number ?? ''}` : 'entered on the deal'}</div></div>}
      {can.money && <div className="dpg-k"><div className="l">Total contract (TCV)</div><div className="v">{money(card.tcv, false)}</div><div className="s">{deal.contract_term ? `${deal.contract_term} months` : 'assumes 36 months'}</div></div>}
      {can.money && <div className="dpg-k"><div className="l">Weighted</div><div className="v">{money(card.weighted, false)}</div><div className="s">{card.probability}% · {card.stage_label}</div></div>}
      <div className="dpg-k"><div className="l">Expected close</div><div className="v">{card.close_date ? fmtDate(card.close_date) : '—'}</div>
        <div className={`s${closePassed ? ' r' : ''}`}>{!card.close_date ? 'not set' : closePassed ? `${-(daysTo ?? 0)} days past — update it` : daysTo === 0 ? 'today' : `in ${daysTo} days`}</div></div>
      {can.money && <div className="dpg-k"><div className="l">Deposit</div><div className="v">{money(deal.est_deposit, false)}</div>
        <div className={`s${depositInv?.paid_at ? ' g' : ''}`}>{depositInv ? `${depositInv.invoice_number} · ${depositInv.paid_at ? 'paid' : depositInv.status}` : <button type="button" className="sb-link sm" onClick={() => void depositInvoice()} disabled={busy}>Create deposit invoice</button>}</div></div>}
      <div className="dpg-k" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <svg className="dpg-ring" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" fill="none" stroke="#EEF0F4" strokeWidth="4" /><circle cx="18" cy="18" r="15" fill="none" stroke={hc} strokeWidth="4" strokeDasharray={`${((health?.score ?? 0) / 100) * 94} 94`} strokeLinecap="round" transform="rotate(-90 18 18)" /><text x="18" y="22" textAnchor="middle" fontSize="10" fontWeight="600" fill="#1D1D1F">{health ? health.score : '—'}</text></svg>
        <div style={{ minWidth: 0 }}><div className="l">Deal health</div><div className="v" style={{ fontSize: 16 }}>{health ? health.label : card.tab === 'won' ? 'Won' : 'Closed'}</div>
          <div className={`s${health && health.risks.length ? ' r' : ''}`}>{health ? (health.risks.length ? `${health.risks.length} risk${health.risks.length === 1 ? '' : 's'}` : 'No risks') : ''}</div></div>
      </div>
    </div>

    {err && <div className="sb-err" role="alert">{err} <button type="button" className="sb-link sm" onClick={() => setErr(null)}>Dismiss</button></div>}

    <div className="dpg-grid">
      <div className="dpg-card">
        <div className="dpg-ch">About this deal</div>
        <div className="dp-body">
          <DealFields dealId={dealId} d={{ deal, card, contacts: d.contacts, reps: d.reps, can }} save={save} contactCall={contactCall} reload={load} setErr={setErr}
            only={['deal', 'qual', 'people', 'money', 'property', 'scope']} />
        </div>
      </div>

      <div className="dpg-card">
        <div className="dpg-comp">
          <div className="dpg-tabs" role="tablist" aria-label="Add to the timeline">
            {(['note', 'call', 'email', 'task', 'meeting'] as const).map(t => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} aria-pressed={tab === t} onClick={() => setTab(t)}>{t === 'call' ? 'Log call' : t[0].toUpperCase() + t.slice(1)}</button>
            ))}
          </div>
          {tab === 'email' && (
            <div className="dpg-row2">
              <select className="sb-in" value={f.to} onChange={e => setF({ ...f, to: e.target.value })} aria-label="To">
                <option value="">{contactsWithEmail.length ? 'Send to…' : 'No contact emails — add one'}</option>
                {contactsWithEmail.map(c => <option key={c.id} value={c.contact_email}>{c.contact_name} · {c.contact_email}</option>)}
              </select>
              <input className="sb-in" style={{ flex: 1, minWidth: 160 }} placeholder="Subject" value={f.subject} onChange={e => setF({ ...f, subject: e.target.value })} aria-label="Subject" />
            </div>
          )}
          {(tab === 'task' || tab === 'meeting') && (
            <div className="dpg-row2">
              <input id="dpg-subject" className="sb-in" style={{ flex: 1, minWidth: 160 }} placeholder={tab === 'task' ? 'Task — e.g. Send deposit invoice to Tina' : 'Meeting — e.g. GM review at the dealership'} value={f.subject} onChange={e => setF({ ...f, subject: e.target.value })} aria-label="Title" />
              <input className="sb-in" type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} aria-label="Date" />
              {tab === 'meeting' && <input className="sb-in" type="time" value={f.time} onChange={e => setF({ ...f, time: e.target.value })} aria-label="Time" />}
            </div>
          )}
          <textarea ref={composerRef} className="sb-in" rows={3} value={f.text} onChange={e => setF({ ...f, text: e.target.value })} aria-label="Details"
            placeholder={tab === 'note' ? 'Write a note…' : tab === 'call' ? 'What was said? (optional)' : tab === 'email' ? 'Write your email — it sends from your Gmail and lands on this timeline' : 'Details (optional)'}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submitComposer() }} />
          <div className="dpg-row2">
            {tab !== 'email' && tab !== 'task' && (
              <select className="sb-in" value={f.contact} onChange={e => setF({ ...f, contact: e.target.value })} aria-label="Contact">
                <option value="">{tab === 'call' ? 'Who did you speak to?' : 'Contact (optional)'}</option>
                {d.contacts.map(c => <option key={c.id} value={c.contact_name}>{c.contact_name}</option>)}
              </select>
            )}
            {tab === 'call' && <>
              <select className="sb-in" value={f.outcome} onChange={e => setF({ ...f, outcome: e.target.value })} aria-label="Outcome"><option value="">Outcome</option>{CALL_OUTCOMES.map(o => <option key={o}>{o}</option>)}</select>
              <input className="sb-in" style={{ width: 90 }} inputMode="numeric" placeholder="Minutes" value={f.minutes} onChange={e => setF({ ...f, minutes: e.target.value.replace(/\D/g, '') })} aria-label="Minutes" />
            </>}
            {(tab === 'note' || tab === 'call') && (
              <select className="sb-in" value={f.follow} onChange={e => setF({ ...f, follow: e.target.value })} aria-label="Follow-up">
                <option value="">No follow-up</option><option value="1">Follow up tomorrow</option><option value="2">Follow up in 2 days</option><option value="7">Follow up in a week</option>
              </select>
            )}
            <span style={{ flex: 1 }} />
            <button type="button" className="sb-btn pri" disabled={busy} onClick={() => void submitComposer()}>{busy ? 'Saving…' : tab === 'email' ? 'Send' : tab === 'task' ? 'Add task' : tab === 'meeting' ? 'Book' : 'Save'}</button>
          </div>
        </div>

        {d.upcoming.length > 0 && (
          <div className="dpg-up">
            <div className="dpg-ut">Coming up · {d.upcoming.length}</div>
            {d.upcoming.map(u => {
              const late = !!u.due && u.due.slice(0, 10) < today
              return (
                <div key={`${u.source}-${u.id}`} className="dp-row" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.06)' }}>
                  <span className={`sb-act ${late ? 'late' : u.due?.slice(0, 10) === today ? 'today' : 'ok'}`}>{late ? 'Overdue' : u.due ? fmtDate(u.due.slice(0, 10)) : 'No date'}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>{u.title} <span className="sb-sub">· {u.type}{u.key ? ` · ${u.key}` : ''}</span></span>
                  {u.source === 'activity'
                    ? <button type="button" className="sb-link sm" onClick={() => void act({ action: 'complete_activity', activity_id: u.id }, 'Done')}>Done</button>
                    : <button type="button" className="sb-link sm" onClick={async () => { const r = await fetch(`/api/todos/${u.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'done' }) }); if (r.ok) { await load(); setToast('Task done') } else setErr('Could not complete the task.') }}>Done</button>}
                </div>
              )
            })}
          </div>
        )}

        <div className="dpg-flt" role="group" aria-label="Filter timeline">
          {FILTERS.filter(x => x.key === 'all' || counts[x.key] > 0).map(x => (
            <button key={x.key} type="button" className="sb-chip" aria-pressed={filter === x.key} onClick={() => setFilter(x.key)}>{x.label} <b>{counts[x.key]}</b></button>
          ))}
        </div>
        <div className="dpg-tl">
          {shown.length === 0 && <div className="sb-sub" style={{ padding: '16px 0' }}>Nothing here yet.</div>}
          {shown.map(t => {
            const day = dayLabel(t.at)
            const head = day !== lastDay ? <div className="dpg-day">{day}</div> : null
            lastDay = day
            return (
              <div key={t.id}>
                {head}
                <div className="dpg-ev">
                  <span className="dp-ic" aria-hidden="true">{ICON[t.kind] ?? '•'}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <b>{t.href ? <a href={t.href} target="_blank" rel="noreferrer">{t.title}</a> : t.title}</b>
                    <span className="m"> · {[t.who, time(t.at), t.meta].filter(Boolean).join(' · ')}</span>
                    {t.body && <div className="body">{t.body}</div>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="dpg-right" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="dpg-card">
          <div className="dpg-ch">Quotes<a href={`/quotes/new?opportunity_id=${deal.id}`}>+ New quote</a></div>
          {d.quotes.length === 0 && <div className="sb-sub" style={{ padding: 16 }}>No quotes yet. Create one — the customer, contact, property and scope fill in from this deal.</div>}
          {primary && (
            <div className="dpg-q">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="sb-key" style={{ marginLeft: 0 }}>{primary.quote_number}</span>
                <span className={`sb-pill ${primary.status === 'accepted' ? 'late-stage' : primary.status === 'declined' ? 'late' : 'mid'}`}>{primary.status}</span>
                <span className="sb-pill mid">Primary</span>
                <a className="sb-link sm" style={{ marginLeft: 'auto' }} href={`/quotes/${primary.id}`}>Open</a>
              </div>
              {primary.title && <div style={{ fontWeight: 600, marginTop: 4 }}>{primary.title}</div>}
              {can.money && <div className="dpg-qm"><div><div className="l">Monthly</div><div className="v">{money(primary.total_mrr, false)}</div></div><div><div className="l">One-time</div><div className="v">{money(primary.total_one_time, false)}</div></div><div><div className="l">Views</div><div className="v">{primary.view_count ?? 0}</div></div></div>}
              {can.money && (differs
                ? <div className="dpg-sync diff">Deal values differ from this quote<button type="button" className="sb-link sm" style={{ marginLeft: 'auto' }} onClick={() => void act({ action: 'use_quote_values' }, 'Deal values now follow the quote')}>Use quote values</button></div>
                : <div className="dpg-sync ok">✓ Deal values match this quote</div>)}
            </div>
          )}
          {d.quotes.filter(q => q.id !== d.primaryQuoteId).map(q => (
            <div key={q.id} className="dpg-rel">
              <span className="sb-key" style={{ marginLeft: 0 }}>{q.quote_number}</span>
              <span className={`sb-pill ${q.status === 'accepted' ? 'late-stage' : q.status === 'declined' ? 'late' : 'early'}`}>{q.status}</span>
              {can.money && <span className="sb-sub">{money(q.total_mrr)}/mo</span>}
              <button type="button" className="sb-link sm" style={{ marginLeft: 'auto' }} onClick={() => void act({ action: 'set_primary_quote', quote_id: q.id }, 'Primary quote changed — deal values updated')}>Make primary</button>
              <a className="sb-link sm" style={{ marginLeft: 0 }} href={`/quotes/${q.id}`}>Open</a>
            </div>
          ))}
        </div>

        {health && (
          <div className="dpg-card">
            <div className="dpg-ch">Deal health · {health.score}</div>
            <div style={{ padding: '6px 16px 12px' }}>
              {health.risks.map(r => (
                <div key={r.key} className="dpg-risk"><span className="dot" style={{ background: r.level === 'red' ? '#FF3B30' : '#FF9500' }} />{r.text}
                  <button type="button" onClick={() => fix(r.fix)}>{r.fix === 'quote' ? (d.primaryQuoteId ? 'Open quote' : 'Create') : r.fix === 'steps' ? 'Add step' : r.fix === 'contacts' ? 'Add' : r.fix === 'stage' ? 'Move' : 'Set'}</button></div>
              ))}
              {health.ok.length > 0 && <div className="dpg-risk"><span className="dot" style={{ background: '#30A14E' }} />{health.ok.map(x => x[0].toUpperCase() + x.slice(1)).join(' · ')}</div>}
            </div>
          </div>
        )}

        <div className="dpg-card">
          <div className="dpg-ch">Files &amp; photos
            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <select className="sb-in" style={{ minHeight: 28, fontSize: 12 }} value={fileCat} onChange={e => setFileCat(e.target.value)} aria-label="File type">{FILE_CATS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? 'Uploading…' : 'Upload'}</button>
            </span>
          </div>
          <input ref={fileRef} type="file" multiple hidden onChange={e => { if (e.target.files?.length) void upload(e.target.files) }} />
          {fileCounts.length > 0
            ? <div className="dpg-files">{fileCounts.map(c => <div key={c.key}><b>{c.n}</b>{c.label}</div>)}</div>
            : <div className="sb-sub" style={{ padding: 16 }}>No files yet.</div>}
          {d.files.slice(0, 5).map(x => <div key={x.id} className="dpg-rel"><span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.file_name}</span><a href={x.url} target="_blank" rel="noreferrer">Open</a></div>)}
        </div>

        <div className="dpg-card">
          <div className="dpg-ch">Related</div>
          {d.lead && <div className="dpg-rel"><span className="sb-pill mid">Lead</span>{d.lead.contact_name || d.lead.company_name || 'Lead'}<a href={`/crm/leads/${d.lead.id}`}>Open</a></div>}
          {d.aria && <div className="dpg-rel"><span className="sb-pill mid">ARIA</span>{d.aria.property_name}{d.aria.buy_score != null ? ` · score ${d.aria.buy_score}` : ''}<a href="/aria">Open</a></div>}
          {d.surveys.map(s => <div key={s.id} className="dpg-rel"><span className="sb-pill mid">Survey</span>{s.survey_number ?? 'Site survey'} · {fmtDate(s.survey_date ?? s.created_at?.slice(0, 10))}{Array.isArray(s.devices) ? ` · ${s.devices.length} devices` : ''}<a href="/survey">Open</a></div>)}
          {d.invoices.map(i => <div key={i.id} className="dpg-rel"><span className="sb-pill early">Invoice</span>{i.invoice_number}{can.money && i.total != null ? ` · ${money(i.total, false)}` : ''} · {i.paid_at ? 'paid' : i.status}<a href="/billing">Open</a></div>)}
          {d.jobs.map(j => <div key={j.id} className="dpg-rel"><span className="sb-pill late-stage">Job</span>{j.wo_number ? `${j.wo_number} · ` : ''}{j.title}<a href={`/maintenance/${j.id}`}>Open</a></div>)}
          {d.todos.filter(t => t.status !== 'done').length > 0 && <div className="dpg-rel"><span className="sb-pill mid">Tasks</span>{d.todos.filter(t => t.status !== 'done').length} open task{d.todos.filter(t => t.status !== 'done').length === 1 ? '' : 's'}<a href={`/?tab=my-day`}>Tasks</a></div>}
          {!d.lead && !d.aria && !d.surveys.length && !d.invoices.length && !d.jobs.length && <div className="sb-sub" style={{ padding: 16 }}>Nothing linked yet.</div>}
          <div className="dpg-rel" style={{ color: '#6E6E73' }}><span className="sb-av">{initials(d.owner)}</span>Owner · {d.owner ?? '—'}{d.threads > 0 && <span className="sb-sub" style={{ marginLeft: 'auto' }}>{d.threads} email thread{d.threads === 1 ? '' : 's'}</span>}</div>
        </div>
      </div>
    </div>
  </>)
}

export default DealPage
