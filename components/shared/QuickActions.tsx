'use client'

import { useState } from 'react'
import { Mail, X, Send, Plus } from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { CheckSquare } = require('lucide-react') as any

export type QuickActionsRecordType = 'lead' | 'opportunity' | 'site' | 'work_order' | 'customer'

export interface QuickActionsProps {
  recordType: QuickActionsRecordType
  recordId: string
  recordName: string
  contactEmail?: string
  contactName?: string
  onActivityCreated?: () => void
}

type ModalType = 'email' | 'todo' | 'activity' | null
type ActivityType = 'Call' | 'Email' | 'Meeting' | 'Note' | 'Task'

const inputCls =
  'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white'
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1'

export function QuickActions({
  recordType,
  recordId,
  recordName,
  contactEmail = '',
  contactName  = '',
  onActivityCreated,
}: QuickActionsProps) {
  const [modal, setModal] = useState<ModalType>(null)

  // ── Email state ────────────────────────────────────────────────────────
  const [emailTo,      setEmailTo]      = useState(contactEmail)
  const [emailSubject, setEmailSubject] = useState(`Re: ${recordName}`)
  const [emailBody,    setEmailBody]    = useState('')
  const [emailStatus,  setEmailStatus]  = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [emailError,   setEmailError]   = useState('')

  // ── To-Do state ────────────────────────────────────────────────────────
  const [todoText,    setTodoText]    = useState('')
  const [todoOwner,   setTodoOwner]   = useState(contactName)
  const [todoDueDate, setTodoDueDate] = useState('')
  const [todoStatus,  setTodoStatus]  = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [todoError,   setTodoError]   = useState('')

  // ── Log Activity state ─────────────────────────────────────────────────
  const [actType,      setActType]      = useState<ActivityType>('Call')
  const [actDirection, setActDirection] = useState<'Inbound' | 'Outbound'>('Outbound')
  const [actSubject,   setActSubject]   = useState('')
  const [actBody,      setActBody]      = useState('')
  const [actOutcome,   setActOutcome]   = useState('')
  const [actStatus,    setActStatus]    = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [actError,     setActError]     = useState('')

  function openModal(type: ModalType) {
    // Reset per-modal state when opening
    if (type === 'email') {
      setEmailTo(contactEmail)
      setEmailSubject(`Re: ${recordName}`)
      setEmailBody('')
      setEmailStatus('idle')
      setEmailError('')
    } else if (type === 'todo') {
      setTodoText('')
      setTodoOwner('')
      setTodoDueDate('')
      setTodoStatus('idle')
      setTodoError('')
    } else if (type === 'activity') {
      setActType('Call')
      setActDirection('Outbound')
      setActSubject('')
      setActBody('')
      setActOutcome('')
      setActStatus('idle')
      setActError('')
    }
    setModal(type)
  }

  function closeModal() { setModal(null) }

  // ── Handlers ───────────────────────────────────────────────────────────

  async function handleSendEmail() {
    if (!emailTo || !emailSubject || !emailBody) {
      setEmailError('To, subject, and body are all required.')
      return
    }
    setEmailStatus('sending')
    setEmailError('')
    try {
      // 1. Send via email endpoint
      const sendRes = await fetch('/api/crm/email/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_email:    emailTo,
          to_name:     contactName || undefined,
          subject:     emailSubject,
          body:        emailBody,
          // Pass record linkage so the activity is tracked
          // Show leads have "show_" prefix IDs — strip it and use show_lead_id FK
          ...(recordType === 'lead' && recordId.startsWith('show_')
            ? { show_lead_id: recordId.replace(/^show_/, '') }
            : recordType === 'lead'
            ? { lead_id: recordId }
            : {}),
          ...(recordType === 'opportunity' && { opportunity_id: recordId }),
        }),
      })

      // 2. Also log to universal activities (for site / work_order / customer)
      if (recordType !== 'lead' && recordType !== 'opportunity') {
        await fetch('/api/activities', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            record_type: recordType,
            record_id:   recordId,
            type:        'email',
            subject:     emailSubject,
            body:        emailBody,
            direction:   'Outbound',
          }),
        })
      }

      if (!sendRes.ok) {
        const j = await sendRes.json().catch(() => ({}))
        throw new Error(j.error ?? 'Email failed to send')
      }

      setEmailStatus('sent')
      onActivityCreated?.()
    } catch (err: unknown) {
      setEmailStatus('error')
      setEmailError(err instanceof Error ? err.message : 'Failed to send email')
    }
  }

  async function handleCreateTodo() {
    if (!todoText.trim()) {
      setTodoError('Task description is required.')
      return
    }
    setTodoStatus('saving')
    setTodoError('')
    try {
      const res = await fetch('/api/todos', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:        todoText.trim(),
          due_date:     todoDueDate || null,
          linked_type:  recordType,
          linked_id:    recordId,
          linked_label: recordName,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'Failed to create to-do')
      }
      setTodoStatus('saved')
      onActivityCreated?.()
    } catch (err: unknown) {
      setTodoStatus('error')
      setTodoError(err instanceof Error ? err.message : 'Failed to create to-do')
    }
  }

  async function handleLogActivity() {
    if (!actSubject.trim()) {
      setActError('Subject is required.')
      return
    }
    setActStatus('saving')
    setActError('')
    try {
      const res = await fetch('/api/activities', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record_type: recordType,
          record_id:   recordId,
          type:        actType,
          subject:     actSubject.trim(),
          body:        actBody.trim() || null,
          outcome:     actOutcome.trim() || null,
          direction:   (actType === 'Call' || actType === 'Email') ? actDirection : null,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'Failed to log activity')
      }
      setActStatus('saved')
      onActivityCreated?.()
      setTimeout(closeModal, 800)
    } catch (err: unknown) {
      setActStatus('error')
      setActError(err instanceof Error ? err.message : 'Failed to log activity')
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      {/* Action button row */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => openModal('email')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
        >
          <Mail size={13} /> Email
        </button>
        <button
          onClick={() => openModal('todo')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-50 transition-colors"
        >
          <CheckSquare size={13} /> To-Do
        </button>
        <button
          onClick={() => openModal('activity')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <Plus size={13} /> Log Activity
        </button>
      </div>

      {/* Overlay */}
      {modal && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            {/* ── Email Modal ── */}
            {modal === 'email' && (
              <>
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                  <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Mail size={14} className="text-blue-500" /> Send Email
                  </h2>
                  <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-slate-100">
                    <X size={14} className="text-slate-500" />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className={labelCls}>To</label>
                    <input
                      type="email"
                      value={emailTo}
                      onChange={e => setEmailTo(e.target.value)}
                      placeholder="recipient@email.com"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Subject</label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={e => setEmailSubject(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Body</label>
                    <textarea
                      rows={6}
                      value={emailBody}
                      onChange={e => setEmailBody(e.target.value)}
                      placeholder="Type your message…"
                      className={inputCls}
                    />
                  </div>
                  {emailError && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{emailError}</p>
                  )}
                  {emailStatus === 'sent' && (
                    <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">Email sent successfully.</p>
                  )}
                </div>
                <div className="px-5 pb-5">
                  <button
                    onClick={handleSendEmail}
                    disabled={emailStatus === 'sending' || emailStatus === 'sent'}
                    className="w-full bg-brand-400 text-white rounded-lg py-2 text-sm font-medium hover:bg-brand-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Send size={13} />
                    {emailStatus === 'sending' ? 'Sending…' : emailStatus === 'sent' ? 'Sent!' : 'Send Email'}
                  </button>
                </div>
              </>
            )}

            {/* ── To-Do Modal ── */}
            {modal === 'todo' && (
              <>
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                  <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <CheckSquare size={14} className="text-amber-500" /> Create To-Do
                  </h2>
                  <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-slate-100">
                    <X size={14} className="text-slate-500" />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className={labelCls}>Task *</label>
                    <textarea
                      rows={3}
                      value={todoText}
                      onChange={e => setTodoText(e.target.value)}
                      placeholder="What needs to be done?"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Due Date</label>
                    <input
                      type="date"
                      value={todoDueDate}
                      onChange={e => setTodoDueDate(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div className="text-[11px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                    Linked to: <span className="font-medium text-slate-700">{recordName}</span>
                  </div>
                  {todoError && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{todoError}</p>
                  )}
                  {todoStatus === 'saved' && (
                    <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">To-Do created successfully.</p>
                  )}
                </div>
                <div className="px-5 pb-5">
                  <button
                    onClick={handleCreateTodo}
                    disabled={todoStatus === 'saving' || todoStatus === 'saved'}
                    className="w-full bg-brand-400 text-white rounded-lg py-2 text-sm font-medium hover:bg-brand-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Plus size={13} />
                    {todoStatus === 'saving' ? 'Creating…' : todoStatus === 'saved' ? 'Created!' : 'Create To-Do'}
                  </button>
                </div>
              </>
            )}

            {/* ── Log Activity Modal ── */}
            {modal === 'activity' && (
              <>
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                  <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Plus size={14} className="text-slate-500" /> Log Activity
                  </h2>
                  <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-slate-100">
                    <X size={14} className="text-slate-500" />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Type</label>
                      <select
                        value={actType}
                        onChange={e => setActType(e.target.value as ActivityType)}
                        className={inputCls}
                      >
                        {(['Call', 'Email', 'Meeting', 'Note', 'Task'] as ActivityType[]).map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    {(actType === 'Call' || actType === 'Email') && (
                      <div>
                        <label className={labelCls}>Direction</label>
                        <select
                          value={actDirection}
                          onChange={e => setActDirection(e.target.value as 'Inbound' | 'Outbound')}
                          className={inputCls}
                        >
                          <option value="Outbound">Outbound</option>
                          <option value="Inbound">Inbound</option>
                        </select>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Subject *</label>
                    <input
                      type="text"
                      value={actSubject}
                      onChange={e => setActSubject(e.target.value)}
                      placeholder="e.g. Follow-up call, Sent proposal…"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Notes / Body</label>
                    <textarea
                      rows={3}
                      value={actBody}
                      onChange={e => setActBody(e.target.value)}
                      placeholder="Additional details (optional)…"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Outcome</label>
                    <input
                      type="text"
                      value={actOutcome}
                      onChange={e => setActOutcome(e.target.value)}
                      placeholder="e.g. Left voicemail, Scheduled demo…"
                      className={inputCls}
                    />
                  </div>
                  {actError && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{actError}</p>
                  )}
                  {actStatus === 'saved' && (
                    <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">Activity logged.</p>
                  )}
                </div>
                <div className="px-5 pb-5">
                  <button
                    onClick={handleLogActivity}
                    disabled={actStatus === 'saving' || actStatus === 'saved'}
                    className="w-full bg-brand-400 text-white rounded-lg py-2 text-sm font-medium hover:bg-brand-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Plus size={13} />
                    {actStatus === 'saving' ? 'Logging…' : actStatus === 'saved' ? 'Logged!' : 'Log Activity'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
