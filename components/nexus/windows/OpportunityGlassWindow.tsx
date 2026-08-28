'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { NexusGlassBackButton } from '@/components/nexus/NexusGlassBackButton'
import { PIPELINE_STAGES, STAGE_PROB, normalizeStage } from '@/lib/pipeline'

type AnyRecord = Record<string, any>
// Matches the Opportunity Hub / dashboard steel exactly (lighter steel accents).
const WIN_FRAME = { background: 'repeating-linear-gradient(90deg,rgba(255,255,255,0.05) 0 1px,transparent 1px 4px), linear-gradient(180deg,#5a6c84,#45556a)', border: '1px solid rgba(10,16,24,0.4)', boxShadow: '0 26px 54px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -2px 2px rgba(0,0,0,0.4)' } as const

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
// Aging — whole days since a timestamp, as a short label.
function agingLabel(v: unknown): string {
  if (!v) return '—'
  const d = new Date(String(v))
  if (isNaN(d.getTime())) return '—'
  const days = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000))
  if (days === 0) return 'Today'
  if (days === 1) return '1 day'
  return `${days} days`
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
  const nextBestActions = data.nextBestActions ?? []

  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const oppIdStr = opp.id as string | undefined

  // ── File upload (signed URL → PUT → record via add_attachment) ──────────────
  // One hidden input, reused by every bucket. The bucket's "+ Add" sets which
  // category the next pick belongs to before opening the picker.
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadCat = useRef<string>('document')
  const [fileBusy, setFileBusy] = useState<string | null>(null)   // = category currently uploading
  function pickInto(category: string, accept: string) {
    uploadCat.current = category
    if (fileRef.current) { fileRef.current.accept = accept; fileRef.current.click() }
  }
  async function uploadFile(file: File, category: string) {
    if (!oppIdStr) return
    setFileBusy(category); setMsg(null)
    try {
      const urlRes = await fetch(`/api/nexus/opps/opportunity-window/${oppIdStr}/attachment-url`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: file.name, category }) })
      const u = await urlRes.json()
      if (!urlRes.ok) { setMsg({ ok: false, text: u.error || 'Could not start upload.' }); return }
      const put = await fetch(u.signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file })
      if (!put.ok) { setMsg({ ok: false, text: 'Upload failed.' }); return }
      const rec = await fetch(`/api/nexus/opps/opportunity-window/${oppIdStr}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add_attachment', file_name: file.name, url: u.publicUrl, file_type: file.type || null, size_bytes: file.size, category }) })
      const rj = await rec.json().catch(() => ({}))
      if (!rec.ok || rj.success === false) { setMsg({ ok: false, text: rj.message || 'Could not save file.' }); return }
      setMsg({ ok: true, text: 'Attached ✓' })
      await onRefresh?.()
    } catch { setMsg({ ok: false, text: 'Upload failed.' }) }
    finally { setFileBusy(null); if (fileRef.current) fileRef.current.value = '' }
  }
  // Upload a whole selection (multi-select) into one bucket, one after another.
  async function uploadMany(files: FileList | File[], category: string) {
    const list = Array.from(files)
    for (const f of list) { await uploadFile(f, category) }
  }
  // Rename an attachment in place.
  async function renameAttachment(id: string, currentName: string) {
    if (!oppIdStr) return
    const next = typeof window !== 'undefined' ? window.prompt('Rename file', currentName) : null
    if (next == null) return
    const name = next.trim()
    if (!name || name === currentName) return
    const r = await fetch(`/api/nexus/opps/opportunity-window/${oppIdStr}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'rename_attachment', attachment_id: id, file_name: name }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || j.success === false) { setMsg({ ok: false, text: j.message || 'Rename failed.' }); return }
    setMsg({ ok: true, text: 'Renamed ✓' }); await onRefresh?.()
  }
  // Lightbox preview for images.
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null)

  // Create a portal quote/proposal straight from this opportunity, pre-filled
  // with its client + property, then open the builder in a new tab. This is the
  // entry point that was missing — the bucket only *uploaded* files before.
  const [quoteBusy, setQuoteBusy] = useState(false)
  async function createProposal() {
    if (!oppIdStr || quoteBusy) return
    setQuoteBusy(true); setMsg(null)
    // Open the tab NOW, while we still have the click's user gesture. Calling
    // window.open() AFTER the await gets silently blocked by the popup blocker —
    // that was the "goes noplace" bug. We aim this blank tab at the quote once
    // it's created; if the browser blocked it we fall back to same-tab nav.
    const win = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyC: any = contact ?? {}; const anyP: any = property ?? {}; const anyCo: any = company ?? {}
      const title = String(opp.name || opp.account_name || anyP.name || anyP.address || 'New proposal')
      const body = {
        title,
        opportunity_id: oppIdStr,
        client_name: anyC.name || anyCo.name || opp.account_name || null,
        client_email: anyC.email || opp.contact_email || null,
        property_name: anyP.name || opp.property_name || anyP.address || null,
        units: opp.units || anyP.units || null,
      }
      const r = await fetch('/api/quotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json().catch(() => ({}))
      const qid = j?.quote?.id || j?.id
      if (!r.ok || j?.error || !qid) {
        if (win) win.close()
        setMsg({ ok: false, text: j?.error || 'Could not create proposal.' })
        return
      }
      const url = `/quotes/${qid}/build`
      if (win) win.location.href = url
      else if (typeof window !== 'undefined') window.location.href = url   // popup blocked → same tab
      setMsg({ ok: true, text: 'Proposal created ✓ — opening builder' })
      await onRefresh?.()
    } catch {
      if (win) win.close()
      setMsg({ ok: false, text: 'Could not create proposal.' })
    } finally { setQuoteBusy(false) }
  }

  // ── Schedule follow-up (popup) ──────────────────────────────────────────────
  const [followupOpen, setFollowupOpen] = useState(false)
  const [fu, setFu] = useState({ title: '', due_date: '', notes: '', assigned_to: '', assigned_to_name: '' })
  function openFollowup() { setFollowupOpen(true); void loadAssignees() }
  const [fuBusy, setFuBusy] = useState(false)
  async function submitFollowup() {
    if (!oppIdStr) return
    setFuBusy(true)
    try {
      const r = await fetch(`/api/nexus/opps/opportunity-window/${oppIdStr}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'schedule_followup', title: fu.title || `Follow up: ${opp.name || opp.account_name || 'opportunity'}`, due_date: fu.due_date || null, notes: fu.notes || null, assigned_to: fu.assigned_to || null, assigned_to_name: fu.assigned_to_name || null }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || j.success === false) { setMsg({ ok: false, text: j.message || 'Could not schedule.' }); return }
      setFollowupOpen(false); setFu({ title: '', due_date: '', notes: '', assigned_to: '', assigned_to_name: '' })
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

  // (The standalone "Quote" card + modal were removed — quotes now live in the
  //  "Quotes & Surveys" attachment bucket, so there's only one place for them.)

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

  // ── Contact roles (opportunity_contacts) ────────────────────────────────────
  const [contacts, setContacts] = useState<AnyRecord[]>([])
  async function reloadContacts() {
    if (!oppIdStr) return
    const d = await fetch(`/api/crm/opportunities/${oppIdStr}/contacts`).then(r => (r.ok ? r.json() : [])).catch(() => [])
    if (Array.isArray(d)) setContacts(d)
  }
  useEffect(() => { void reloadContacts() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [oppIdStr])
  const [addContactOpen, setAddContactOpen] = useState(false)
  const [nc, setNc] = useState({ name: '', title: '', email: '', phone: '', role: 'Decision Maker' })
  const [ncBusy, setNcBusy] = useState(false)
  async function addContact() {
    if (!oppIdStr || !nc.name.trim()) return
    setNcBusy(true)
    try {
      const r = await fetch(`/api/crm/opportunities/${oppIdStr}/contacts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nc) })
      if (!r.ok) { setMsg({ ok: false, text: 'Could not add contact.' }); return }
      setAddContactOpen(false); setNc({ name: '', title: '', email: '', phone: '', role: 'Decision Maker' })
      await reloadContacts()
    } catch { setMsg({ ok: false, text: 'Could not add contact.' }) }
    finally { setNcBusy(false) }
  }
  async function delContact(cid: string) {
    if (!oppIdStr || !confirm('Remove this contact?')) return
    try {
      const r = await fetch(`/api/crm/opportunities/${oppIdStr}/contacts?contactId=${encodeURIComponent(cid)}`, { method: 'DELETE' })
      if (!r.ok) { setMsg({ ok: false, text: 'Could not remove contact.' }); return }
      await reloadContacts()
    } catch { setMsg({ ok: false, text: 'Could not remove contact.' }) }
  }

  // ── Inline-edit header stats (amount / est_mrr / close_date) ─────────────────
  const [editStat, setEditStat] = useState<string | null>(null)
  const [statVal, setStatVal] = useState('')
  const [statBusy, setStatBusy] = useState(false)
  function openStat(field: string, current: unknown) { setEditStat(field); setStatVal(current != null ? String(current) : '') }
  async function saveStat(field: string) {
    if (!oppIdStr) return
    setStatBusy(true)
    try {
      const r = await fetch(`/api/nexus/opps/opportunity-window/${oppIdStr}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_details', [field]: statVal }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || j.success === false) { setMsg({ ok: false, text: j.message || 'Could not save.' }); return }
      const dropped: string[] = Array.isArray(j.dropped) ? j.dropped : []
      if (!dropped.includes(field)) setOv(prev => ({ ...prev, [field]: (field === 'amount' || field === 'est_mrr') ? (Number(statVal) || 0) : statVal }))
      setEditStat(null)
      if (dropped.includes(field)) setMsg({ ok: false, text: `${field} couldn't be saved yet.` })
      await onRefresh?.()
    } catch { setMsg({ ok: false, text: 'Could not save.' }) }
    finally { setStatBusy(false) }
  }
  const statTile = { background: 'linear-gradient(180deg,#22303f,#1a2532)', border: '1px solid rgba(140,170,200,0.2)' } as const
  function renderEditStat(field: string, label: string, display: string, inputType: string, current: unknown) {
    if (editStat === field) {
      return (
        <div className="rounded-2xl p-3" style={statTile}>
          <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.82)' }}>{label}</div>
          <input autoFocus type={inputType} value={statVal} onChange={e => setStatVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void saveStat(field); if (e.key === 'Escape') setEditStat(null) }} className="mt-1 w-full rounded-lg px-2 py-1 text-xs outline-none" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(95,184,224,0.4)', color: 'white' }} />
          <div className="mt-1 flex gap-1">
            <button type="button" disabled={statBusy} onClick={() => saveStat(field)} className="flex-1 rounded-md py-0.5 text-[10px] font-semibold disabled:opacity-50" style={{ background: '#2f7fb8', color: 'white' }}>{statBusy ? '…' : 'Save'}</button>
            <button type="button" onClick={() => setEditStat(null)} className="rounded-md px-2 py-0.5 text-[10px]" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}>✕</button>
          </div>
        </div>
      )
    }
    return (
      <button type="button" onClick={() => openStat(field, current)} title="Click to edit" className="rounded-2xl p-3 text-left transition-all hover:brightness-125" style={statTile}>
        <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.82)' }}>{label} <span style={{ color: 'rgba(95,184,224,0.6)' }}>✎</span></div>
        <div className="mt-1 truncate text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.82)' }}>{display}</div>
      </button>
    )
  }

  // Local overrides so edits show immediately (and persist on save).
  const [ov, setOv] = useState<AnyRecord>({})
  // When fresh server data arrives (updated_at changes after a refresh), drop the
  // optimistic overrides so the screen reflects server truth — never stale input.
  const oppUpdatedAt = (opp as AnyRecord)?.updated_at
  useEffect(() => { setOv({}) }, [oppUpdatedAt])
  const show = (key: string, fallback?: unknown) => (ov[key] !== undefined ? ov[key] : (opp[key] ?? fallback))
  const [editing, setEditing] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const canReassign = Boolean(data.canReassign)
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignLoading, setAssignLoading] = useState(false)
  const [assignUsers, setAssignUsers] = useState<Array<{ id: string; full_name?: string; email: string; role?: string }>>([])
  async function loadAssignees() {
    if (assignUsers.length > 0) return
    setAssignLoading(true)
    try {
      const r = await fetch('/api/admin/users')
      const j = await r.json().catch(() => ({}))
      const list: AnyRecord[] = Array.isArray(j?.users) ? j.users : Array.isArray(j) ? j : []
      setAssignUsers(list.map(u => ({ id: String(u.id ?? u.user_id ?? u.clerk_user_id ?? ''), full_name: u.full_name ?? u.name, email: u.email ?? '', role: (u.role ?? u.permissions?.role) as string | undefined })).filter(u => u.id))
    } catch { /* ignore */ } finally { setAssignLoading(false) }
  }
  async function openReassign() { setAssignOpen(true); await loadAssignees() }

  // ── Managing admin (person who oversees the rep on this deal) ────────────────
  const [managerOpen, setManagerOpen] = useState(false)
  function openManager() { setManagerOpen(true); void loadAssignees() }
  const orgAdmins = assignUsers.filter(u => (u.role ?? '').toLowerCase() === 'admin')
  async function saveManager(id: string | null, name: string | null) {
    if (!oppIdStr) return
    setBusy('manager')
    try {
      const r = await fetch(`/api/nexus/opps/opportunity-window/${oppIdStr}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_details', manager_id: id ?? '', manager_name: name ?? '' }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || j.success === false) { setMsg({ ok: false, text: j.message || 'Could not set manager.' }); return }
      setOv(prev => ({ ...prev, manager_name: name }))
      setManagerOpen(false); setMsg({ ok: true, text: name ? `Manager set to ${name}` : 'Manager cleared' })
      await onRefresh?.()
    } catch { setMsg({ ok: false, text: 'Could not set manager.' }) }
    finally { setBusy(null) }
  }
  // ── Rename the opportunity ───────────────────────────────────────────────────
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  function startRename() { setNameDraft(String(show('name') ?? '')); setRenaming(true) }
  async function saveName() {
    if (!oppIdStr) return
    const next = nameDraft.trim()
    if (!next) { setMsg({ ok: false, text: 'Name cannot be empty.' }); return }
    if (next === String(show('name') ?? '')) { setRenaming(false); return }
    setBusy('rename')
    try {
      const r = await fetch(`/api/nexus/opps/opportunity-window/${oppIdStr}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_details', name: next }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || j.success === false) { setMsg({ ok: false, text: j.message || 'Could not rename.' }); return }
      setOv(prev => ({ ...prev, name: next }))
      setRenaming(false); setMsg({ ok: true, text: 'Renamed ✓' })
      await onRefresh?.()
    } catch { setMsg({ ok: false, text: 'Could not rename.' }) }
    finally { setBusy(null) }
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
    account_name: '', management_co: '', property_address: '', property_city: '', property_state: '', units: '', next_step: '', notes: '',
  })
  // Property edits shouldn't re-ask for a contact — People (opportunity_contacts)
  // owns contacts. 'property' mode hides the legacy site-contact block.
  const [editMode, setEditMode] = useState<'all' | 'property'>('all')

  function openEdit(mode: 'all' | 'property' = 'all') {
    setEditMode(mode)
    setF({
      site_contact_name:  String(show('site_contact_name', contact ? [contact.first_name, contact.last_name].filter(Boolean).join(' ') : '') ?? ''),
      site_contact_title: String(show('site_contact_title', contact?.title) ?? ''),
      site_contact_phone: String(show('site_contact_phone', contact?.phone) ?? ''),
      site_contact_email: String(show('site_contact_email', contact?.email) ?? ''),
      account_name:       String(show('account_name', company?.name) ?? ''),
      management_co:      String(show('management_co') ?? ''),
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

  // ── Health + probability model ──────────────────────────────────────────────
  // Health = how long the deal has sat idle (time since last update). Estimated
  // win % = a base probability per stage, decayed the longer it sits idle. A
  // stored `probability` (if set) seeds the base so manual overrides still count.
  const idleDays = (() => {
    const v = opp.updated_at ?? opp.created_at
    if (!v) return 0
    const d = new Date(String(v))
    return isNaN(d.getTime()) ? 0 : Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000))
  })()
  // Base % = the app's CANONICAL per-stage probability (lib/pipeline STAGE_PROB),
  // resolved through normalizeStage so any stored alias maps correctly. A manually
  // set `probability` seeds the fallback. Then deteriorate with aging: full base
  // for the first 7 idle days, linear decay over the next ~45 to a 35% floor.
  const normStage = normalizeStage(String(opp.stage ?? ''))
  const baseProb = STAGE_PROB[normStage] ?? (opp.probability != null ? Number(opp.probability) : 20)
  const isClosed = ['won', 'lost', 'dead'].includes(normStage)
  const decay = Math.min(1, Math.max(0.35, 1 - Math.max(0, idleDays - 7) / 45))
  const estProb = isClosed ? baseProb : Math.max(2, Math.round(baseProb * decay))
  // Per-stage stall thresholds [amber, red] — earlier stages may sit longer.
  const STAGE_STALL: Record<string, [number, number]> = { meet_present: [21, 45], survey: [21, 45], propose: [14, 30], negotiate: [10, 21], contract: [7, 14], deposit: [5, 10] }
  const [amberT, redT] = STAGE_STALL[normStage] ?? [10, 21]
  const health = isClosed
    ? { color: normStage === 'won' ? '#34d399' : '#f87171', label: normStage === 'won' ? 'Won' : 'Closed' }
    : idleDays <= amberT ? { color: '#34d399', label: 'On track' }
    : idleDays <= redT ? { color: '#fbbf24', label: 'Aging' }
    : { color: '#f87171', label: 'Stalled' }

  // ── Deal value model → MRR + install fee → TCV → weighted forecast ──────────
  // TCV = (MRR × contract term months) + one-time install/setup fee. Weighted
  // forecast = TCV × estimated win %. Fields fall back gracefully if not stored.
  const mrrVal = Number(show('est_mrr') ?? opp.est_mrr ?? 0) || 0
  const installVal = Number(show('install_fee') ?? opp.install_fee ?? opp.setup_fee ?? 0) || 0
  const termVal = Number(show('contract_term') ?? opp.contract_term ?? opp.term_months ?? 36) || 36
  const tcv = mrrVal * termVal + installVal
  const weightedTcv = Math.round(tcv * (estProb / 100))

  return (
    <>
    <NexusGlassBackButton label="Back to workbench" onClick={onBack} />

    {/* Schedule follow-up popup */}
    {followupOpen && (
      <div onClick={() => setFollowupOpen(false)} className="fixed inset-0 z-[130] flex items-center justify-center p-4" style={{ background: 'rgba(4,10,20,0.8)', backdropFilter: 'blur(6px)' }}>
        <div onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-[1.5rem] p-5" style={{ background: 'linear-gradient(180deg,#2b3c52,#1e2a3a)', border: '1px solid rgba(140,170,200,0.24)', boxShadow: '0 30px 100px rgba(0,0,0,0.55)' }}>
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
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-wide" style={{ color: 'rgba(159,216,236,0.9)' }}>Assign to {assignLoading && <span style={{ color: 'rgba(255,255,255,0.4)' }}>· loading…</span>}</label>
              <select value={fu.assigned_to} onChange={e => { const u = assignUsers.find(x => x.id === e.target.value); setFu({ ...fu, assigned_to: e.target.value, assigned_to_name: u ? (u.full_name || u.email) : '' }) }} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(95,184,224,0.24)', color: 'rgba(255,255,255,0.92)' }}>
                <option value="" style={{ background: '#0b1424' }}>Me (default)</option>
                {assignUsers.map(u => <option key={u.id} value={u.id} style={{ background: '#0b1424' }}>{u.full_name || u.email}</option>)}
              </select>
            </div>
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
        <div onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-[1.5rem] p-5" style={{ background: 'linear-gradient(180deg,#2b3c52,#1e2a3a)', border: '1px solid rgba(140,170,200,0.24)', boxShadow: '0 30px 100px rgba(0,0,0,0.55)' }}>
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

    {/* Add contact popup */}
    {addContactOpen && (
      <div onClick={() => setAddContactOpen(false)} className="fixed inset-0 z-[130] flex items-center justify-center p-4" style={{ background: 'rgba(4,10,20,0.8)', backdropFilter: 'blur(6px)' }}>
        <div onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-[1.5rem] p-5" style={{ background: 'linear-gradient(180deg,#2b3c52,#1e2a3a)', border: '1px solid rgba(140,170,200,0.24)', boxShadow: '0 30px 100px rgba(0,0,0,0.55)' }}>
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>Add contact</h4>
            <button type="button" onClick={() => setAddContactOpen(false)} className="rounded-full px-3 py-1 text-[11px]" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.78)' }}>Close</button>
          </div>
          <div className="space-y-2">
            <input value={nc.name} onChange={e => setNc({ ...nc, name: e.target.value })} placeholder="Name" className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(95,184,224,0.24)', color: 'rgba(255,255,255,0.92)' }} />
            <input value={nc.title} onChange={e => setNc({ ...nc, title: e.target.value })} placeholder="Title (optional)" className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(95,184,224,0.24)', color: 'rgba(255,255,255,0.92)' }} />
            <div className="grid grid-cols-2 gap-2">
              <input value={nc.email} onChange={e => setNc({ ...nc, email: e.target.value })} placeholder="Email" className="rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(95,184,224,0.24)', color: 'rgba(255,255,255,0.92)' }} />
              <input value={nc.phone} onChange={e => setNc({ ...nc, phone: e.target.value })} placeholder="Phone" className="rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(95,184,224,0.24)', color: 'rgba(255,255,255,0.92)' }} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-wide" style={{ color: 'rgba(159,216,236,0.9)' }}>Role</label>
              <select value={nc.role} onChange={e => setNc({ ...nc, role: e.target.value })} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(95,184,224,0.24)', color: 'rgba(255,255,255,0.92)' }}>
                {['Decision Maker', 'Influencer', 'Economic Buyer', 'Property Manager', 'Site Contact', 'Billing', 'Technical', 'Other'].map(r => <option key={r} value={r} style={{ background: '#0b1424' }}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setAddContactOpen(false)} className="rounded-full px-4 py-2 text-xs" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.72)' }}>Cancel</button>
            <button type="button" disabled={ncBusy || !nc.name.trim()} onClick={addContact} className="rounded-full px-4 py-2 text-xs font-semibold disabled:opacity-40" style={{ background: '#2f7fb8', color: 'white' }}>{ncBusy ? 'Adding…' : 'Add contact'}</button>
          </div>
        </div>
      </div>
    )}

    {/* Image preview lightbox */}
    {preview && (
      <div onClick={() => setPreview(null)} className="fixed inset-0 z-[140] flex flex-col items-center justify-center p-4" style={{ background: 'rgba(4,10,20,0.9)', backdropFilter: 'blur(8px)' }}>
        <div className="mb-2 flex w-full max-w-4xl items-center justify-between gap-3">
          <div className="truncate text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.92)' }}>{preview.name}</div>
          <div className="flex shrink-0 gap-2">
            <a href={preview.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: 'rgba(95,184,224,0.16)', border: '1px solid rgba(95,184,224,0.4)', color: '#9FD8EC' }}>Open original ↗</a>
            <button type="button" onClick={() => setPreview(null)} className="rounded-full px-3 py-1 text-[11px]" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.82)' }}>Close</button>
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img onClick={e => e.stopPropagation()} src={preview.url} alt={preview.name} className="max-h-[82vh] max-w-4xl rounded-2xl object-contain" style={{ border: '1px solid rgba(140,170,200,0.28)' }} />
      </div>
    )}

    {/* Rep / agent picker — any user in the organization */}
    {assignOpen && (
      <div onClick={() => setAssignOpen(false)} className="fixed inset-0 z-[130] flex items-center justify-center p-4" style={{ background: 'rgba(4,10,20,0.8)', backdropFilter: 'blur(6px)' }}>
        <div onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-[1.5rem] p-5" style={{ background: 'linear-gradient(180deg,#2b3c52,#1e2a3a)', border: '1px solid rgba(140,170,200,0.3)', boxShadow: '0 30px 100px rgba(0,0,0,0.55)' }}>
          <div className="mb-1 flex items-center justify-between">
            <h4 className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>Assign rep / agent</h4>
            <button type="button" onClick={() => setAssignOpen(false)} className="rounded-full px-3 py-1 text-[11px]" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.78)' }}>Close</button>
          </div>
          <p className="mb-3 text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>Anyone in this organization can own the deal.</p>
          {assignLoading ? <div className="py-3 text-center text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Loading team…</div>
            : assignUsers.length === 0 ? <div className="py-3 text-center text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>No teammates available.</div>
            : (
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                {assignUsers.map(u => (
                  <button key={u.id} type="button" disabled={busy === 'reassign_opp'} onClick={() => doReassign(u.id, u.full_name || u.email)} className="flex w-full items-center justify-between border-b px-3 py-2 text-left transition-colors hover:bg-white/5 disabled:opacity-40" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <span className="text-[12px]" style={{ color: 'rgba(255,255,255,0.9)' }}>{u.full_name || u.email}{u.role ? <span className="ml-1.5 text-[9px] uppercase" style={{ color: 'rgba(159,216,236,0.7)' }}>· {u.role}</span> : null}</span>
                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{u.email}</span>
                  </button>
                ))}
              </div>
            )}
        </div>
      </div>
    )}

    {/* Manager picker — org admins */}
    {managerOpen && (
      <div onClick={() => setManagerOpen(false)} className="fixed inset-0 z-[130] flex items-center justify-center p-4" style={{ background: 'rgba(4,10,20,0.8)', backdropFilter: 'blur(6px)' }}>
        <div onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-[1.5rem] p-5" style={{ background: 'linear-gradient(180deg,#2b3c52,#1e2a3a)', border: '1px solid rgba(140,170,200,0.3)', boxShadow: '0 30px 100px rgba(0,0,0,0.55)' }}>
          <div className="mb-1 flex items-center justify-between">
            <h4 className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>Assign manager</h4>
            <button type="button" onClick={() => setManagerOpen(false)} className="rounded-full px-3 py-1 text-[11px]" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.78)' }}>Close</button>
          </div>
          <p className="mb-3 text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>Admins in this organization who oversee the rep.</p>
          {assignLoading ? <div className="py-3 text-center text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Loading admins…</div>
            : orgAdmins.length === 0 ? <div className="py-3 text-center text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>No admins found in this organization.</div>
            : (
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                {orgAdmins.map(u => (
                  <button key={u.id} type="button" disabled={busy === 'manager'} onClick={() => saveManager(u.id, u.full_name || u.email)} className="flex w-full items-center justify-between border-b px-3 py-2 text-left transition-colors hover:bg-white/5 disabled:opacity-40" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <span className="text-[12px]" style={{ color: 'rgba(255,255,255,0.9)' }}>{u.full_name || u.email}</span>
                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{u.email}</span>
                  </button>
                ))}
              </div>
            )}
          <div className="mt-3 flex justify-between">
            <button type="button" disabled={busy === 'manager'} onClick={() => saveManager(null, null)} className="rounded-full px-3 py-1.5 text-[11px]" style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.35)', color: '#fca5a5' }}>Clear manager</button>
            <button type="button" onClick={() => setManagerOpen(false)} className="rounded-full px-3 py-1.5 text-[11px]" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }}>Close</button>
          </div>
        </div>
      </div>
    )}
    <div className="space-y-4 pb-44 rounded-[2rem] p-4 sm:p-5" style={WIN_FRAME}>
      {editing && (
        <div className="fixed inset-0 z-[120] overflow-y-auto px-4 py-4 sm:py-8" style={{ background: 'rgba(0,0,0,0.74)', backdropFilter: 'blur(10px)', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
          <div className="mx-auto flex min-h-full w-full max-w-2xl items-start justify-center">
            <div className="w-full overflow-hidden rounded-[2rem]" style={{ background: 'linear-gradient(180deg, rgba(18,28,52,0.98), rgba(8,14,28,0.98))', border: '1px solid rgba(95,184,224,0.32)', boxShadow: '0 30px 100px rgba(0,0,0,0.55)' }}>
              <div className="sticky top-0 z-10 flex items-start justify-between gap-3 p-5" style={{ background: 'linear-gradient(180deg, rgba(18,28,52,0.98), rgba(18,28,52,0.92))', borderBottom: '1px solid rgba(95,184,224,0.18)' }}>
                <div><div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: '#9FD8EC' }}>Edit Opportunity</div><h3 className="mt-1 text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.96)' }}>{editMode === 'property' ? 'Property details' : 'Contact & property details'}</h3></div>
                <button type="button" onClick={() => setEditing(false)} className="rounded-full px-3 py-1.5 text-[11px]" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.78)' }}>Close</button>
              </div>
              <div className="max-h-[calc(100vh-12rem)] overflow-y-auto p-5" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
                {editMode !== 'property' && (<>
                <div className="mb-2 text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.5)' }}>Contact</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input value={f.site_contact_name} onChange={e => setF({ ...f, site_contact_name: e.target.value })} placeholder="Contact name" className="rounded-xl px-3 py-2 text-sm outline-none" style={editInput} />
                  <input value={f.site_contact_title} onChange={e => setF({ ...f, site_contact_title: e.target.value })} placeholder="Title" className="rounded-xl px-3 py-2 text-sm outline-none" style={editInput} />
                  <input value={f.site_contact_phone} onChange={e => setF({ ...f, site_contact_phone: e.target.value })} placeholder="Phone" className="rounded-xl px-3 py-2 text-sm outline-none" style={editInput} />
                  <input value={f.site_contact_email} onChange={e => setF({ ...f, site_contact_email: e.target.value })} placeholder="Email" className="rounded-xl px-3 py-2 text-sm outline-none" style={editInput} />
                </div>
                </>)}
                {editMode === 'property' && (
                  <div className="mb-3 rounded-xl px-3 py-2 text-[11px]" style={{ background: 'rgba(95,184,224,0.10)', border: '1px solid rgba(95,184,224,0.24)', color: '#9FD8EC' }}>Contacts are managed in the People section above — add or edit them there.</div>
                )}
                <div className="mb-2 mt-4 text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.5)' }}>Account &amp; property</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input value={f.account_name} onChange={e => setF({ ...f, account_name: e.target.value })} placeholder="Account / company" className="rounded-xl px-3 py-2 text-sm outline-none" style={editInput} />
                  <input value={f.management_co} onChange={e => setF({ ...f, management_co: e.target.value })} placeholder="Management company (manager)" className="rounded-xl px-3 py-2 text-sm outline-none" style={editInput} />
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
            {renaming ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={e => setNameDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setRenaming(false) }}
                  className="min-w-[220px] flex-1 rounded-xl px-3 py-2 text-lg font-semibold outline-none"
                  style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(95,184,224,0.4)', color: 'rgba(255,255,255,0.94)' }}
                />
                <button type="button" disabled={busy === 'rename'} onClick={saveName} className="rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-40" style={{ background: '#2f7fb8', color: 'white' }}>{busy === 'rename' ? 'Saving…' : 'Save'}</button>
                <button type="button" onClick={() => setRenaming(false)} className="rounded-full px-3 py-1.5 text-xs" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.72)' }}>Cancel</button>
              </div>
            ) : (
              <div className="mt-2 flex items-start gap-2">
                <h3 className="text-2xl font-semibold leading-tight" style={{ color: 'rgba(255,255,255,0.94)' }}>
                  {val(show('name'), 'Untitled Opportunity')}
                </h3>
                <button type="button" onClick={startRename} title="Rename opportunity" className="mt-1 shrink-0 rounded-lg p-1.5 transition-colors" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(95,184,224,0.24)', color: '#9FD8EC' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                </button>
              </div>
            )}
            <div className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {val(show('account_name') ?? company?.name, 'No account attached')}
            </div>
          </div>
          <div className="rounded-2xl px-4 py-3 text-right" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: 'rgba(255,255,255,0.82)' }}>Stage</div>
            <div className="mt-1 text-sm font-semibold" style={{ color: stageColor }}>{val(show('stage') ?? opp.stage, 'inquiry')}</div>
            <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${health.color}22`, border: `1px solid ${health.color}55`, color: health.color }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: health.color }} />{health.label} · {estProb}%
            </div>
          </div>
        </div>

        {/* Stage path — the real pipeline (Meet & Present → … → Won). Click to move. */}
        {(() => {
          const curIdx = PIPELINE_STAGES.findIndex(s => s.key === normStage)
          return (
            <div className="mt-4 flex items-stretch gap-1 overflow-x-auto">
              {PIPELINE_STAGES.map((s, i) => {
                const done = !isClosed && curIdx >= 0 && i < curIdx
                const active = !isClosed && s.key === normStage
                return (
                  <button key={s.key} type="button" disabled={stageBusy !== null} onClick={() => setStage(s.key)}
                    className="min-w-[70px] flex-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-colors disabled:opacity-60"
                    style={{ background: active ? '#2f7fb8' : done ? 'rgba(52,211,153,0.16)' : 'rgba(255,255,255,0.05)', border: `1px solid ${active ? '#2f7fb8' : done ? 'rgba(52,211,153,0.4)' : 'rgba(140,170,200,0.24)'}`, color: active ? 'white' : done ? '#6ee7b7' : 'rgba(255,255,255,0.62)' }}>
                    {stageBusy === s.key ? '…' : s.label}
                  </button>
                )
              })}
            </div>
          )
        })()}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {renderEditStat('est_mrr', 'Monthly $', (show('est_mrr') ?? opp.est_mrr) ? formatMoney(show('est_mrr') ?? opp.est_mrr) : 'Not set', 'number', show('est_mrr') ?? opp.est_mrr)}
          {renderEditStat('amount', 'Amount', (show('amount') ?? opp.amount) ? formatMoney(show('amount') ?? opp.amount) : 'Not set', 'number', show('amount') ?? opp.amount)}
          {renderEditStat('close_date', 'Close Date', (show('close_date') ?? opp.close_date) ? fmtDate(show('close_date') ?? opp.close_date) : 'Not set', 'date', show('close_date') ?? opp.close_date)}
          <MiniStat label="Updated"     value={fmtWhen(opp.updated_at ?? opp.created_at) || 'Unknown'} />
        </div>

        {/* At-a-glance — assigned rep, manager, units, health (time-in-stage) + est win %. */}
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {canReassign ? (
            <button type="button" onClick={openReassign} title="Assign a rep / agent" className="rounded-2xl p-3 text-left transition-all hover:brightness-125" style={{ background: 'linear-gradient(180deg,#22303f,#1a2532)', border: '1px solid rgba(140,170,200,0.2)' }}>
              <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.82)' }}>Rep / Agent <span style={{ color: 'rgba(95,184,224,0.6)' }}>▾</span></div>
              <div className="mt-1 truncate text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.82)' }}>{val(show('owner_name') ?? opp.owner_name, 'Assign')}</div>
            </button>
          ) : (
            <MiniStat label="Rep / Agent" value={val(show('owner_name') ?? opp.owner_name, 'Unassigned')} />
          )}
          <button type="button" onClick={openManager} title="Assign a managing admin" className="rounded-2xl p-3 text-left transition-all hover:brightness-125" style={{ background: 'linear-gradient(180deg,#22303f,#1a2532)', border: '1px solid rgba(140,170,200,0.2)' }}>
            <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.82)' }}>Manager <span style={{ color: 'rgba(95,184,224,0.6)' }}>▾</span></div>
            <div className="mt-1 truncate text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.82)' }}>{val(show('manager_name') ?? opp.manager_name, 'Assign')}</div>
          </button>
          {renderEditStat('units', 'Units', val(show('units') ?? opp.units, 'Unknown'), 'number', show('units') ?? opp.units)}
          <div className="rounded-2xl p-3" style={{ background: 'linear-gradient(180deg,#22303f,#1a2532)', border: `1px solid ${health.color}55` }}>
            <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.82)' }}>Idle · {health.label}</div>
            <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold" style={{ color: health.color }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: health.color }} />{agingLabel(opp.updated_at ?? opp.created_at)}</div>
          </div>
          <div className="rounded-2xl p-3" style={{ background: 'linear-gradient(180deg,#22303f,#1a2532)', border: '1px solid rgba(140,170,200,0.2)' }}>
            <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.82)' }}>Est. win %</div>
            <div className="mt-1 text-xs font-semibold" style={{ color: estProb >= 60 ? '#34d399' : estProb >= 30 ? '#fbbf24' : '#f87171' }}>{estProb}%</div>
          </div>
        </div>

        {/* Deal value → Total Contract Value → weighted forecast. */}
        <div className="mt-3">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'rgba(159,216,236,0.9)' }}>Deal value · Total Contract Value</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {renderEditStat('install_fee', 'Install fee', installVal ? formatMoney(installVal) : 'Not set', 'number', installVal || '')}
            {renderEditStat('contract_term', 'Term (mo)', String(termVal), 'number', termVal)}
            <MiniStat label="TCV" value={tcv ? formatMoney(tcv) : '—'} />
            <div className="rounded-2xl p-3" style={{ background: 'linear-gradient(180deg,#22303f,#1a2532)', border: '1px solid rgba(95,184,224,0.3)' }}>
              <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.82)' }}>Weighted · {estProb}%</div>
              <div className="mt-1 text-xs font-semibold" style={{ color: '#9FD8EC' }}>{weightedTcv ? formatMoney(weightedTcv) : '—'}</div>
            </div>
          </div>
          <div className="mt-1.5 text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>TCV = MRR {formatMoney(mrrVal)} × {termVal} mo + install {formatMoney(installVal)}</div>
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
              {(() => {
                const amt = Number(opp.amount ?? 0)
                const prob = opp.probability != null ? Number(opp.probability) : null
                if (!amt || prob == null) return null
                return <div style={{ color: '#9FD8EC' }}>Expected revenue: {formatMoney(Math.round(amt * (prob / 100)))} <span style={{ color: 'rgba(255,255,255,0.45)' }}>({formatMoney(amt)} × {prob}%)</span></div>
              })()}
            </div>
          </Section>

          <Section title="People">
            <div className="mb-2 flex justify-end">
              <button type="button" onClick={() => openEdit('all')} className="rounded-full px-3 py-1 text-[10px] font-semibold" style={{ background: 'rgba(95,184,224,0.14)', border: '1px solid rgba(95,184,224,0.3)', color: '#9FD8EC' }}>Edit details</button>
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

            {/* Contact roles — multiple stakeholders (decision maker, influencer…). */}
            {contacts.length > 0 && (
              <div className="mt-2 space-y-2">
                {contacts.map(c => (
                  <div key={String(c.id)} className="flex items-start justify-between gap-2 rounded-2xl p-3" style={{ background: 'linear-gradient(180deg,#22303f,#1a2532)', border: '1px solid rgba(140,170,200,0.2)' }}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{val(c.contact_name, 'Contact')}</span>
                        {c.role && <span className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide" style={{ background: 'rgba(95,184,224,0.14)', border: '1px solid rgba(95,184,224,0.3)', color: '#9FD8EC' }}>{String(c.role)}</span>}
                        {c.is_primary && <span className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide" style={{ background: 'rgba(52,211,153,0.14)', border: '1px solid rgba(52,211,153,0.35)', color: '#6ee7b7' }}>Primary</span>}
                      </div>
                      <div className="mt-0.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.6)' }}>{[c.contact_title, c.contact_email, c.contact_phone].filter(Boolean).join(' • ') || 'No contact info'}</div>
                    </div>
                    <button type="button" onClick={() => delContact(String(c.id))} title="Remove" className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold" style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.35)', color: '#fca5a5' }}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <button type="button" onClick={() => setAddContactOpen(true)} className="mt-2 w-full rounded-2xl px-3 py-2 text-left transition-all hover:-translate-y-0.5" style={{ background: 'rgba(95,184,224,0.10)', border: '1px dashed rgba(95,184,224,0.4)', color: '#9FD8EC' }}>
              <div className="text-xs font-semibold">+ Add contact</div>
              <div className="mt-0.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Decision maker, influencer, billing…</div>
            </button>

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
                <button type="button" onClick={openReassign} className="rounded-full px-3 py-1.5 text-[11px] font-semibold" style={{ background: 'rgba(95,184,224,0.14)', border: '1px solid rgba(95,184,224,0.3)', color: '#9FD8EC' }}>⇄ Reassign rep</button>
              </div>
            )}
          </Section>

          <Section title="Property">
            <div className="mb-2 flex justify-end">
              <button type="button" onClick={() => openEdit('property')} className="rounded-full px-3 py-1 text-[10px] font-semibold" style={{ background: 'rgba(95,184,224,0.14)', border: '1px solid rgba(95,184,224,0.3)', color: '#9FD8EC' }}>Edit property</button>
            </div>
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
              <button type="button" onClick={() => openEdit('property')} className="w-full rounded-2xl px-3 py-3 text-left transition-all hover:-translate-y-0.5" style={{ background: 'rgba(95,184,224,0.08)', border: '1px dashed rgba(95,184,224,0.35)', color: '#9FD8EC' }}>
                <div className="text-xs font-semibold">+ Add property details</div>
                <div className="mt-0.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Address, city, state, and units</div>
              </button>
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
            <button type="button" onClick={openFollowup} className="mb-2 w-full rounded-2xl px-3 py-2.5 text-left transition-all hover:-translate-y-0.5" style={{ background: 'rgba(95,184,224,0.10)', border: '1px solid rgba(95,184,224,0.3)', color: '#9FD8EC' }}>
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
                          <div className="mt-1 flex flex-wrap gap-x-2 text-[10px] uppercase tracking-wide">
                            {t.due_date && <span style={{ color: '#9FD8EC' }}>Due {fmtDate(t.due_date)}</span>}
                            {(t.assigned_to_name || t.owner_name) && <span style={{ color: 'rgba(255,255,255,0.5)' }}>→ {String(t.assigned_to_name || t.owner_name)}</span>}
                          </div>
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
                    onClick={() => action.action === 'schedule_followup' ? openFollowup() : handleAction(action.action)}
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

          {/* Attachments — five labeled buckets, one shared upload. Photo buckets
              render as a thumbnail grid; Quotes/Documents as a file list. Legacy
              files (no category) fall into Documents via the DB default. */}
          {(() => {
            const BUCKETS: { key: string; label: string; accept: string; photo: boolean; hint: string }[] = [
              { key: 'quote_survey',  label: 'Quotes & Surveys', accept: 'application/pdf,image/*', photo: false, hint: 'PDF or image' },
              { key: 'survey_photo',  label: 'Survey Photos',    accept: 'image/*',                photo: true,  hint: 'JPG or PNG' },
              { key: 'document',      label: 'Documents',        accept: '',                       photo: false, hint: 'PDF, image, or document' },
              { key: 'install_photo', label: 'Install Photos',   accept: 'image/*',                photo: true,  hint: 'JPG or PNG' },
              { key: 'service_photo', label: 'Service Photos',   accept: 'image/*',                photo: true,  hint: 'JPG or PNG' },
            ]
            const all = attachments ?? []
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const inCat = (a: any, k: string) => String(a.category ?? 'document') === k
            return (
              <>
                <input ref={fileRef} type="file" multiple className="hidden" onChange={e => { const fs = e.target.files; if (fs && fs.length) void uploadMany(fs, uploadCat.current) }} />
                {BUCKETS.map(b => {
                  const items = all.filter(a => inCat(a, b.key))
                  const busy = fileBusy === b.key
                  return (
                    <Section key={b.key} title={b.label} count={items.length}>
                      {b.key === 'quote_survey' && (
                        <button
                          type="button"
                          disabled={quoteBusy}
                          onClick={createProposal}
                          className="mb-2 w-full rounded-2xl px-3 py-2.5 text-left font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-50"
                          style={{ background: 'linear-gradient(135deg,#2f7fb8,#5FB8E0)', color: 'white' }}
                        >
                          <div className="text-xs font-semibold">{quoteBusy ? 'Creating…' : '✦ Create proposal'}</div>
                          <div className="mt-0.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.85)' }}>Build a quote from this opportunity</div>
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={!!fileBusy}
                        onClick={() => pickInto(b.key, b.accept)}
                        className="mb-2 w-full rounded-2xl px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 disabled:opacity-50"
                        style={{ background: 'rgba(95,184,224,0.10)', border: '1px dashed rgba(95,184,224,0.4)', color: '#9FD8EC' }}
                      >
                        <div className="text-xs font-semibold">{busy ? 'Uploading…' : b.photo ? '+ Add photos' : (b.key === 'quote_survey' ? '+ Attach existing file' : '+ Add file')}</div>
                        <div className="mt-0.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{b.hint}</div>
                      </button>
                      {items.length === 0 ? (
                        <Empty text="Nothing here yet." />
                      ) : b.photo ? (
                        <div className="grid grid-cols-3 gap-2">
                          {items.map((f, i) => {
                            const fid = String(f.id ?? i)
                            const href = (f.url ?? f.public_url) as string | undefined
                            return (
                              <div key={fid} className="group relative aspect-square overflow-hidden rounded-xl" style={{ border: '1px solid rgba(140,170,200,0.2)', background: '#16232f' }}>
                                <button type="button" onClick={() => href && setPreview({ url: href, name: val(f.file_name, 'Photo') })} className="block h-full w-full" title={val(f.file_name, 'Photo')}>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={href} alt={val(f.file_name, 'Photo')} className="h-full w-full object-cover" />
                                </button>
                                <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
                                  <button type="button" title="Rename" onClick={() => renameAttachment(fid, val(f.file_name, 'Photo'))} className="rounded-md px-1.5 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(8,14,22,0.72)', border: '1px solid rgba(95,184,224,0.4)', color: '#9FD8EC' }}>✎</button>
                                  <button type="button" disabled={fileRmBusy === fid} title="Remove" onClick={() => removeFile(fid)} className="rounded-md px-1.5 py-0.5 text-[10px] font-bold disabled:opacity-40" style={{ background: 'rgba(8,14,22,0.72)', border: '1px solid rgba(248,113,113,0.4)', color: '#fca5a5' }}>{fileRmBusy === fid ? '…' : '✕'}</button>
                                </div>
                                <div className="pointer-events-none absolute inset-x-0 bottom-0 truncate px-1.5 py-1 text-[9px]" style={{ background: 'linear-gradient(0deg,rgba(8,14,22,0.85),transparent)', color: 'rgba(255,255,255,0.82)' }}>{val(f.file_name, 'Photo')}</div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {items.map((f, i) => {
                            const fid = String(f.id ?? i)
                            const href = (f.url ?? f.public_url) as string | undefined
                            return (
                              <div key={fid} className="flex items-center justify-between gap-2 rounded-2xl p-3" style={{ background: 'linear-gradient(180deg,#22303f,#1a2532)', border: '1px solid rgba(140,170,200,0.2)' }}>
                                <a href={href || undefined} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                                  <div className="truncate text-xs font-semibold" style={{ color: href ? '#9FD8EC' : 'rgba(255,255,255,0.84)' }}>{val(f.file_name, 'File')}</div>
                                  <div className="truncate text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{[val(f.file_type ?? f.type, ''), fmtDate(f.created_at)].filter(Boolean).join(' · ')}</div>
                                </a>
                                <button type="button" title="Rename" onClick={() => renameAttachment(fid, val(f.file_name, 'File'))} className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold" style={{ background: 'rgba(95,184,224,0.12)', border: '1px solid rgba(95,184,224,0.35)', color: '#9FD8EC' }}>✎</button>
                                <button type="button" disabled={fileRmBusy === fid} title="Remove" onClick={() => removeFile(fid)} className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold disabled:opacity-40" style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.35)', color: '#fca5a5' }}>{fileRmBusy === fid ? '…' : '✕'}</button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </Section>
                  )
                })}
              </>
            )
          })()}

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
