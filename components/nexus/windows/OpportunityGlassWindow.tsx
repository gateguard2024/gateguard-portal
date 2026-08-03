'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { NexusGlassBackButton } from '@/components/nexus/NexusGlassBackButton'

type AnyRecord = Record<string, any>
const WIN_FRAME = { background: 'repeating-linear-gradient(90deg,rgba(255,255,255,0.03) 0 1px,transparent 1px 4px), linear-gradient(180deg,#1b2836,#0f1822)', border: '1px solid rgba(140,170,200,0.24)', boxShadow: '0 26px 54px rgba(0,0,0,0.55), inset 0 1px 0 rgba(190,215,240,0.10), inset 0 -2px 2px rgba(0,0,0,0.4)' } as const

type OpportunityGlassData = {
  opportunity?: AnyRecord | null
  lead?: AnyRecord | null
  company?: AnyRecord | null
  contact?: AnyRecord | null
  property?: AnyRecord | null
  activities?: AnyRecord[]
  todos?: AnyRecord[]
  attachments?: AnyRecord[]
  quote?: AnyRecord | null
  nextBestActions?: Array<{ title: string; subtitle: string; action: string }>
  canReassign?: boolean
}

function val(v: unknown, fallback = 'Not added yet') {
  if (v === null || v === undefined || v === '') return fallback
  return String(v)
}

function Section({ title, children, count }: { title: string; children: React.ReactNode; count?: number }) {
  return (
    <div className="rounded-3xl p-4" style={{ background: 'repeating-linear-gradient(90deg,rgba(255,255,255,0.04) 0 1px,transparent 1px 4px), linear-gradient(180deg,#2b3c52,#1e2a3a)', border: '1px solid rgba(140,170,200,0.22)', boxShadow: '0 14px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12)' }}>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{title}</div>
        {typeof count === 'number' && count > 0 && (
          <div className="rounded-full px-2 py-1 text-[10px]" style={{ background: 'rgba(95,184,224,0.12)', color: '#9FD8EC' }}>{count}</div>
        )}
      </div>
      {children}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.82)' }}>{text}</div>
}

function MiniRow({ title, subtitle, meta }: { title: string; subtitle?: string; meta?: string }) {
  return (
    <div className="rounded-2xl p-3" style={{ background: 'linear-gradient(180deg,#22303f,#1a2532)', border: '1px solid rgba(140,170,200,0.2)' }}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.84)' }}>{title}</div>
        {meta && <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.82)', whiteSpace: 'nowrap' }}>{meta}</div>}
      </div>
      {subtitle && <div className="mt-1 text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.82)' }}>{subtitle}</div>}
    </div>
  )
}

function ListBlock({ records, emptyText, render }: { records?: AnyRecord[]; emptyText: string; render: (r: AnyRecord) => React.ReactNode }) {
  if (!records || records.length === 0) return <Empty text={emptyText} />
  return <div className="space-y-2">{records.slice(0, 6).map((r, i) => <div key={r.id ?? i}>{render(r)}</div>)}</div>
}

function MiniStat({ label, value: v }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl p-3" style={{ background: 'linear-gradient(180deg,#22303f,#1a2532)', border: '1px solid rgba(140,170,200,0.2)' }}>
      <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.82)' }}>{label}</div>
      <div className="mt-1 truncate text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.82)' }}>{v}</div>
    </div>
  )
}

