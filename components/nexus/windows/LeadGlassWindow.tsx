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

function val(v: unknown, fallback = 'Not added yet') {
  if (v === null || v === undefined || v === '') return fallback
  return String(v)
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
        {typeof count === 'number' && count > 0 && (
          <div className="rounded-full px-2 py-1 text-[10px]" style={{ background: 'rgba(107,126,255,0.12)', color: 'rgba(165,180,255,0.9)' }}>{count}</div>
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
        {meta && <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.34)', whiteSpace: 'nowrap' }}>{meta}</div>}
      </div>
      {subtitle && <div className="mt-1 text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.42)' }}>{subtitle}</div>}
    </div>
  )
}

function ListBlock({ records, emptyText, render }: { records?: AnyRecord[]; emptyText: string; render: (record: AnyRecord) => React.ReactNode }) {
  if (!records || records.length === 0) return <Empty text={emptyText} />
  return <div className="space-y-2">{records.slice(0, 6).map((record, index) => <div key={record.id ?? index}>{render(record)}</div>)}</div>
}

function DuplicateGuardSection({ data }: { data: LeadGlassData }) {
  const contacts = data.people?.contacts ?? []
  const company = data.company
  const possibleProperties = data.properties?.possible ?? []
  const sites = data.properties?.sites ?? []
  const opportunities = data.opportunities ?? []

  const hasContacts = contacts.length > 0
  const hasCompany = !!company
  const hasProperties = possibleProperties.length > 0
  const hasSites = sites.length > 0
  const hasOpps = opportunities.length > 0
  const totalMatches = (hasContacts ? contacts.length : 0) + (hasCompany ? 1 : 0) + possibleProperties.length + sites.length + opportunities.length

  return (
    <Section title="Possible Matches — Duplicate Guard" count={totalMatches}>
      <p className="mb-4 text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.38)' }}>
        Before creating new records, check these existing matches. Update and link instead of duplicating.
        Display only — no actions yet.
      </p>

      {/* Contact Matches */}
      <div className="mb-3">
        <div className="mb-2 text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(107,126,255,0.7)' }}>
          Possible Contact Matches ({contacts.length})
        </div>
        <ListBlock
          records={contacts}
          emptyText="No possible contact matches found."
          render={contact => (
            <MiniRow
              title={personName(contact)}
              subtitle={[contact.title, contact.email, contact.phone].filter(Boolean).join(' • ')}
              meta="Contact"
            />
          )}
        />
      </div>

      {/* Company Matches */}
      <div className="mb-3">
        <div className="mb-2 text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(107,126,255,0.7)' }}>
          Possible Company Matches ({hasCompany ? 1 : 0})
        </div>
        {hasCompany ? (
          <MiniRow
            title={val(company!.name, 'Possible company')}
            subtitle={[company!.website, company!.city, company!.state].filter(Boolean).join(' • ')}
            meta="Company"
          />
        ) : (
          <Empty text="No possible company matches found." />
        )}
      </div>

      {/* Property Matches */}
      <div className="mb-3">
        <div className="mb-2 text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(107,126,255,0.7)' }}>
          Possible Property Matches ({possibleProperties.length})
        </div>
        <ListBlock
          records={possibleProperties}
          emptyText="No possible property matches found."
          render={property => (
            <MiniRow
              title={val(property.name, 'Possible property')}
              subtitle={[property.address, property.city, property.state].filter(Boolean).join(', ')}
              meta={property.unit_count ? `${property.unit_count} units` : 'Property'}
            />
          )}
        />
      </div>

      {/* Site Matches */}
      <div className="mb-3">
        <div className="mb-2 text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(107,126,255,0.7)' }}>
          Possible Site Matches ({sites.length})
        </div>
        <ListBlock
          records={sites}
          emptyText="No possible site matches found."
          render={site => (
            <MiniRow
              title={val(site.name, 'Possible site')}
              subtitle={[site.address, site.city, site.state].filter(Boolean).join(', ')}
              meta={site.units ? `${site.units} units` : 'Site'}
            />
          )}
        />
      </div>

      {/* Opportunity Matches */}
      <div>
        <div className="mb-2 text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(107,126,255,0.7)' }}>
          Possible Opportunity Matches ({opportunities.length})
        </div>
        <ListBlock
          records={opportunities}
          emptyText="No possible opportunity matches found."
          render={opp => (
            <MiniRow
              title={val(opp.name, 'Possible opportunity')}
              subtitle={[opp.account_name, opp.next_step].filter(Boolean).join(' • ')}
              meta={val(opp.stage, 'Opportunity')}
            />
          )}
        />
      </div>
    </Section>
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
      {/* Header */}
      <div className="rounded-[2rem] p-5" style={{ background: 'linear-gradient(145deg, rgba(107,126,255,0.16), rgba(255,255,255,0.035))', border: '1px solid rgba(107,126,255,0.24)', boxShadow: '0 20px 70px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <button
              type="button"
              onClick={onBack}
              className="mb-4 rounded-full px-3 py-1.5 text-[11px] transition-opacity hover:opacity-80"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.58)' }}
            >
              ← Back to workbench
            </button>
            <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'rgba(165,180,255,0.85)' }}>Lead</div>
            <h3 className="mt-2 text-2xl font-semibold leading-tight" style={{ color: 'rgba(255,255,255,0.94)' }}>
              {val(lead.contact_name ?? lead.name, 'Unnamed lead')}
            </h3>
            <div className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {val(lead.company_name ?? company?.name, 'No company attached')}
            </div>
          </div>
          <div className="rounded-2xl px-4 py-3 text-right" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: 'rgba(255,255,255,0.38)' }}>Stage</div>
            <div className="mt-1 text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.88)' }}>{val(lead.stage, 'open')}</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Source" value={val(lead.source, 'Unknown')} />
          <MiniStat label="Units" value={val(lead.unit_count, 'Unknown')} />
          <MiniStat label="Property" value={val(lead.location, 'Not attached')} />
          <MiniStat label="Updated" value={val(lead.updated_at ?? lead.created_at, 'Unknown')} />
        </div>
      </div>

      {/* Body — 2-col on large */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-4 lg:col-span-2">
          <Section title="Overview">
            <div className="grid gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.62)' }}>
              <div>Need / Notes: {val(lead.notes, 'No notes yet')}</div>
              <div>Email: {val(lead.email)}</div>
              <div>Phone: {val(lead.phone)}</div>
            </div>
          </Section>

          {/* Duplicate Guard — 5 separate categories */}
          <DuplicateGuardSection data={data} />

          <Section title="People" count={contacts.length}>
            {primaryContact && (
              <MiniRow
                title={personName(primaryContact)}
                subtitle={[primaryContact.title, primaryContact.email, primaryContact.phone].filter(Boolean).join(' • ')}
                meta="Primary"
              />
            )}
            <div className={primaryContact ? 'mt-2' : ''}>
              <ListBlock
                records={contacts.filter(c => c.id !== primaryContact?.id)}
                emptyText="No additional contacts linked yet."
                render={contact => (
                  <MiniRow
                    title={personName(contact)}
                    subtitle={[contact.title, contact.email, contact.phone].filter(Boolean).join(' • ')}
                  />
                )}
              />
            </div>
          </Section>

          <Section title="Property / Site" count={linkedProperties.length + possibleProperties.length + sites.length}>
            <ListBlock
              records={[...linkedProperties.map((item: AnyRecord) => item.properties ?? item), ...possibleProperties, ...sites]}
              emptyText="No property or site linked yet."
              render={property => (
                <MiniRow
                  title={val(property.name, 'Unnamed property')}
                  subtitle={[property.address, property.city, property.state, property.zip].filter(Boolean).join(', ')}
                  meta={property.units || property.unit_count ? `${property.units ?? property.unit_count} units` : undefined}
                />
              )}
            />
          </Section>

          <Section title="Activity Timeline" count={activities.length}>
            <ListBlock
              records={activities}
              emptyText="No activity yet."
              render={activity => (
                <MiniRow
                  title={val(activity.subject, val(activity.type, 'Activity'))}
                  subtitle={val(activity.body ?? activity.outcome, '')}
                  meta={val(activity.created_at, '')}
                />
              )}
            />
          </Section>

          <Section title="Tasks" count={data.todos?.length ?? 0}>
            <ListBlock
              records={data.todos}
              emptyText="No tasks attached yet."
              render={todo => (
                <MiniRow
                  title={val(todo.title, 'Task')}
                  subtitle={val(todo.body, '')}
                  meta={val(todo.status ?? todo.due_date, '')}
                />
              )}
            />
          </Section>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <Section title="Next Best Actions" count={nextBestActions.length}>
            <div className="space-y-2">
              {nextBestActions.length === 0 ? (
                <Empty text="No suggested actions." />
              ) : (
                nextBestActions.map(action => (
                  <button
                    key={action.action}
                    type="button"
                    className="w-full rounded-2xl p-3 text-left transition-all hover:-translate-y-0.5"
                    style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.18)', color: 'rgba(255,255,255,0.86)' }}
                  >
                    <div className="text-xs font-semibold">{action.title}</div>
                    <div className="mt-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.42)' }}>{action.subtitle}</div>
                  </button>
                ))
              )}
            </div>
          </Section>

          <Section title="Files" count={data.attachments?.length ?? 0}>
            <ListBlock
              records={data.attachments}
              emptyText="No files attached yet."
              render={file => <MiniRow title={val(file.file_name, 'File')} subtitle={val(file.file_type ?? file.type, '')} />}
            />
          </Section>

          <Section title="Surveys" count={data.surveys?.length ?? 0}>
            <ListBlock
              records={data.surveys}
              emptyText="No surveys found yet."
              render={survey => (
                <MiniRow
                  title={val(survey.survey_number ?? survey.property_name, 'Survey')}
                  subtitle={val(survey.ai_summary, 'No summary yet')}
                  meta={val(survey.status, '')}
                />
              )}
            />
          </Section>

          <Section title="Related Opportunities" count={data.opportunities?.length ?? 0}>
            <ListBlock
              records={data.opportunities}
              emptyText="No related opportunities yet."
              render={opp => (
                <MiniRow
                  title={val(opp.name, 'Opportunity')}
                  subtitle={val(opp.next_step ?? opp.account_name, '')}
                  meta={val(opp.stage, '')}
                />
              )}
            />
          </Section>
        </div>
      </div>
    </div>
  )
}
