'use client'

import { useState } from 'react'

type AnyRecord = Record<string, any>
type JobAction = 'add_note' | 'create_task' | 'schedule_visit' | 'mark_complete'

type JobGlassData = {
  job?: AnyRecord | null
  site?: AnyRecord | null
  customer?: AnyRecord | null
  assignedTeam?: AnyRecord[]
  tasks?: AnyRecord[]
  checklist?: AnyRecord[]
  notes?: AnyRecord[]
  parts?: AnyRecord[]
  files?: AnyRecord[]
  subWorkOrders?: AnyRecord[]
  fieldTickets?: AnyRecord[]
  timeEntries?: AnyRecord[]
  nextBestActions?: Array<{ title: string; subtitle: string; action: string }>
}

function val(v: unknown, fallback = 'Not set') {
  if (v === null || v === undefined || v === '') return fallback
  return String(v)
}

function Section({ title, children, count }: { title: string; children: React.ReactNode; count?: number }) {
  return (
    <div className="rounded-3xl p-4" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{title}</div>
        {typeof count === 'number' && count > 0 && (
          <div className="rounded-full px-2 py-1 text-[10px]" style={{ background: 'rgba(52,211,153,0.12)', color: 'rgba(110,231,183,0.9)' }}>{count}</div>
        )}
      </div>
      {children}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.38)' }}>{text}</div>
}

function MiniRow({ title, subtitle, meta }: { title: string; subtitle?: string; meta?: string }) {
  return (
    <div className="rounded-2xl p-3" style={{ background: 'rgba(0,0,0,0.16)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.84)' }}>{title}</div>
        {meta && <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: 'rgba(110,231,183,0.8)', whiteSpace: 'nowrap' }}>{meta}</div>}
      </div>
      {subtitle && <div className="mt-1 text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.42)' }}>{subtitle}</div>}
    </div>
  )
}

function ListBlock({ records, emptyText, render }: { records?: AnyRecord[]; emptyText: string; render: (r: AnyRecord) => React.ReactNode }) {
  if (!records || records.length === 0) return <Empty text={emptyText} />
  return <div className="space-y-2">{records.slice(0, 8).map((r, i) => <div key={r.id ?? i}>{render(r)}</div>)}</div>
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl p-3" style={{ background: 'rgba(0,0,0,0.16)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.34)' }}>{label}</div>
      <div className="mt-1 truncate text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.82)' }}>{value}</div>
    </div>
  )
}

function statusColor(status: string): string {
  const s = status.toLowerCase()
  if (['completed', 'done'].includes(s)) return '#34d399'
  if (['cancelled', 'closed'].includes(s)) return '#94a3b8'
  if (['in_progress', 'in-progress'].includes(s)) return '#6B7EFF'
  if (s === 'scheduled') return '#fbbf24'
  return '#34d399'
}

function priorityColor(priority: string): string {
  const p = priority.toLowerCase()
  if (['urgent', 'critical'].includes(p)) return '#ef4444'
  if (p === 'high') return '#f97316'
  if (p === 'low') return '#94a3b8'
  return '#6B7EFF'
}

function ActionButton({ title, subtitle, active, disabled, onClick }: { title: string; subtitle: string; active?: boolean; disabled?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-full rounded-2xl p-3 text-left transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
      style={{
        background: active ? 'rgba(52,211,153,0.14)' : 'rgba(52,211,153,0.07)',
        border: active ? '1px solid rgba(52,211,153,0.32)' : '1px solid rgba(52,211,153,0.16)',
        color: 'rgba(255,255,255,0.86)',
      }}
    >
      <div className="text-xs font-semibold">{title}</div>
      <div className="mt-0.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.42)' }}>{subtitle}</div>
    </button>
  )
}

function FieldLabel({ label, helper }: { label: string; helper?: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.58)' }}>{label}</div>
      {helper && <div className="mt-0.5 text-[10px]" style={{ color: 'rgba(255,255,255,0.34)' }}>{helper}</div>}
    </div>
  )
}