// Format currency amounts
function formatMoney(v: unknown): string {
  const n = Number(v)
  if (!v || isNaN(n)) return 'Not set'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k`
  return `$${n.toLocaleString()}`
}

// Human date/time — never show a raw ISO string to the user.
function fmtWhen(v: unknown): string {
  if (!v) return ''
  const d = new Date(String(v))
  if (isNaN(d.getTime())) return String(v)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}
function fmtDate(v: unknown): string {
  if (!v) return ''
  const d = new Date(String(v))
  if (isNaN(d.getTime())) return String(v)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function OpportunityGlassWindow({
  data,
  onBack,
  onRefresh,
}: {
  data: OpportunityGlassData
  onBack: () => void
  onRefresh?: () => Promise<void> | void
}) {
  const opp = data.opportunity ?? {}
  const lead = data.lead
  const company = data.company
  const contact = data.contact
  const property = data.property
  const activities = data.activities ?? []
  const todos = data.todos ?? []
  const attachments = data.attachments ?? []
  const quote = data.quote
  const nextBestActions = data.nextBestActions ?? []

  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const oppIdStr = opp.id as string | undefined

  // ── File upload (signed URL → PUT → record via add_attachment) ──────────────
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileBusy, setFileBusy] = useState(false)
  async function uploadFile(file: File) {
    if (!oppIdStr) return
    setFileBusy(true); setMsg(null)
    try {
      const urlRes = await fetch(`/api/nexus/opps/opportunity-window/${oppIdStr}/attachment-url`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: file.name }) })
      const u = await urlRes.json()
      if (!urlRes.ok) { setMsg({ ok: false, text: u.error || 'Could not start upload.' }); return }
      const put = await fetch(u.signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file })
      if (!put.ok) { setMsg({ ok: false, text: 'Upload failed.' }); return }
      const rec = await fetch(`/api/nexus/opps/opportunity-window/${oppIdStr}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add_attachment', file_name: file.name, url: u.publicUrl, file_type: file.type || null, size_bytes: file.size }) })
      const rj = await rec.json().catch(() => ({}))
      if (!rec.ok || rj.success === false) { setMsg({ ok: false, text: rj.message || 'Could not save file.' }); return }
      setMsg({ ok: true, text: 'File attached ✓' })
      await onRefresh?.()
    } catch { setMsg({ ok: false, text: 'Upload failed.' }) }
    finally { setFileBusy(false); if (fileRef.current) fileRef.current.value = '' }
  }

  // ── Schedule follow-up (popup) ──────────────────────────────────────────────
  const [followupOpen, setFollowupOpen] = useState(false)
  const [fu, setFu] = useState({ title: '', due_date: '', notes: '' })
  const [fuBusy, setFuBusy] = useState(false)
  async function submitFollowup() {
    if (!oppIdStr) return
    setFuBusy(true)
    try {
      const r = await fetch(`/api/nexus/opps/opportunity-window/${oppIdStr}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'schedule_followup', title: fu.title || `Follow up: ${opp.name || opp.account_name || 'opportunity'}`, due_date: fu.due_date || null, notes: fu.notes || null }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || j.success === false) { setMsg({ ok: false, text: j.message || 'Could not schedule.' }); return }
      setFollowupOpen(false); setFu({ title: '', due_date: '', notes: '' })
      setMsg({ ok: true, text: 'Follow-up scheduled ✓' })
      await onRefresh?.()
    } catch { setMsg({ ok: false, text: 'Could not schedule.' }) }
    finally { setFuBusy(false) }
  }

  // ── Log activity (call / email / note / meeting) ────────────────────────────
  const [actOpen, setActOpen] = useState(false)
  const [act, setAct] = useState<{ type: string; subject: string; body: string; outcome: string; due_at: string }>({ type: 'note', subject: '', body: '', outcome: '', due_at: '' })
  const [actBusy, setActBusy] = useState(false)
  async function submitActivity() {
    if (!oppIdStr || !act.subject.trim()) return
    setActBusy(true)
    try {
      const r = await fetch(`/api/nexus/opps/opportunity-window/${oppIdStr}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'log_activity', type: act.type, subject: act.subject, body: act.body || null, outcome: act.outcome || null, due_at: act.due_at || null }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || j.success === false) { setMsg({ ok: false, text: j.message || 'Could not log activity.' }); return }
      setActOpen(false); setAct({ type: 'note', subject: '', body: '', outcome: '', due_at: '' })
      setMsg({ ok: true, text: 'Activity logged ✓' })
      await onRefresh?.()
    } catch { setMsg({ ok: false, text: 'Could not log activity.' }) }
    finally { setActBusy(false) }
  }

  // ── Task complete / delete (todos) ──────────────────────────────────────────
  const [taskBusy, setTaskBusy] = useState<string | null>(null)
  async function completeTask(todoId: string, done: boolean) {
    setTaskBusy(todoId)
    try {
      const r = await fetch(`/api/todos/${todoId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: done ? 'done' : 'open' }) })
      if (!r.ok) { setMsg({ ok: false, text: 'Could not update task.' }); return }
      await onRefresh?.()
    } catch { setMsg({ ok: false, text: 'Could not update task.' }) }
    finally { setTaskBusy(null) }
  }
  async function deleteTask(todoId: string) {
    if (!confirm('Delete this task?')) return
    setTaskBusy(todoId)
    try {
      const r = await fetch(`/api/todos/${todoId}`, { method: 'DELETE' })
      if (!r.ok) { setMsg({ ok: false, text: 'Could not delete task.' }); return }
      await onRefresh?.()
    } catch { setMsg({ ok: false, text: 'Could not delete task.' }) }
    finally { setTaskBusy(null) }
  }

  // ── Remove an attachment ────────────────────────────────────────────────────
  const [fileRmBusy, setFileRmBusy] = useState<string | null>(null)
  async function removeFile(attId: string) {
    if (!oppIdStr || !confirm('Remove this file?')) return
    setFileRmBusy(attId)
    try {
      const r = await fetch(`/api/nexus/opps/opportunity-window/${oppIdStr}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'remove_attachment', attachment_id: attId }) })
      if (!r.ok) { setMsg({ ok: false, text: 'Could not remove file.' }); return }
      await onRefresh?.()
    } catch { setMsg({ ok: false, text: 'Could not remove file.' }) }
    finally { setFileRmBusy(null) }
  }

  // ── Stage path (advance / move stage) ───────────────────────────────────────
  const [stageBusy, setStageBusy] = useState<string | null>(null)
  async function setStage(stage: string) {
    if (!oppIdStr) return
    setStageBusy(stage)
    try {
      const action = stage === 'won' ? 'mark_won' : stage === 'lost' ? 'mark_lost' : 'update_status'
      const r = await fetch(`/api/nexus/opps/opportunity-window/${oppIdStr}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, stage }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || j.success === false) { setMsg({ ok: false, text: j.message || 'Could not update stage.' }); return }
      setOv(prev => ({ ...prev, stage }))
      setMsg({ ok: true, text: `Moved to ${stage} ✓` })
      await onRefresh?.()
    } catch { setMsg({ ok: false, text: 'Could not update stage.' }) }
    finally { setStageBusy(null) }
  }

  // Local overrides so edits show immediately (and persist on save).
  const [ov, setOv] = useState<AnyRecord>({})
  const show = (key: string, fallback?: unknown) => (ov[key] !== undefined ? ov[key] : (opp[key] ?? fallback))
  const [editing, setEditing] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const canReassign = Boolean(data.canReassign)
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignLoading, setAssignLoading] = useState(false)
  const [assignUsers, setAssignUsers] = useState<Array<{ id: string; full_name?: string; email: string }>>([])
  async function openReassign() {
    setAssignOpen(true)
    if (assignUsers.length === 0) {
      setAssignLoading(true)
      try {
        const r = await fetch('/api/admin/users')
        const j = await r.json().catch(() => ({}))
        const list: AnyRecord[] = Array.isArray(j?.users) ? j.users : Array.isArray(j) ? j : []
        setAssignUsers(list.map(u => ({ id: String(u.id ?? u.user_id ?? u.clerk_user_id ?? ''), full_name: u.full_name ?? u.name, email: u.email ?? '' })).filter(u => u.id))
      } catch { /* ignore */ } finally { setAssignLoading(false) }
    }
  }
  async function doReassign(assigneeId: string, name: string) {
    const oppId = opp.id as string | undefined
    if (!oppId) return
    setBusy('reassign_opp'); setMsg(null)
    try {
      const r = await fetch(`/api/nexus/opps/opportunity-window/${oppId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reassign_opp', assignee_id: assigneeId, assignee_name: name }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || j.success === false) throw new Error(j?.message ?? 'Could not reassign.')
      setOv(prev => ({ ...prev, owner_name: name }))
      setMsg({ ok: true, text: j.message ?? 'Reassigned ✓' }); setAssignOpen(false)
      await onRefresh?.()
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not reassign.' }) } finally { setBusy(null) }
  }
  const [f, setF] = useState({
    site_contact_name: '', site_contact_title: '', site_contact_phone: '', site_contact_email: '',
    account_name: '', property_address: '', property_city: '', property_state: '', units: '', next_step: '', notes: '',
  })

  function openEdit() {
    setF({
      site_contact_name:  String(show('site_contact_name', contact ? [contact.first_name, contact.last_name].filter(Boolean).join(' ') : '') ?? ''),
      site_contact_title: String(show('site_contact_title', contact?.title) ?? ''),
      site_contact_phone: String(show('site_contact_phone', contact?.phone) ?? ''),
      site_contact_email: String(show('site_contact_email', contact?.email) ?? ''),
      account_name:       String(show('account_name', company?.name) ?? ''),
      property_address:   String(show('property_address') ?? ''),
      property_city:      String(show('property_city') ?? ''),
      property_state:     String(show('property_state') ?? ''),
      units:              show('units') ? String(show('units')) : '',
      next_step:          String(show('next_step') ?? ''),
      notes:              String(show('notes') ?? ''),
    })
    setMsg(null); setEditing(true)
  }

  async function saveEdit() {
    const oppId = opp.id as string | undefined
    if (!oppId) return
    setSavingEdit(true); setMsg(null)
    try {
      const res = await fetch(`/api/nexus/opps/opportunity-window/${oppId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_details', ...f }) })
      const result = await res.json().catch(() => ({}))
      if (!res.ok || result.success === false) throw new Error(result?.message ?? 'Could not save.')
      // Only reflect fields the server actually stored — never show a dropped field as saved.
      const dropped: string[] = Array.isArray(result.dropped) ? result.dropped : []
      const savedEntries = Object.entries(f).filter(([k]) => !dropped.includes(k))
      const saved = Object.fromEntries(savedEntries)
      setOv(prev => ({ ...prev, ...saved, units: (!dropped.includes('units') && f.units) ? Number(f.units) : prev.units }))
      setEditing(false)
      if (dropped.length) setMsg({ ok: false, text: `Saved, but these didn't stick: ${dropped.join(', ')}` })
      else setMsg({ ok: true, text: 'Saved ✓' })
      await onRefresh?.()
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not save.' }) } finally { setSavingEdit(false) }
  }

  async function handleAction(action: string) {
    const oppId = opp.id as string | undefined
    if (!oppId) return
    if (action === 'update_details') { openEdit(); return }
    // Navigation actions — no API call.
    if (action === 'run_aria') { router.push('/aria'); return }
    if (action === 'generate_quote') { router.push(`/quotes/new?opportunity=${oppId}`); return }

    setBusy(action); setMsg(null)
    try {
      if (action === 'mark_won') {
        const r = await fetch(`/api/crm/opportunities/${oppId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: 'won', won_at: new Date().toISOString() }) })
        setMsg(r.ok ? { ok: true, text: 'Marked won ✓ — now use "Create Project" to start the install job.' } : { ok: false, text: 'Could not update.' })
      } else if (action === 'mark_lost') {
        const reason = typeof window !== 'undefined' ? window.prompt('Why was this lost? (optional)') : ''
        if (reason === null) { setBusy(null); return }
        const r = await fetch(`/api/crm/opportunities/${oppId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: 'lost', lost_at: new Date().toISOString(), lost_reason: reason || null }) })
        setMsg(r.ok ? { ok: true, text: 'Marked lost.' } : { ok: false, text: 'Could not update.' })
      } else if (action === 'create_project') {
        // One home for field jobs = work_orders (Operations Hub board + /tech read this).
        const acct = (opp.account_name ?? company?.name ?? opp.name ?? 'New deal') as string
        const r = await fetch('/api/dispatch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_name: acct, title: `${opp.name || acct} — Install`, job_type: 'Install', priority: 'normal', opportunity_id: oppId, site_id: opp.site_id ?? null, description: (opp.description ?? opp.scope ?? `Install from won opportunity: ${opp.name ?? acct}`) as string }) })
        const j = await r.json().catch(() => ({}))
        setMsg(r.ok ? { ok: true, text: 'Install job created ✓ — find it in Operations → Work Orders and on the assigned tech’s phone.' } : { ok: false, text: j.error || 'Could not create job.' })
      } else if (action === 'schedule_followup') {
        const r = await fetch('/api/todos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: `Follow up: ${opp.name || opp.account_name || 'opportunity'}`, linked_type: 'opportunity', linked_id: oppId }) })
        setMsg(r.ok ? { ok: true, text: 'Follow-up added to your To-Dos ✓' } : { ok: false, text: 'Could not add follow-up.' })
      }
    } catch {
      setMsg({ ok: false, text: 'Something went wrong. Please try again.' })
    } finally {
      setBusy(null)
    }
  }

  // Stage badge color
  const stageMeta = String(opp.stage ?? 'inquiry').toLowerCase()
  const stageColor = ['won'].includes(stageMeta)
    ? '#34d399'
    : ['lost', 'dead'].includes(stageMeta)
    ? '#ef4444'
    : stageMeta === 'proposal' || stageMeta === 'negotiation'
    ? '#fbbf24'
    : '#9FD8EC'

  const editInput = { background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(95,184,224,0.24)', color: 'rgba(255,255,255,0.92)' } as const

  return (
    <>
    <NexusGlassBackButton label="Back to workbench" onClick={onBack} />

    {/* Schedule follow-up popup */}
    {followupOpen && (
      <div onClick={() => setFollowupOpen(false)} className="fixed inset-0 z-[130] flex items-center justify-center p-4" style={{ background: 'rgba(4,10,20,0.8)', backdropFilter: 'blur(6px)' }}>
        <div onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-[1.5rem] p-5" style={{ background: 'linear-gradient(180deg,#1d2a39,#141d28)', border: '1px solid rgba(140,170,200,0.24)', boxShadow: '0 30px 100px rgba(0,0,0,0.55)' }}>
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>Schedule follow-up</h4>
            <button type="button" onClick={() => setFollowupOpen(false)} className="rounded-full px-3 py-1 text-[11px]" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.78)' }}>Close</button>
          </div>
          <div className="space-y-3">
            <input value={fu.title} onChange={e => setFu({ ...fu, title: e.target.value })} placeholder={`Follow up: ${String(opp.name || opp.account_name || 'opportunity')}`} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(95,184,224,0.24)', color: 'rgba(255,255,255,0.92)' }} />
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-wide" style={{ color: 'rgba(159,216,236,0.9)' }}>Due date</label>
              <input type="date" value={fu.due_date} onChange={e => setFu({ ...fu, due_date: e.target.value })} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(95,184,224,0.24)', color: 'rgba(255,255,255,0.92)' }} />
            </div>
            <textarea value={fu.notes} onChange={e => setFu({ ...fu, notes: e.target.value })} placeholder="Notes (optional)…" rows={3} className="w-full resize-none rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(95,184,224,0.24)', color: 'rgba(255,255,255,0.92)' }} />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setFollowupOpen(false)} className="rounded-full px-4 py-2 text-xs" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.72)' }}>Cancel</button>
            <button type="button" disabled={fuBusy} onClick={submitFollowup} className="rounded-full px-4 py-2 text-xs font-semibold disabled:opacity-40" style={{ background: '#2f7fb8', color: 'white' }}>{fuBusy ? 'Scheduling…' : 'Schedule'}</button>
          </div>
        </div>
      </div>
    )}

    {/* Log activity popup */}
    {actOpen && (
      <div onClick={() => setActOpen(false)} className="fixed inset-0 z-[130] flex items-center justify-center p-4" style={{ background: 'rgba(4,10,20,0.8)', backdropFilter: 'blur(6px)' }}>
        <div onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-[1.5rem] p-5" style={{ background: 'linear-gradient(180deg,#1d2a39,#141d28)', border: '1px solid rgba(140,170,200,0.24)', boxShadow: '0 30px 100px rgba(0,0,0,0.55)' }}>
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>Log activity</h4>
            <button type="button" onClick={() => setActOpen(false)} className="rounded-full px-3 py-1 text-[11px]" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.78)' }}>Close</button>
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {(['note', 'call', 'email', 'meeting'] as const).map(t => (
              <button key={t} type="button" onClick={() => setAct({ ...act, type: t })} className="rounded-lg px-2.5 py-1 text-[11px] font-medium capitalize" style={act.type === t ? { background: '#2f7fb8', color: 'white', border: '1px solid #2f7fb8' } : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(140,170,200,0.24)', color: 'rgba(255,255,255,0.7)' }}>{t}</button>
            ))}
          </div>
          <div className="space-y-3">
            <input value={act.subject} onChange={e => setAct({ ...act, subject: e.target.value })} placeholder={act.type === 'call' ? 'Call summary…' : act.type === 'email' ? 'Email subject…' : act.type === 'meeting' ? 'Meeting summary…' : 'Add a note…'} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(95,184,224,0.24)', color: 'rgba(255,255,255,0.92)' }} />
            <textarea value={act.body} onChange={e => setAct({ ...act, body: e.target.value })} placeholder="Details (optional)…" rows={3} className="w-full resize-none rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(95,184,224,0.24)', color: 'rgba(255,255,255,0.92)' }} />
            {(act.type === 'call' || act.type === 'meeting') && (
              <input value={act.outcome} onChange={e => setAct({ ...act, outcome: e.target.value })} placeholder="Outcome (e.g. Connected, Voicemail)…" className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(95,184,224,0.24)', color: 'rgba(255,255,255,0.92)' }} />
            )}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setActOpen(false)} className="rounded-full px-4 py-2 text-xs" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.72)' }}>Cancel</button>
            <button type="button" disabled={actBusy || !act.subject.trim()} onClick={submitActivity} className="rounded-full px-4 py-2 text-xs font-semibold disabled:opacity-40" style={{ background: '#2f7fb8', color: 'white' }}>{actBusy ? 'Logging…' : 'Log it'}</button>
          </div>
        </div>
      </div>
    )}
    <div className="space-y-4 pb-28 rounded-[2rem] p-4 sm:p-5" style={WIN_FRAME}>
      {editing && (
        <div className="fixed inset-0 z-[120] overflow-y-auto px-4 py-4 sm:py-8" style={{ background: 'rgba(0,0,0,0.74)', backdropFilter: 'blur(10px)', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
          <div className="mx-auto flex min-h-full w-full max-w-2xl items-start justify-center">
            <div className="w-full overflow-hidden rounded-[2rem]" style={{ background: 'linear-gradient(180deg, rgba(18,28,52,0.98), rgba(8,14,28,0.98))', border: '1px solid rgba(95,184,224,0.32)', boxShadow: '0 30px 100px rgba(0,0,0,0.55)' }}>
              <div className="sticky top-0 z-10 flex items-start justify-between gap-3 p-5" style={{ background: 'linear-gradient(180deg, rgba(18,28,52,0.98), rgba(18,28,52,0.92))', borderBottom: '1px solid rgba(95,184,224,0.18)' }}>
                <div><div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: '#9FD8EC' }}>Edit Opportunity</div><h3 className="mt-1 text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.96)' }}>Contact &amp; property details</h3></div>
                <button type="button" onClick={() => setEditing(false)} className="rounded-full px-3 py-1.5 text-[11px]" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.78)' }}>Close</button>
              </div>
              <div className="max-h-[calc(100vh-12rem)] overflow-y-auto p-5" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
                <div className="mb-2 text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.5)' }}>Contact</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input value={f.site_contact_name} onChange={e => setF({ ...f, site_contact_name: e.target.value })} placeholder="Contact name" className="rounded-xl px-3 py-2 text-sm outline-none" style={editInput} />
                  <input value={f.site_contact_title} onChange={e => setF({ ...f, site_contact_title: e.target.value })} placeholder="Title" className="rounded-xl px-3 py-2 text-sm outline-none" style={editInput} />
                  <input value={f.site_contact_phone} onChange={e => setF({ ...f, site_contact_phone: e.target.value })} placeholder="Phone" className="rounded-xl px-3 py-2 text-sm outline-none" style={editInput} />
                  <input value={f.site_contact_email} onChange={e => setF({ ...f, site_contact_email: e.target.value })} placeholder="Email" className="rounded-xl px-3 py-2 text-sm outline-none" style={editInput} />
                </div>
                <div className="mb-2 mt-4 text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.5)' }}>Account &amp; property</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input value={f.account_name} onChange={e => setF({ ...f, account_name: e.target.value })} placeholder="Account / company" className="rounded-xl px-3 py-2 text-sm outline-none sm:col-span-2" style={editInput} />
                  <input value={f.property_address} onChange={e => setF({ ...f, property_address: e.target.value })} placeholder="Address" className="rounded-xl px-3 py-2 text-sm outline-none sm:col-span-2" style={editInput} />
                  <input value={f.property_city} onChange={e => setF({ ...f, property_city: e.target.value })} placeholder="City" className="rounded-xl px-3 py-2 text-sm outline-none" style={editInput} />
                  <input value={f.property_state} onChange={e => setF({ ...f, property_state: e.target.value })} placeholder="State" className="rounded-xl px-3 py-2 text-sm outline-none" style={editInput} />
                  <input value={f.units} onChange={e => setF({ ...f, units: e.target.value })} placeholder="Units" className="rounded-xl px-3 py-2 text-sm outline-none" style={editInput} />
                  <input value={f.next_step} onChange={e => setF({ ...f, next_step: e.target.value })} placeholder="Next step" className="rounded-xl px-3 py-2 text-sm outline-none" style={editInput} />
                  <textarea value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} placeholder="Notes" rows={3} className="rounded-xl px-3 py-2 text-sm outline-none resize-none sm:col-span-2" style={editInput} />
                </div>
              </div>
              <div className="sticky bottom-0 flex justify-end gap-2 p-4" style={{ background: 'linear-gradient(0deg, rgba(8,14,28,0.98), rgba(8,14,28,0.90))', borderTop: '1px solid rgba(95,184,224,0.18)' }}>
                <button type="button" onClick={() => setEditing(false)} className="rounded-full px-4 py-2 text-xs" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.72)' }}>Cancel</button>
                <button type="button" disabled={savingEdit} onClick={saveEdit} className="rounded-full px-4 py-2 text-xs disabled:opacity-40" style={{ background: '#2f7fb8', color: 'white' }}>{savingEdit ? 'Saving…' : 'Save Changes'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="rounded-[2rem] p-5" style={{ background: 'repeating-linear-gradient(90deg,rgba(255,255,255,0.04) 0 1px,transparent 1px 4px), linear-gradient(145deg,#33465e,#1e2a3a)', border: '1px solid rgba(95,184,224,0.3)', boxShadow: '0 20px 70px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.12)' }}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: '#9FD8EC' }}>Opportunity</div>
            <h3 className="mt-2 text-2xl font-semibold leading-tight" style={{ color: 'rgba(255,255,255,0.94)' }}>
              {val(opp.name, 'Untitled Opportunity')}
            </h3>
            <div className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {val(show('account_name') ?? company?.name, 'No account attached')}
            </div>
          </div>
          <div className="rounded-2xl px-4 py-3 text-right" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: 'rgba(255,255,255,0.82)' }}>Stage</div>
            <div className="mt-1 text-sm font-semibold" style={{ color: stageColor }}>{val(opp.stage, 'inquiry')}</div>
          </div>
        </div>

        {/* Stage path — click any stage to move the deal there. */}
        {(() => {
          const STAGES = ['inquiry', 'qualified', 'proposal', 'negotiation', 'won']
          const cur = String(show('stage') ?? 'inquiry').toLowerCase()
          const isLost = ['lost', 'dead'].includes(cur)
          const curIdx = STAGES.findIndex(s => cur.includes(s) || s.includes(cur))
          return (
            <div className="mt-4 flex items-stretch gap-1">
              {STAGES.map((s, i) => {
                const done = !isLost && curIdx >= 0 && i < curIdx
                const active = !isLost && i === curIdx
                return (
                  <button key={s} type="button" disabled={stageBusy !== null} onClick={() => setStage(s)}
                    className="flex-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide capitalize transition-colors disabled:opacity-60"
                    style={{ background: active ? '#2f7fb8' : done ? 'rgba(52,211,153,0.16)' : 'rgba(255,255,255,0.05)', border: `1px solid ${active ? '#2f7fb8' : done ? 'rgba(52,211,153,0.4)' : 'rgba(140,170,200,0.24)'}`, color: active ? 'white' : done ? '#6ee7b7' : 'rgba(255,255,255,0.62)' }}>
                    {stageBusy === s ? '…' : s}
                  </button>
                )
              })}
            </div>
          )
        })()}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Monthly $"   value={opp.est_mrr ? formatMoney(opp.est_mrr) : 'Not set'} />
          <MiniStat label="Amount"      value={opp.amount  ? formatMoney(opp.amount)  : 'Not set'} />
          <MiniStat label="Close Date"  value={opp.close_date ? fmtDate(opp.close_date) : 'Not set'} />
          <MiniStat label="Updated"     value={fmtWhen(opp.updated_at ?? opp.created_at) || 'Unknown'} />
        </div>
      </div>

      {/* ── Body ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left col */}
        <div className="space-y-4 lg:col-span-2">

          <Section title="Overview">
            <div className="grid gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.62)' }}>
              <div>Next Step: {val(show('next_step'), 'Not set')}</div>
              <div>Notes: {val(show('notes') ?? opp.description, 'No notes yet')}</div>
              <div>Source: {val(opp.source, 'Unknown')}</div>
              <div>Probability: {opp.probability != null ? `${opp.probability}%` : 'Not set'}</div>
              <div>Forecast: {val(opp.forecast_cat, 'Not set')}</div>
            </div>
          </Section>

          <Section title="People">
            <div className="mb-2 flex justify-end">
              <button type="button" onClick={openEdit} className="rounded-full px-3 py-1 text-[10px] font-semibold" style={{ background: 'rgba(95,184,224,0.14)', border: '1px solid rgba(95,184,224,0.3)', color: '#9FD8EC' }}>Edit details</button>
            </div>
            {show('site_contact_name') ? (
              <MiniRow
                title={val(show('site_contact_name'))}
                subtitle={[show('site_contact_title'), show('site_contact_phone'), show('site_contact_email')].filter(Boolean).join(' • ')}
                meta="Site Contact"
              />
            ) : contact ? (
              <MiniRow
                title={[contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Contact'}
                subtitle={[contact.title, contact.email, contact.phone].filter(Boolean).join(' • ')}
                meta="Contact"
              />
            ) : (
              <Empty text="No contact linked yet. Tap Edit details to add one." />
            )}
            {opp.owner_name && (
              <div className="mt-2">
                <MiniRow
                  title={val(opp.owner_name)}
                  subtitle={opp.owner_initials ? `Initials: ${opp.owner_initials}` : undefined}
                  meta="Owner / Rep"
                />
              </div>
            )}
            {canReassign && (
              <div className="mt-2">
                {!assignOpen ? (
                  <button type="button" onClick={openReassign} className="rounded-full px-3 py-1.5 text-[11px] font-semibold" style={{ background: 'rgba(95,184,224,0.14)', border: '1px solid rgba(95,184,224,0.3)', color: '#9FD8EC' }}>⇄ Reassign rep</button>
                ) : (
                  <div className="rounded-2xl p-3 space-y-2" style={{ background: 'rgba(0,0,0,0.20)', border: '1px solid rgba(95,184,224,0.24)' }}>
                    <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.6)' }}>Assign this deal to</div>
                    {assignLoading ? <div className="py-3 text-center text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Loading team…</div>
                     : assignUsers.length === 0 ? <div className="py-3 text-center text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>No teammates available.</div>
                     : <div className="max-h-56 overflow-y-auto rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>{assignUsers.map(u => <button key={u.id} type="button" disabled={busy === 'reassign_opp'} onClick={() => doReassign(u.id, u.full_name || u.email)} className="flex w-full items-center justify-between border-b px-3 py-2 text-left transition-colors hover:bg-white/5 disabled:opacity-40" style={{ borderColor: 'rgba(255,255,255,0.06)' }}><span className="text-[12px]" style={{ color: 'rgba(255,255,255,0.9)' }}>{u.full_name || u.email}</span><span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.82)' }}>{u.email}</span></button>)}</div>}
                    <div className="flex justify-end"><button type="button" onClick={() => setAssignOpen(false)} className="rounded-full px-3 py-1.5 text-[11px]" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }}>Close</button></div>
                  </div>
                )}
              </div>
            )}
          </Section>

          <Section title="Property">
            {(show('property_address') || property) ? (
              <MiniRow
                title={val(property?.name ?? show('property_address'), 'Property')}
                subtitle={[
                  show('property_address'),
                  show('property_city'),
                  show('property_state'),
                  opp.property_zip,
                ].filter(Boolean).join(', ')}
                meta={show('units') ? `${show('units')} units` : property?.unit_count ? `${property.unit_count} units` : undefined}
              />
            ) : (
              <Empty text="No property linked yet." />
            )}
          </Section>

          <Section title="Activity Timeline" count={activities.length}>
            <button type="button" onClick={() => setActOpen(true)} className="mb-2 w-full rounded-2xl px-3 py-2.5 text-left transition-all hover:-translate-y-0.5" style={{ background: 'rgba(95,184,224,0.10)', border: '1px solid rgba(95,184,224,0.3)', color: '#9FD8EC' }}>
              <div className="text-xs font-semibold">+ Log activity</div>
              <div className="mt-0.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Call, email, meeting, or note</div>
            </button>
            <ListBlock
              records={activities}
              emptyText="No activity yet."
              render={a => (
                <MiniRow
                  title={val(a.subject, val(a.type, 'Activity'))}
                  subtitle={[val(a.body ?? a.outcome, ''), a.type ? `· ${String(a.type)}` : ''].filter(Boolean).join(' ')}
                  meta={fmtWhen(a.created_at)}
                />
              )}
            />
          </Section>

          <Section title="Tasks" count={todos.length}>
            <button type="button" onClick={() => setFollowupOpen(true)} className="mb-2 w-full rounded-2xl px-3 py-2.5 text-left transition-all hover:-translate-y-0.5" style={{ background: 'rgba(95,184,224,0.10)', border: '1px solid rgba(95,184,224,0.3)', color: '#9FD8EC' }}>
              <div className="text-xs font-semibold">+ Add task</div>
              <div className="mt-0.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>With a due date and notes</div>
            </button>
            {(!todos || todos.length === 0) ? (
              <Empty text="No tasks attached yet." />
            ) : (
              <div className="space-y-2">
                {todos.slice(0, 8).map((t, i) => {
                  const tid = String(t.id ?? i)
                  const done = String(t.status ?? '') === 'done'
                  return (
                    <div key={tid} className="rounded-2xl p-3" style={{ background: 'linear-gradient(180deg,#22303f,#1a2532)', border: '1px solid rgba(140,170,200,0.2)' }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold" style={{ color: done ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.9)', textDecoration: done ? 'line-through' : 'none' }}>{val(t.title, 'Task')}</div>
                          {t.body && <div className="mt-1 text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>{String(t.body)}</div>}
                          {t.due_date && <div className="mt-1 text-[10px] uppercase tracking-wide" style={{ color: '#9FD8EC' }}>Due {fmtDate(t.due_date)}</div>}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button type="button" disabled={taskBusy === tid} title={done ? 'Reopen' : 'Complete'} onClick={() => completeTask(tid, !done)} className="rounded-lg px-2 py-1 text-[11px] font-semibold disabled:opacity-40" style={{ background: done ? 'rgba(255,255,255,0.06)' : 'rgba(52,211,153,0.14)', border: `1px solid ${done ? 'rgba(255,255,255,0.14)' : 'rgba(52,211,153,0.4)'}`, color: done ? 'rgba(255,255,255,0.6)' : '#6ee7b7' }}>{taskBusy === tid ? '…' : done ? '↺' : '✓'}</button>
                          <button type="button" disabled={taskBusy === tid} title="Delete" onClick={() => deleteTask(tid)} className="rounded-lg px-2 py-1 text-[11px] font-semibold disabled:opacity-40" style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.35)', color: '#fca5a5' }}>✕</button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Section>
        </div>

        {/* Right col */}
        <div className="space-y-4">
          <Section title="Next Best Actions">
            <div className="space-y-2">
              {msg && (
                <div className="rounded-2xl p-3 text-[11px] font-medium" style={{ background: msg.ok ? 'rgba(52,211,153,0.10)' : 'rgba(248,113,113,0.10)', border: `1px solid ${msg.ok ? 'rgba(52,211,153,0.30)' : 'rgba(248,113,113,0.30)'}`, color: msg.ok ? '#86efac' : '#fca5a5' }}>
                  {msg.text}
                </div>
              )}
              {stageMeta === 'won' && (
                <button
                  type="button"
                  onClick={() => handleAction('create_project')}
                  disabled={busy !== null}
                  className="w-full rounded-2xl p-3 text-left transition-all hover:-translate-y-0.5 disabled:opacity-50"
                  style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.34)', color: 'rgba(255,255,255,0.92)' }}
                >
                  <div className="text-xs font-semibold">{busy === 'create_project' ? 'Creating job…' : '🛠️ Create install job'}</div>
                  <div className="mt-0.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Turn this won deal into a job for the field team</div>
                </button>
              )}
              {nextBestActions.length === 0 ? (
                stageMeta === 'won' ? null : <Empty text="No suggested actions." />
              ) : (
                nextBestActions.map(action => (
                  <button
                    key={action.action}
                    type="button"
                    onClick={() => action.action === 'schedule_followup' ? setFollowupOpen(true) : handleAction(action.action)}
                    disabled={busy !== null}
                    className="w-full rounded-2xl p-3 text-left transition-all hover:-translate-y-0.5 disabled:opacity-50"
                    style={{ background: 'rgba(95,184,224,0.08)', border: '1px solid rgba(95,184,224,0.22)', color: 'rgba(255,255,255,0.86)' }}
                  >
                    <div className="text-xs font-semibold">{busy === action.action ? 'Working…' : action.title}</div>
                    <div className="mt-0.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.82)' }}>{action.subtitle}</div>
                  </button>
                ))
              )}
              <button
                type="button"
                disabled={busy !== null}
                onClick={async () => {
                  const oppId = opp.id as string | undefined
                  if (!oppId || !confirm('Move this opportunity to Deleted Items?')) return
                  try {
                    const r = await fetch('/api/trash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ table: 'opportunities', ids: [oppId], action: 'delete' }) })
                    if (r.ok) { await onRefresh?.(); onBack() }
                    else { const d = await r.json().catch(() => ({})); setMsg({ ok: false, text: d.error || 'Could not delete' }) }
                  } catch { setMsg({ ok: false, text: 'Could not delete' }) }
                }}
                className="w-full rounded-2xl p-3 text-left transition-all hover:-translate-y-0.5 disabled:opacity-50"
                style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.22)', color: '#fca5a5' }}
              >
                <div className="text-xs font-semibold">Delete opportunity</div>
                <div className="mt-0.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.82)' }}>Move to Deleted Items — you can restore it.</div>
              </button>
            </div>
          </Section>

          <Section title="Quote">
            {quote ? (
              <MiniRow
                title={`Quote #${val(quote.id, '').slice(0, 8).toUpperCase()}`}
                subtitle={`Status: ${val(quote.status, 'draft')}`}
                meta={quote.total ? formatMoney(quote.total) : undefined}
              />
            ) : (
              <Empty text="No quote attached yet. Use Generate Quote to start one." />
            )}
          </Section>

          <Section title="Files" count={attachments.length}>
            <input ref={fileRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void uploadFile(f) }} />
            <button
              type="button"
              disabled={fileBusy}
              onClick={() => fileRef.current?.click()}
              className="mb-2 w-full rounded-2xl px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 disabled:opacity-50"
              style={{ background: 'rgba(95,184,224,0.10)', border: '1px dashed rgba(95,184,224,0.4)', color: '#9FD8EC' }}
            >
              <div className="text-xs font-semibold">{fileBusy ? 'Uploading…' : '+ Attach a file'}</div>
              <div className="mt-0.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>PDF, image, or document</div>
            </button>
            {(!attachments || attachments.length === 0) ? (
              <Empty text="No files attached yet." />
            ) : (
              <div className="space-y-2">
                {attachments.slice(0, 8).map((f, i) => {
                  const fid = String(f.id ?? i)
                  const href = (f.url ?? f.public_url) as string | undefined
                  return (
                    <div key={fid} className="flex items-center justify-between gap-2 rounded-2xl p-3" style={{ background: 'linear-gradient(180deg,#22303f,#1a2532)', border: '1px solid rgba(140,170,200,0.2)' }}>
                      <a href={href || undefined} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold" style={{ color: href ? '#9FD8EC' : 'rgba(255,255,255,0.84)' }}>{val(f.file_name, 'File')}</div>
                        <div className="truncate text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{[val(f.file_type ?? f.type, ''), fmtDate(f.created_at)].filter(Boolean).join(' · ')}</div>
                      </a>
                      <button type="button" disabled={fileRmBusy === fid} title="Remove" onClick={() => removeFile(fid)} className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold disabled:opacity-40" style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.35)', color: '#fca5a5' }}>{fileRmBusy === fid ? '…' : '✕'}</button>
                    </div>
                  )
                })}
              </div>
            )}
          </Section>

          {(company || lead) && (
            <Section title="Source">
              {company && (
                <MiniRow
                  title={val(company.name, 'Company')}
                  subtitle={[company.website, company.city, company.state].filter(Boolean).join(' • ')}
                  meta="Company"
                />
              )}
              {lead && (
                <div className={company ? 'mt-2' : ''}>
                  <MiniRow
                    title={val(lead.contact_name, 'Lead')}
                    subtitle={`Converted from lead — ${val(lead.stage, 'prospect')}`}
                    meta="Lead"
                  />
                </div>
              )}
            </Section>
          )}
        </div>
      </div>
    </div>
    </>
  )
}
