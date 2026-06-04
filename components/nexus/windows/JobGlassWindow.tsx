'use client'

type AnyRecord = Record<string, any>

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

export function JobGlassWindow({ data, onBack }: { data: JobGlassData; onBack: () => void }) {
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
  const nextBestActions = data.nextBestActions ?? []
  const allTasks = [...tasks, ...checklist]
  const status = val(job.status, 'open')
  const priority = val(job.priority, 'normal')

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
              {nextBestActions.map(action => (
                <button key={action.action} type="button" disabled title="Coming next" className="w-full rounded-2xl p-3 text-left opacity-60" style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.16)', color: 'rgba(255,255,255,0.86)' }}>
                  <div className="text-xs font-semibold">{action.title}</div>
                  <div className="mt-0.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.42)' }}>{action.subtitle}</div>
                </button>
              ))}
              <p className="mt-1 text-center text-[10px]" style={{ color: 'rgba(255,255,255,0.28)' }}>Actions coming in Stage 2</p>
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