export function JobGlassWindow({
  data,
  onBack,
  onRefresh,
}: {
  data: JobGlassData
  onBack: () => void
  onRefresh?: () => Promise<void> | void
}) {
  const job = data.job ?? {}
  const site = data.site
  const customer = data.customer
  const assignedTeam = data.assignedTeam ?? []
  const tasks = data.tasks ?? []
  const checklist = data.checklist ?? []
  const notes = data.notes ?? []
  const parts = data.parts ?? []
  const files = data.files ?? []
  const subWorkOrders = data.subWorkOrders ?? []
  const allTasks = [...tasks, ...checklist]
  const status = val(job.status, 'open')
  const priority = val(job.priority, 'normal')

  const [activeAction, setActiveAction] = useState<JobAction | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDueDate, setTaskDueDate] = useState('')
  const [taskNotes, setTaskNotes] = useState('')
  const [taskPriority, setTaskPriority] = useState('normal')
  const [visitDate, setVisitDate] = useState('')
  const [visitNote, setVisitNote] = useState('')
  const [completeNote, setCompleteNote] = useState('')

  async function submitJobAction(payload: Record<string, unknown>) {
    const jobId = job.id
    if (!jobId) {
      setActionMessage('Job is missing an ID.')
      return
    }

    setActionBusy(true)
    setActionMessage(null)

    try {
      const res = await fetch(`/api/nexus/jobs/job-window/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok || result.success === false) throw new Error(result?.message ?? 'Nexus could not complete that action.')

      setActionMessage(result?.message ?? 'Done.')
      setActiveAction(null)
      setNoteText('')
      setTaskTitle('')
      setTaskDueDate('')
      setTaskNotes('')
      setTaskPriority('normal')
      setVisitDate('')
      setVisitNote('')
      setCompleteNote('')
      await onRefresh?.()
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'That did not work. Try again.')
    } finally {
      setActionBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[2rem] p-5" style={{ background: 'linear-gradient(145deg, rgba(52,211,153,0.12), rgba(255,255,255,0.035))', border: '1px solid rgba(52,211,153,0.2)', boxShadow: '0 20px 70px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <button type="button" onClick={onBack} className="mb-4 rounded-full px-3 py-1.5 text-[11px] transition-opacity hover:opacity-80" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.58)' }}>← Back to jobs</button>
            <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'rgba(52,211,153,0.8)' }}>Job</div>
            <h3 className="mt-2 text-2xl font-semibold leading-tight" style={{ color: 'rgba(255,255,255,0.94)' }}>{val(job.title, 'Untitled Job')}</h3>
            <div className="mt-1.5 text-xs font-mono" style={{ color: 'rgba(255,255,255,0.45)' }}>{val(job.wo_number, '—')}</div>
            <div className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{val(job.customer_name ?? site?.name, 'No customer linked')}</div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="rounded-2xl px-3 py-2 text-center" style={{ background: 'rgba(0,0,0,0.18)', border: `1px solid ${statusColor(status)}33` }}>
              <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: 'rgba(255,255,255,0.38)' }}>Status</div>
              <div className="mt-1 text-xs font-semibold" style={{ color: statusColor(status) }}>{status}</div>
            </div>
            <div className="rounded-2xl px-3 py-2 text-center" style={{ background: 'rgba(0,0,0,0.18)', border: `1px solid ${priorityColor(priority)}33` }}>
              <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: 'rgba(255,255,255,0.38)' }}>Priority</div>
              <div className="mt-1 text-xs font-semibold" style={{ color: priorityColor(priority) }}>{priority}</div>
            </div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Type" value={val(job.job_type ?? job.category, 'Not set')} />
          <MiniStat label="Scheduled" value={val(job.scheduled_date, 'Not scheduled')} />
          <MiniStat label="Due" value={val(job.due_date, 'No due date')} />
          <MiniStat label="Updated" value={val(job.updated_at ?? job.created_at, '—')} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Section title="Overview">
            <div className="grid gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.62)' }}>
              <div>Description: {val(job.description ?? job.notes, 'No description yet')}</div>
              {job.location && <div>Location on site: {job.location}</div>}
              {job.estimated_hours && <div>Estimated hours: {job.estimated_hours}</div>}
            </div>
          </Section>

          <Section title="Site">
            {site ? (
              <div className="space-y-2">
                <MiniRow title={val(site.name, 'Site')} subtitle={[site.address, site.city, site.state, site.zip].filter(Boolean).join(', ')} meta={site.property_type ?? undefined} />
                {(site.primary_contact_name || site.primary_contact_email || site.primary_contact_phone) && <MiniRow title={val(site.primary_contact_name, 'Site Contact')} subtitle={[site.primary_contact_email, site.primary_contact_phone].filter(Boolean).join(' • ')} meta="Contact" />}
              </div>
            ) : <Empty text="No site linked yet." />}
          </Section>

          <Section title="Customer">
            {customer ? <MiniRow title={val(customer.name, 'Customer')} /> : <Empty text="No customer linked yet." />}
          </Section>

          <Section title="Assigned Team" count={assignedTeam.length}>
            <ListBlock records={assignedTeam} emptyText="No one assigned yet." render={member => <MiniRow title={val(member.name, 'Team member')} subtitle={[member.email, member.phone].filter(Boolean).join(' • ')} meta={member.role ?? 'Technician'} />} />
          </Section>

          <Section title="Tasks" count={allTasks.length}>
            {allTasks.length === 0 ? <Empty text="No tasks attached yet." /> : (
              <div className="space-y-2">
                {tasks.slice(0, 6).map((t, i) => <MiniRow key={t.id ?? i} title={val(t.title, 'Task')} subtitle={val(t.body, '')} meta={val(t.status ?? t.due_date, '')} />)}
                {checklist.slice(0, 6).map((c, i) => <MiniRow key={c.id ?? i} title={val(c.title, 'Checklist item')} meta={c.completed ? 'Done' : 'Open'} />)}
              </div>
            )}
          </Section>

          <Section title="Notes" count={notes.length}>
            <ListBlock records={notes} emptyText="No notes yet." render={n => <MiniRow title={val(n.content, 'Note')} subtitle={val(n.author_name, '')} meta={val(n.created_at, '')} />} />
          </Section>

          <Section title="Related Work Orders" count={subWorkOrders.length}>
            <ListBlock records={subWorkOrders} emptyText="No sub work orders." render={wo => <MiniRow title={val(wo.title, 'Work order')} subtitle={val(wo.wo_number, '')} meta={val(wo.status, '')} />} />
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Next Best Actions">
            <div className="space-y-2">
              <ActionButton title="Add Note" subtitle="Capture what happened or what is next." active={activeAction === 'add_note'} onClick={() => { setActiveAction(activeAction === 'add_note' ? null : 'add_note'); setActionMessage(null) }} />
              <ActionButton title="Create Task" subtitle="Add something that needs to get done." active={activeAction === 'create_task'} onClick={() => { setActiveAction(activeAction === 'create_task' ? null : 'create_task'); setActionMessage(null) }} />
              <ActionButton title="Schedule Visit" subtitle="Put the next site visit on the calendar." active={activeAction === 'schedule_visit'} onClick={() => { setActiveAction(activeAction === 'schedule_visit' ? null : 'schedule_visit'); setActionMessage(null) }} />
              <ActionButton title="Mark Complete" subtitle="Close this job when work is done." active={activeAction === 'mark_complete'} onClick={() => { setActiveAction(activeAction === 'mark_complete' ? null : 'mark_complete'); setActionMessage(null) }} />
              <ActionButton title="Assign Team" subtitle="Coming in a future stage." disabled />
              <ActionButton title="Upload File" subtitle="Coming in a future stage." disabled />

              {activeAction === 'add_note' && (
                <div className="space-y-2 rounded-2xl p-3" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(52,211,153,0.22)' }}>
                  <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="What should Nexus remember about this job?" rows={3} className="w-full resize-none rounded-xl px-3 py-2 text-xs outline-none" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(52,211,153,0.2)', color: 'rgba(255,255,255,0.88)' }} />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setActiveAction(null)} className="rounded-full px-3 py-1.5 text-[11px]" style={{ background: 'rgba(255,255,255,0.045)', color: 'rgba(255,255,255,0.5)' }}>Cancel</button>
                    <button type="button" disabled={actionBusy || !noteText.trim()} onClick={() => submitJobAction({ action: 'add_note', note: noteText })} className="rounded-full px-3 py-1.5 text-[11px] disabled:opacity-40" style={{ background: '#34d399', color: '#06120c' }}>{actionBusy ? 'Saving...' : 'Save Note'}</button>
                  </div>
                </div>
              )}

              {activeAction === 'create_task' && (
                <div className="space-y-2 rounded-2xl p-3" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(52,211,153,0.22)' }}>
                  <input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="What needs to get done?" className="w-full rounded-xl px-3 py-2 text-xs outline-none" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(52,211,153,0.2)', color: 'rgba(255,255,255,0.88)' }} />
                  <FieldLabel label="Due Date" helper="Pick when this task should be done." />
                  <input type="date" value={taskDueDate} onChange={e => setTaskDueDate(e.target.value)} className="w-full rounded-xl px-3 py-2 text-xs outline-none" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.88)' }} />
                  <FieldLabel label="Priority" />
                  <select value={taskPriority} onChange={e => setTaskPriority(e.target.value)} className="w-full rounded-xl px-3 py-2 text-xs outline-none" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.88)' }}>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="low">Low</option>
                  </select>
                  <textarea value={taskNotes} onChange={e => setTaskNotes(e.target.value)} placeholder="Anything to remember?" rows={2} className="w-full resize-none rounded-xl px-3 py-2 text-xs outline-none" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.88)' }} />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setActiveAction(null)} className="rounded-full px-3 py-1.5 text-[11px]" style={{ background: 'rgba(255,255,255,0.045)', color: 'rgba(255,255,255,0.5)' }}>Cancel</button>
                    <button type="button" disabled={actionBusy || !taskTitle.trim()} onClick={() => submitJobAction({ action: 'create_task', title: taskTitle, due_date: taskDueDate, notes: taskNotes, priority: taskPriority })} className="rounded-full px-3 py-1.5 text-[11px] disabled:opacity-40" style={{ background: '#34d399', color: '#06120c' }}>{actionBusy ? 'Creating...' : 'Create Task'}</button>
                  </div>
                </div>
              )}

              {activeAction === 'schedule_visit' && (
                <div className="space-y-2 rounded-2xl p-3" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(52,211,153,0.22)' }}>
                  <FieldLabel label="Visit Date" helper="Pick when the team should go." />
                  <input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} className="w-full rounded-xl px-3 py-2 text-xs outline-none" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(52,211,153,0.2)', color: 'rgba(255,255,255,0.88)' }} />
                  <textarea value={visitNote} onChange={e => setVisitNote(e.target.value)} placeholder="Optional note for the team, like gate code or best arrival time." rows={2} className="w-full resize-none rounded-xl px-3 py-2 text-xs outline-none" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.88)' }} />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setActiveAction(null)} className="rounded-full px-3 py-1.5 text-[11px]" style={{ background: 'rgba(255,255,255,0.045)', color: 'rgba(255,255,255,0.5)' }}>Cancel</button>
                    <button type="button" disabled={actionBusy || !visitDate} onClick={() => submitJobAction({ action: 'schedule_visit', scheduled_date: visitDate, note: visitNote })} className="rounded-full px-3 py-1.5 text-[11px] disabled:opacity-40" style={{ background: '#34d399', color: '#06120c' }}>{actionBusy ? 'Scheduling...' : 'Schedule Visit'}</button>
                  </div>
                </div>
              )}

              {activeAction === 'mark_complete' && (
                <div className="space-y-2 rounded-2xl p-3" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(52,211,153,0.22)' }}>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.66)' }}>This will mark the job complete.</p>
                  <textarea value={completeNote} onChange={e => setCompleteNote(e.target.value)} placeholder="Anything to note before closing this job?" rows={2} className="w-full resize-none rounded-xl px-3 py-2 text-xs outline-none" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.88)' }} />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setActiveAction(null)} className="rounded-full px-3 py-1.5 text-[11px]" style={{ background: 'rgba(255,255,255,0.045)', color: 'rgba(255,255,255,0.5)' }}>Cancel</button>
                    <button type="button" disabled={actionBusy} onClick={() => submitJobAction({ action: 'mark_complete', note: completeNote })} className="rounded-full px-3 py-1.5 text-[11px] disabled:opacity-40" style={{ background: '#34d399', color: '#06120c' }}>{actionBusy ? 'Closing...' : 'Mark Complete'}</button>
                  </div>
                </div>
              )}

              {actionMessage && <div className="rounded-2xl px-3 py-2 text-[11px]" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.18)', color: 'rgba(255,255,255,0.72)' }}>{actionMessage}</div>}
            </div>
          </Section>

          <Section title="Files" count={files.length}>
            <ListBlock records={files} emptyText="No files attached yet." render={f => <MiniRow title={val(f.file_name, 'File')} subtitle={val(f.file_type ?? f.type, '')} />} />
          </Section>

          {parts.length > 0 && (
            <Section title="Parts Used" count={parts.length}>
              <ListBlock records={parts} emptyText="No parts logged." render={p => <MiniRow title={val(p.part_name, 'Part')} subtitle={p.part_number ? `#${p.part_number}` : undefined} meta={`Qty: ${p.quantity ?? 1}`} />} />
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}
