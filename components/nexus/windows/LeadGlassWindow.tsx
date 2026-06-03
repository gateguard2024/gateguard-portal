'use client'

type AnyRecord = Record<string, any>

type LeadGlassData = {
  lead?: AnyRecord | null
  people?: {
    primaryContact?: AnyRecord | null
    contacts?: AnyRecord[]
  }
  company?: AnyRecord | null
  properties?: {
    linked?: AnyRecord[]
    possible?: AnyRecord[]
    sites?: AnyRecord[]
  }
  activity?: {
    activities?: AnyRecord[]
    crmActivities?: AnyRecord[]
  }
  todos?: AnyRecord[]
  attachments?: AnyRecord[]
  surveys?: AnyRecord[]
  opportunities?: AnyRecord[]
  nextBestActions?: Array<{ title: string; subtitle: string; action: string }>
}

function value(value: unknown, fallback = 'Not added yet') {
  if (value === null || value === undefined || value === '') return fallback
  return String(value)
}

function personName(person?: AnyRecord | null) {
  if (!person) return 'No contact linked yet'
  return [person.first_name, person.last_name].filter(Boolean).join(' ') || person.contact_name || person.name || 'Unnamed contact'
}

function Section({ title, children, count }: { title: string; children: React.ReactNode; count?: number }) {
  return (
    <div className="rounded-3xl p-4" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{title}</div>
        {typeof count === 'number' && <div className="rounded-full px-2 py-1 text-[10px]" style={{ background: 'rgba(107,126,255,0.12)', color: 'rgba(165,180,255,0.9)' }}>{count}</div>}
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
        {meta && <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.34)' }}>{meta}</div>}
      </div>
      {subtitle && <div className="mt-1 text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.42)' }}>{subtitle}</div>}
    </div>
  )
}

function ListBlock({ records, emptyText, render }: { records?: AnyRecord[]; emptyText: string; render: (record: AnyRecord) => React.ReactNode }) {
  if (!records || records.length === 0) return <Empty text={emptyText} />
  return <div className="space-y-2">{records.slice(0, 6).map((record, index) => <div key={record.id ?? index}>{render(record)}</div>)}</div>
}

export function LeadGlassWindow({ data, onBack }: { data: LeadGlassData; onBack: () => void }) {
  const lead = data.lead ?? {}
  const contacts = data.people?.contacts ?? []
  const primaryContact = data.people?.primaryContact
  const company = data.company
  const linkedProperties = data.properties?.linked ?? []
  const possibleProperties = data.properties?.possible ?? []
  const sites = data.properties?.sites ?? []
  const activities = [...(data.activity?.crmActivities ?? []), ...(data.activity?.activities ?? [])]
  const nextBestActions = data.nextBestActions ?? []

  return (
    <div className="space-y-4">
      <div className="rounded-[2rem] p-5" style={{ background: 'linear-gradient(145deg, rgba(107,126,255,0.16), rgba(255,255,255,0.035))', border: '1px solid rgba(107,126,255,0.24)', boxShadow: '0 20px 70px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <button type="button" onClick={onBack} className="mb-4 rounded-full px-3 py-1.5 text-[11px]" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.58)' }}>← Back to workbench</button>
            <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'rgba(165,180,255,0.85)' }}>Lead Glass Window</div>
            <h3 className="mt-2 text-2xl font-semibold leading-tight" style={{ color: 'rgba(255,255,255,0.94)' }}>{value(lead.contact_name ?? lead.name, 'Unnamed lead')}</h3>
            <div className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{value(lead.company_name ?? company?.name, 'No company attached')}</div>
          </div>
          <div className="rounded-2xl px-4 py-3 text-right" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: 'rgba(255,255,255,0.38)' }}>Stage</div>
            <div className="mt-1 text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.88)' }}>{value(lead.stage, 'open')}</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Source" value={value(lead.source, 'Unknown')} />
          <MiniStat label="Units" value={value(lead.unit_count, 'Unknown')} />
          <MiniStat label="Property" value={value(lead.location, 'Not attached')} />
          <MiniStat label="Updated" value={value(lead.updated_at ?? lead.created_at, 'Unknown')} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Section title="Overview">
            <div className="grid gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.62)' }}>
              <div>Need / Notes: {value(lead.notes, 'No notes yet')}</div>
              <div>Email: {value(lead.email)}</div>
              <div>Phone: {value(lead.phone)}</div>
            </div>
          </Section>

          <Section title="People" count={contacts.length}>
            {primaryContact && <MiniRow title={personName(primaryContact)} subtitle={[primaryContact.title, primaryContact.email, primaryContact.phone].filter(Boolean).join(' • ')} meta="Primary" />}
            <div className="mt-2">
              <ListBlock records={contacts.filter(contact => contact.id !== primaryContact?.id)} emptyText="No additional contacts linked yet." render={contact => <MiniRow title={personName(contact)} subtitle={[contact.title, contact.email, contact.phone].filter(Boolean).join(' • ')} />} />
            </div>
          </Section>

          <Section title="Property / Site" count={linkedProperties.length + possibleProperties.length + sites.length}>
            <ListBlock records={[...linkedProperties.map(item => item.properties ?? item), ...possibleProperties, ...sites]} emptyText="No property or site linked yet." render={property => <MiniRow title={value(property.name, 'Unnamed property')} subtitle={[property.address, property.city, property.state, property.zip].filter(Boolean).join(', ')} meta={property.units || property.unit_count ? `${property.units ?? property.unit_count} units` : undefined} />} />
          </Section>

          <Section title="Activity Timeline" count={activities.length}>
            <ListBlock records={activities} emptyText="No activity yet." render={activity => <MiniRow title={value(activity.subject, value(activity.type, 'Activity'))} subtitle={value(activity.body ?? activity.outcome, '')} meta={value(activity.created_at, '')} />} />
          </Section>

          <Section title="Tasks" count={data.todos?.length ?? 0}>
            <ListBlock records={data.todos} emptyText="No tasks attached yet." render={todo => <MiniRow title={value(todo.title, 'Task')} subtitle={value(todo.body, '')} meta={value(todo.status ?? todo.due_date, '')} />} />
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Next Best Actions" count={nextBestActions.length}>
            <div className="space-y-2">
              {nextBestActions.map(action => <button key={action.action} type="button" className="w-full rounded-2xl p-3 text-left transition-all hover:-translate-y-0.5" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.18)', color: 'rgba(255,255,255,0.86)' }}><div className="text-xs font-semibold">{action.title}</div><div className="mt-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.42)' }}>{action.subtitle}</div></button>)}
            </div>
          </Section>

          <Section title="Files" count={data.attachments?.length ?? 0}>
            <ListBlock records={data.attachments} emptyText="No files attached yet." render={file => <MiniRow title={value(file.file_name, 'File')} subtitle={value(file.file_type ?? file.type, '')} />} />
          </Section>

          <Section title="Surveys" count={data.surveys?.length ?? 0}>
            <ListBlock records={data.surveys} emptyText="No surveys found yet." render={survey => <MiniRow title={value(survey.survey_number ?? survey.property_name, 'Survey')} subtitle={value(survey.ai_summary, 'No summary yet')} meta={value(survey.status, '')} />} />
          </Section>

          <Section title="Related Opportunities" count={data.opportunities?.length ?? 0}>
            <ListBlock records={data.opportunities} emptyText="No related opportunities yet." render={opp => <MiniRow title={value(opp.name, 'Opportunity')} subtitle={value(opp.next_step ?? opp.account_name, '')} meta={value(opp.stage, '')} />} />
          </Section>
        </div>
      </div>
    </div>
  )
}

function MiniStat({ label, value: statValue }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl p-3" style={{ background: 'rgba(0,0,0,0.16)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.34)' }}>{label}</div>
      <div className="mt-1 truncate text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.82)' }}>{statValue}</div>
    </div>
  )
}
