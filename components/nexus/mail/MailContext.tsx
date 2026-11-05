'use client'
import React, { useEffect, useState } from 'react'
import { X, Building2, Wrench, FileText, Search, Loader2, ExternalLink } from 'lucide-react'
import { M, RECORD_BADGE, api, initials, tintFor, type ThreadRow } from './mailShared'

type Ctx = {
  people: { name: string | null; address: string }[]
  domain: string | null
  linked: { type: string; id: string | null; label: string | null } | null
  opportunity: { id: string; name: string; stage: string | null; mrr: number | null; setup: number | null; close_date: string | null } | null
  customer: { id: string; name: string; status: string | null } | null
  sites: { id: string; name: string; place: string | null; status: string | null; units: number | null }[]
  jobs: { id: string; number: string | null; title: string; status: string; priority: string | null; date: string | null }[]
  invoices: { id: string; number: string | null; balance: number; due_date: string | null; status: string }[]
  open_balance: number
  other_threads: number
}
const money = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export default function MailContext({ row, onLinked, onClose }: { row: ThreadRow; onLinked: (patch: Partial<ThreadRow>) => void; onClose?: () => void }) {
  const [ctx, setCtx] = useState<Ctx | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkQ, setLinkQ] = useState('')
  const [results, setResults] = useState<{ id: string; label: string; sublabel?: string; type: string }[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [oppForm, setOppForm] = useState<null | { name: string; site_name: string; units: string; address: string; systems: string; contact_name: string; contact_email: string }>(null)

  useEffect(() => {
    let live = true
    setCtx(null)
    void api<Ctx>(`/api/nexus/messages/context?thread=${row.id}`).then((r) => { if (live && r.ok) setCtx(r.data) })
    return () => { live = false }
  }, [row.id, row.linked_id])

  useEffect(() => {
    if (!linkOpen) return
    let live = true
    const t = setTimeout(async () => {
      const r = await api<{ results?: { id: string; label: string; sublabel?: string; type: string }[] }>(`/api/todos/search-records?type=all&q=${encodeURIComponent(linkQ)}`)
      if (live) setResults(Array.isArray(r.data.results) ? r.data.results : [])
    }, 200)
    return () => { live = false; clearTimeout(t) }
  }, [linkQ, linkOpen])

  const link = async (type: string | null, id?: string | null, label?: string | null) => {
    const prev = { linked_type: row.linked_type, linked_id: row.linked_id, linked_label: row.linked_label }
    onLinked({ linked_type: type, linked_id: id ?? null, linked_label: label ?? null })
    const r = await api(`/api/nexus/messages/threads/${row.id}`, { method: 'PATCH', json: { linked_type: type, linked_id: id ?? null, linked_label: label ?? null } })
    if (!r.ok) onLinked(prev)
  }

  const who = row.contact_name || row.contact_address || 'New record'
  const email = row.contact_address || ''
  const create = async (type: 'contact' | 'lead' | 'customer') => {
    setBusy(type)
    let id: string | null = null
    if (type === 'contact') { const r = await api<{ id?: string; contact?: { id: string } }>('/api/crm/contacts', { method: 'POST', json: { name: who, email } }); id = r.data.id ?? r.data.contact?.id ?? null }
    if (type === 'lead') { const r = await api<{ id?: string; record?: { id: string } }>('/api/crm/leads', { method: 'POST', json: { name: who, email, source: 'email' } }); id = r.data.id ?? r.data.record?.id ?? null }
    if (type === 'customer') { const r = await api<{ id?: string; record?: { id: string }; data?: { id: string } }>('/api/customers', { method: 'POST', json: { name: who, org_tier: 'client', primary_contact_name: row.contact_name || null, primary_contact_email: email } }); id = r.data.id ?? r.data.record?.id ?? r.data.data?.id ?? null }
    if (id) await link(type, String(id), who)
    setBusy(null)
  }
  const createDeal = async () => {
    if (!oppForm) return
    setBusy('opportunity')
    const name = oppForm.name.trim() || (oppForm.site_name.trim() ? `${oppForm.site_name.trim()} — Opportunity` : `${oppForm.contact_name || 'New'} — Opportunity`)
    const r = await api<{ id?: string; name?: string; data?: { id: string } }>('/api/crm/opportunities', { method: 'POST', json: {
      name, account_name: oppForm.site_name.trim() || oppForm.contact_name.trim() || name,
      property_name: oppForm.site_name.trim() || null, property_address: oppForm.address.trim() || null,
      units: oppForm.units ? Number(oppForm.units) || null : null,
      contact_name: oppForm.contact_name.trim() || null, contact_email: oppForm.contact_email.trim() || null,
      notes: oppForm.systems.trim() ? `Systems interested in: ${oppForm.systems.trim()}` : null,
    } })
    const id = r.data.id ?? r.data.data?.id ?? null
    if (id) await link('opportunity', String(id), r.data.name ?? name)
    setBusy(null); setOppForm(null)
  }

  const badge = row.linked_type ? RECORD_BADGE[row.linked_type] : null
  const recordHref = (type: string | null, id: string | null) => !id ? null
    : type === 'opportunity' ? `/crm/opportunities/${id}` : type === 'lead' ? `/crm/leads/${id}` : type === 'job' ? `/maintenance/${id}` : null

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#FBFBFD', borderLeft: `1px solid ${M.line}`, fontFamily: M.font }}>
      <div style={{ padding: '18px 18px 14px', borderBottom: `1px solid ${M.line}`, position: 'relative' }}>
        {onClose && <button type="button" aria-label="Hide details" onClick={onClose} style={{ position: 'absolute', top: 10, right: 10, width: 26, height: 26, border: 0, background: 'none', color: M.ink3, cursor: 'pointer', borderRadius: 6 }}><X size={14} /></button>}
        <span aria-hidden style={{ width: 44, height: 44, borderRadius: 44, background: `${tintFor(who)}1A`, color: tintFor(who), display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 600 }}>{initials(who)}</span>
        <div style={{ fontSize: 15, fontWeight: 600, color: M.ink, marginTop: 8 }}>{who}</div>
        {email && <a href={`mailto:${email}`} style={{ fontSize: 12.5, color: M.ink3, textDecoration: 'none', wordBreak: 'break-all' }}>{email}</a>}
        {ctx && ctx.people.length > 1 && <div style={{ fontSize: 12, color: M.ink3, marginTop: 6 }}>+ {ctx.people.length - 1} more on this email</div>}
        {ctx && ctx.other_threads > 0 && <div style={{ fontSize: 12, color: M.ink3, marginTop: 4 }}>{ctx.other_threads} other conversation{ctx.other_threads === 1 ? '' : 's'} with them</div>}
      </div>

      <Section title="Linked to">
        {row.linked_label ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, background: '#fff', border: `1px solid ${M.line}` }}>
            {badge && <span style={{ fontSize: 11, fontWeight: 600, color: badge.color }}>{badge.label}</span>}
            {recordHref(row.linked_type, row.linked_id)
              ? <a href={recordHref(row.linked_type, row.linked_id)!} style={{ fontSize: 13, fontWeight: 500, color: M.ink, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}>{row.linked_label}</a>
              : <span style={{ fontSize: 13, fontWeight: 500, color: M.ink, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.linked_label}</span>}
            <button type="button" onClick={() => void link(null)} style={{ fontSize: 12, color: M.red, background: 'none', border: 0, cursor: 'pointer' }}>Unlink</button>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <button type="button" onClick={() => setLinkOpen((o) => !o)} style={{ width: '100%', textAlign: 'left', fontSize: 13, color: M.ink3, padding: '8px 10px', borderRadius: 9, background: '#fff', border: `1px dashed ${M.lineStrong}`, cursor: 'pointer' }}>
              Link to a deal, customer, lead or job…
            </button>
            {linkOpen && (
              <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 4, zIndex: 20, background: '#fff', border: `1px solid ${M.line}`, borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.14)', padding: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderBottom: `1px solid ${M.line}` }}>
                  <Search size={13} style={{ color: M.ink3 }} />
                  <input autoFocus value={linkQ} onChange={(e) => setLinkQ(e.target.value)} placeholder="Search records" style={{ flex: 1, border: 0, outline: 'none', fontSize: 13, padding: '5px 0', background: 'transparent' }} />
                </div>
                <div style={{ maxHeight: 220, overflowY: 'auto', paddingTop: 4 }}>
                  {results.map((r) => (
                    <button key={`${r.type}-${r.id}`} type="button" onClick={() => { void link(r.type, r.id, r.label); setLinkOpen(false); setLinkQ('') }} style={{ display: 'block', width: '100%', textAlign: 'left', border: 0, background: 'none', borderRadius: 6, padding: '6px 8px', cursor: 'pointer' }}>
                      <div style={{ fontSize: 13, color: M.ink }}>{r.label}</div>
                      <div style={{ fontSize: 11.5, color: M.ink3 }}>{RECORD_BADGE[r.type]?.label ?? r.type}{r.sublabel ? ` · ${r.sublabel}` : ''}</div>
                    </button>
                  ))}
                  {results.length === 0 && <div style={{ fontSize: 12, color: M.ink3, padding: '6px 8px' }}>{linkQ ? 'No matches.' : 'Type to search.'}</div>}
                </div>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
              {([['contact', 'New contact'], ['lead', 'New lead'], ['opportunity', 'New deal'], ['customer', 'New customer']] as const).map(([type, label]) => (
                <button key={type} type="button" disabled={busy !== null}
                  onClick={() => type === 'opportunity' ? setOppForm({ name: '', site_name: '', units: '', address: '', systems: '', contact_name: who, contact_email: email }) : void create(type)}
                  style={{ fontSize: 12.5, color: M.ink, background: '#fff', border: `1px solid ${M.line}`, borderRadius: 8, padding: '7px 8px', cursor: 'pointer', opacity: busy && busy !== type ? 0.5 : 1 }}>
                  {busy === type ? 'Creating…' : `+ ${label}`}
                </button>
              ))}
            </div>
          </div>
        )}
      </Section>

      {!ctx ? <div style={{ padding: 18, color: M.ink3 }}><Loader2 size={15} className="animate-spin" /></div> : <>
        {ctx.opportunity && (
          <Section title="Deal">
            <a href={`/crm/opportunities/${ctx.opportunity.id}`} style={cardLink}>
              <div style={{ fontSize: 13, fontWeight: 600, color: M.ink }}>{ctx.opportunity.name}</div>
              <div style={{ fontSize: 12, color: M.ink3, marginTop: 2 }}>{[ctx.opportunity.stage, ctx.opportunity.mrr ? `${money(ctx.opportunity.mrr)}/mo` : null, ctx.opportunity.setup ? `${money(ctx.opportunity.setup)} setup` : null].filter(Boolean).join(' · ')}</div>
            </a>
          </Section>
        )}
        {(ctx.customer || ctx.sites.length > 0) && (
          <Section title={ctx.customer ? ctx.customer.name : 'Properties'}>
            {ctx.sites.map((s) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                <Building2 size={14} style={{ color: M.ink3, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: M.ink }}>{s.name}</div>
                  <div style={{ fontSize: 11.5, color: M.ink3 }}>{[s.place, s.units ? `${s.units} units` : null, s.status && s.status !== 'active' ? s.status : null].filter(Boolean).join(' · ')}</div>
                </div>
              </div>
            ))}
          </Section>
        )}
        {ctx.jobs.length > 0 && (
          <Section title={`Open jobs · ${ctx.jobs.length}`}>
            {ctx.jobs.map((j) => (
              <a key={j.id} href={`/maintenance/${j.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', textDecoration: 'none' }}>
                <Wrench size={14} style={{ color: M.ink3, flexShrink: 0 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, color: M.ink, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{j.title}</div>
                  <div style={{ fontSize: 11.5, color: M.ink3 }}>{[j.number, j.status, j.date].filter(Boolean).join(' · ')}</div>
                </div>
                <ExternalLink size={12} style={{ color: M.ink4 }} />
              </a>
            ))}
          </Section>
        )}
        {ctx.invoices.length > 0 && (
          <Section title={`Owes ${money(ctx.open_balance)}`}>
            {ctx.invoices.map((i) => (
              <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                <FileText size={14} style={{ color: M.ink3, flexShrink: 0 }} />
                <div style={{ flex: 1, fontSize: 13, color: M.ink }}>Invoice {i.number ?? ''}</div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: i.due_date && i.due_date < new Date().toISOString().slice(0, 10) ? M.red : M.ink }}>{money(i.balance)}</div>
                  {i.due_date && <div style={{ fontSize: 11, color: M.ink3 }}>due {i.due_date}</div>}
                </div>
              </div>
            ))}
          </Section>
        )}
        {!ctx.opportunity && !ctx.customer && ctx.sites.length === 0 && (
          <div style={{ padding: '14px 18px', fontSize: 12.5, color: M.ink3, lineHeight: 1.5 }}>Nothing in Nexus matches {email || 'this sender'} yet. Link or create a record above and the next emails from them land here automatically.</div>
        )}
      </>}

      {oppForm && (
        <div onClick={() => busy === null && setOppForm(null)} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="New deal" style={{ width: 'min(440px,100%)', background: '#fff', borderRadius: 14, boxShadow: '0 24px 64px rgba(0,0,0,0.22)', padding: 18, fontFamily: M.font }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: M.ink }}>New deal from this email</div>
              <button type="button" aria-label="Close" onClick={() => setOppForm(null)} style={{ border: 0, background: 'none', cursor: 'pointer', color: M.ink3 }}><X size={16} /></button>
            </div>
            {([['site_name', 'Property name'], ['address', 'Address'], ['units', 'Units'], ['systems', 'Systems they want'], ['contact_name', 'Contact name'], ['contact_email', 'Contact email'], ['name', 'Deal name (optional)']] as const).map(([k, label]) => (
              <label key={k} style={{ display: 'block', marginBottom: 9 }}>
                <span style={{ display: 'block', fontSize: 12, color: M.ink3, marginBottom: 3 }}>{label}</span>
                <input value={oppForm[k]} onChange={(e) => setOppForm({ ...oppForm, [k]: k === 'units' ? e.target.value.replace(/[^0-9]/g, '') : e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', fontSize: 13.5, padding: '8px 10px', borderRadius: 8, border: `1px solid ${M.lineStrong}`, outline: 'none', fontFamily: M.font }} />
              </label>
            ))}
            <button type="button" onClick={() => void createDeal()} disabled={busy !== null} style={{ width: '100%', marginTop: 4, fontSize: 14, fontWeight: 600, color: '#fff', background: M.blue, border: 0, borderRadius: 10, padding: 11, cursor: 'pointer' }}>
              {busy === 'opportunity' ? 'Creating…' : 'Create deal & link this email'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '14px 18px', borderBottom: `1px solid ${M.line}` }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: M.ink3, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</div>
      {children}
    </div>
  )
}
const cardLink: React.CSSProperties = { display: 'block', padding: '9px 10px', borderRadius: 9, background: '#fff', border: `1px solid ${M.line}`, textDecoration: 'none' }
