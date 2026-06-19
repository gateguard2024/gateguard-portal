'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type AnyRecord = Record<string, any>

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
}

function val(v: unknown, fallback = 'Not added yet') {
  if (v === null || v === undefined || v === '') return fallback
  return String(v)
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

function ListBlock({ records, emptyText, render }: { records?: AnyRecord[]; emptyText: string; render: (r: AnyRecord) => React.ReactNode }) {
  if (!records || records.length === 0) return <Empty text={emptyText} />
  return <div className="space-y-2">{records.slice(0, 6).map((r, i) => <div key={r.id ?? i}>{render(r)}</div>)}</div>
}

function MiniStat({ label, value: v }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl p-3" style={{ background: 'rgba(0,0,0,0.16)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.34)' }}>{label}</div>
      <div className="mt-1 truncate text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.82)' }}>{v}</div>
    </div>
  )
}

// Format currency amounts
function formatMoney(v: unknown): string {
  const n = Number(v)
  if (!v || isNaN(n)) return 'Not set'
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n}`
}

export function OpportunityGlassWindow({
  data,
  onBack,
}: {
  data: OpportunityGlassData
  onBack: () => void
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

  async function handleAction(action: string) {
    const oppId = opp.id as string | undefined
    if (!oppId) return
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
        const r = await fetch('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: `${opp.name || opp.account_name || 'New deal'} — Install`, job_type: 'new_install', opportunity_id: oppId, site_id: opp.site_id ?? null, opportunity_name: opp.name ?? null }) })
        const j = await r.json().catch(() => ({}))
        setMsg(r.ok ? { ok: true, text: 'Install job created ✓ — find it under Jobs.' } : { ok: false, text: j.error || 'Could not create job.' })
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
    : '#a5b4ff'

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="rounded-[2rem] p-5" style={{ background: 'linear-gradient(145deg, rgba(251,191,36,0.12), rgba(255,255,255,0.035))', border: '1px solid rgba(251,191,36,0.2)', boxShadow: '0 20px 70px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
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
            <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'rgba(251,191,36,0.8)' }}>Opportunity</div>
            <h3 className="mt-2 text-2xl font-semibold leading-tight" style={{ color: 'rgba(255,255,255,0.94)' }}>
              {val(opp.name, 'Untitled Opportunity')}
            </h3>
            <div className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {val(opp.account_name ?? company?.name, 'No account attached')}
            </div>
          </div>
          <div className="rounded-2xl px-4 py-3 text-right" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: 'rgba(255,255,255,0.38)' }}>Stage</div>
            <div className="mt-1 text-sm font-semibold" style={{ color: stageColor }}>{val(opp.stage, 'inquiry')}</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Monthly $"   value={opp.est_mrr ? formatMoney(opp.est_mrr) : 'Not set'} />
          <MiniStat label="Amount"      value={opp.amount  ? formatMoney(opp.amount)  : 'Not set'} />
          <MiniStat label="Close Date"  value={val(opp.close_date, 'Not set')} />
          <MiniStat label="Updated"     value={val(opp.updated_at ?? opp.created_at, 'Unknown')} />
        </div>
      </div>

      {/* ── Body ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left col */}
        <div className="space-y-4 lg:col-span-2">

          <Section title="Overview">
            <div className="grid gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.62)' }}>
              <div>Next Step: {val(opp.next_step, 'Not set')}</div>
              <div>Notes: {val(opp.notes ?? opp.description, 'No notes yet')}</div>
              <div>Source: {val(opp.source, 'Unknown')}</div>
              <div>Probability: {opp.probability != null ? `${opp.probability}%` : 'Not set'}</div>
              <div>Forecast: {val(opp.forecast_cat, 'Not set')}</div>
            </div>
          </Section>

          <Section title="People">
            {contact ? (
              <MiniRow
                title={[contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Contact'}
                subtitle={[contact.title, contact.email, contact.phone].filter(Boolean).join(' • ')}
                meta="Contact"
              />
            ) : opp.site_contact_name ? (
              <MiniRow
                title={val(opp.site_contact_name)}
                subtitle={[opp.site_contact_title, opp.site_contact_phone, opp.site_contact_email].filter(Boolean).join(' • ')}
                meta="Site Contact"
              />
            ) : (
              <Empty text="No contact linked yet." />
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
          </Section>

          <Section title="Property">
            {(opp.property_address || property) ? (
              <MiniRow
                title={val(property?.name ?? opp.property_address, 'Property')}
                subtitle={[
                  opp.property_address,
                  opp.property_city,
                  opp.property_state,
                  opp.property_zip,
                ].filter(Boolean).join(', ')}
                meta={opp.units ? `${opp.units} units` : property?.unit_count ? `${property.unit_count} units` : undefined}
              />
            ) : (
              <Empty text="No property linked yet." />
            )}
          </Section>

          <Section title="Activity Timeline" count={activities.length}>
            <ListBlock
              records={activities}
              emptyText="No activity yet."
              render={a => (
                <MiniRow
                  title={val(a.subject, val(a.type, 'Activity'))}
                  subtitle={val(a.body ?? a.outcome, '')}
                  meta={val(a.created_at, '')}
                />
              )}
            />
          </Section>

          <Section title="Tasks" count={todos.length}>
            <ListBlock
              records={todos}
              emptyText="No tasks attached yet."
              render={t => (
                <MiniRow
                  title={val(t.title, 'Task')}
                  subtitle={val(t.body, '')}
                  meta={val(t.status ?? t.due_date, '')}
                />
              )}
            />
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
                    onClick={() => handleAction(action.action)}
                    disabled={busy !== null}
                    className="w-full rounded-2xl p-3 text-left transition-all hover:-translate-y-0.5 disabled:opacity-50"
                    style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.16)', color: 'rgba(255,255,255,0.86)' }}
                  >
                    <div className="text-xs font-semibold">{busy === action.action ? 'Working…' : action.title}</div>
                    <div className="mt-0.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.42)' }}>{action.subtitle}</div>
                  </button>
                ))
              )}
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
            <ListBlock
              records={attachments}
              emptyText="No files attached yet."
              render={f => <MiniRow title={val(f.file_name, 'File')} subtitle={val(f.file_type ?? f.type, '')} />}
            />
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
  )
}
