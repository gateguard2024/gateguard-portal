'use client'

/**
 * Sales · deal fields — the editable CRM sections shared by the deal panel (board) and the
 * full deal page: Money, Deal, Qualification, Contacts, Property (+ Fill from ARIA), Scope.
 * Fields save on blur / change through the caller's save().
 */
import { useEffect, useState, type ReactNode } from 'react'
import { DEAL_TYPES, FORECAST, INTERESTS, SOURCES, initials, money, type Deal } from './salesShared'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>
export type FieldsData = { deal: Row; card: Deal; contacts: Row[]; reps: { id: string; name: string }[]; can: { edit: boolean; reassign: boolean; money: boolean } }
export type SectionKey = 'money' | 'deal' | 'qual' | 'people' | 'property' | 'scope'

export type FieldKind = 'text' | 'number' | 'money' | 'date' | 'textarea' | { options: { value: string; label: string }[] }

export function Field({ label, k, kind = 'text', value, onSave, disabled, suffix }: {
  label: string; k: string; kind?: FieldKind; value: unknown; onSave: (k: string, v: unknown) => Promise<boolean>; disabled?: boolean; suffix?: string
}) {
  const initial = value === null || value === undefined ? '' : String(value)
  const [v, setV] = useState(initial)
  const [state, setState] = useState<'idle' | 'saving' | 'err'>('idle')
  useEffect(() => { setV(initial) }, [initial])
  const commit = async (next = v) => {
    if (next === initial) return
    setState('saving')
    const out = kind === 'number' || kind === 'money' ? (next.trim() === '' ? null : Number(next.replace(/[$,\s]/g, ''))) : next.trim() === '' ? null : next
    const ok = await onSave(k, out)
    setState(ok ? 'idle' : 'err')
    if (!ok) setV(initial)
  }
  const id = `dp-${k}`
  let input: ReactNode
  if (typeof kind === 'object') {
    input = <select id={id} className="sb-in" value={v} disabled={disabled} onChange={e => { setV(e.target.value); void commit(e.target.value) }}>
      <option value="">—</option>{kind.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  } else if (kind === 'textarea') {
    input = <textarea id={id} className="sb-in" rows={3} value={v} disabled={disabled} onChange={e => setV(e.target.value)} onBlur={() => void commit()} />
  } else {
    input = <input id={id} className="sb-in" type={kind === 'date' ? 'date' : 'text'} inputMode={kind === 'number' || kind === 'money' ? 'decimal' : undefined}
      value={v} disabled={disabled} onChange={e => { setV(e.target.value); if (kind === 'date') void commit(e.target.value) }}
      onBlur={() => { if (kind !== 'date') void commit() }} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      placeholder={kind === 'money' ? '$0' : undefined} />
  }
  return (
    <label className={`dp-f${kind === 'textarea' ? ' wide' : ''}`} htmlFor={id}>
      <span>{label}{state === 'saving' && <i> · saving</i>}{state === 'err' && <i className="r"> · not saved</i>}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{input}{suffix && <em>{suffix}</em>}</span>
    </label>
  )
}

export function Chips({ label, values, options, onSave, freeText }: { label: string; values: string[]; options?: string[]; onSave: (v: string[]) => Promise<boolean>; freeText?: boolean }) {
  const [draft, setDraft] = useState('')
  const toggle = (x: string) => void onSave(values.includes(x) ? values.filter(y => y !== x) : [...values, x])
  return (
    <div className="dp-f wide">
      <span>{label}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {(options ?? values).map(x => (
          <button key={x} type="button" className="sb-chip" aria-pressed={values.includes(x)} onClick={() => toggle(x)}>{x}{!options && ' ×'}</button>
        ))}
        {freeText && (
          <input className="sb-in" style={{ width: 150 }} placeholder="+ Add tag" value={draft} onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && draft.trim()) { e.preventDefault(); void onSave([...values, draft.trim()]); setDraft('') } }} />
        )}
      </div>
    </div>
  )
}


export function DealFields({ dealId, d, save, contactCall, onChanged, reload, setErr, only }: {
  dealId: string
  d: FieldsData
  save: (k: string, v: unknown) => Promise<boolean>
  contactCall: (method: 'POST' | 'PATCH' | 'DELETE', body?: Row, contactId?: string) => Promise<boolean>
  onChanged?: (card: Deal) => void
  reload: () => Promise<unknown>
  setErr: (m: string | null) => void
  only?: SectionKey[]
}) {
  const [contact, setContact] = useState<Row | null>(null)
  const [aria, setAria] = useState<{ state: 'idle' | 'looking' | 'done'; matches: Row[]; msg?: string }>({ state: 'idle', matches: [] })
  const { deal, card, can } = d
  const opts = (xs: string[]) => ({ options: xs.map(x => ({ value: x, label: x })) })
  const typeOptions = deal.opp_type && !DEAL_TYPES.includes(deal.opp_type) ? [deal.opp_type, ...DEAL_TYPES] : DEAL_TYPES
  const sourceOptions = deal.source && !SOURCES.includes(deal.source) ? [deal.source, ...SOURCES] : SOURCES
  const load = reload
  void setErr

  const money_ = can.money && (
    <section className="dp-sec"><h4>Money</h4><div className="dp-grid">
      <Field label="Monthly (MRR)" k="est_mrr" kind="money" value={deal.est_mrr ?? deal.monthly_total} onSave={save} />
      <Field label="Install fee" k="install_fee" kind="money" value={deal.install_fee ?? deal.est_setup} onSave={save} />
      <Field label="Term" k="contract_term" kind="number" value={deal.contract_term} onSave={save} suffix="months" />
      <Field label="Deposit" k="est_deposit" kind="money" value={deal.est_deposit} onSave={save} />
      <div className="dp-f"><span>Total contract (TCV)</span><b style={{ fontSize: 15 }}>{money(card.tcv, false)}</b>{card.term_assumed && <em className="sb-sub">assumes 36 months</em>}</div>
      <div className="dp-f"><span>Weighted</span><b style={{ fontSize: 15 }}>{money(card.weighted, false)}</b><em className="sb-sub">{card.probability}% win chance</em></div>
      <Field label="Forecast" k="forecast_cat" kind={{ options: FORECAST.map(f => ({ value: f.key, label: f.label })) }} value={deal.forecast_cat} onSave={save} />
      <Field label="Quote link" k="quote_url" value={deal.quote_url} onSave={save} />
      <Field label="Quote total" k="quote_total" kind="money" value={deal.quote_total} onSave={save} />
    </div></section>
  )

  const deal_ = (
    <section className="dp-sec"><h4>Deal</h4><div className="dp-grid">
      <Field label="Expected close" k="close_date" kind="date" value={deal.close_date} onSave={save} />
      {can.reassign
        ? <Field label="Owner" k="rep_id" kind={{ options: d.reps.map(r => ({ value: r.id, label: r.name })) }} value={deal.rep_id} onSave={save} />
        : <div className="dp-f"><span>Owner</span><span><span className="sb-av">{initials(card.owner_name)}</span> {card.owner_name ?? '—'}</span></div>}
      <Field label="Type" k="opp_type" kind={opts(typeOptions)} value={deal.opp_type} onSave={save} />
      <Field label="Source" k="source" kind={opts(sourceOptions)} value={deal.source} onSave={save} />
      <Field label="Managing admin" k="manager_name" value={deal.manager_name} onSave={save} />
      <div className="dp-f"><span>Days in stage</span><span className={card.stalled ? 'sb-days r' : ''}>{card.days_in_stage} days{card.stalled ? ' (stalled)' : ''}</span></div>
      <Chips label="Tags" values={deal.tags ?? []} onSave={v => save('tags', v)} freeText />
      <Field label="Description" k="description" kind="textarea" value={deal.description} onSave={save} />
    </div></section>
  )

  const qual_ = (
    <section className="dp-sec"><h4>Qualification</h4><div className="dp-grid">
      <Field label="Decision date" k="decision_date" kind="date" value={deal.decision_date} onSave={save} />
      <Field label="Budget" k="budget_status" kind={{ options: [{ value: 'confirmed', label: 'Confirmed' }, { value: 'not_confirmed', label: 'Not confirmed' }, { value: 'unknown', label: 'Unknown' }] }} value={deal.budget_status} onSave={save} />
      <Field label="Target install date" k="target_install_date" kind="date" value={deal.target_install_date} onSave={save} />
      <div className="dp-f"><span>Decision maker</span><span>{d.contacts.find(c => c.role === 'Decision maker')?.contact_name ?? <em className="sb-sub">Add a contact with the Decision maker role</em>}</span></div>
      <Chips label="Competing bids" values={deal.competing_vendors ?? []} onSave={v => save('competing_vendors', v)} freeText />
      <Field label="Pain / why they're looking" k="pain_points" kind="textarea" value={deal.pain_points} onSave={save} />
    </div></section>
  )

  const ariaFind = async () => {
    setAria({ state: 'looking', matches: [] })
    try {
      const res = await fetch(`/api/sales/deals/${dealId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'aria_lookup' }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'ARIA search failed.')
      setAria({ state: 'done', matches: data.matches ?? [], msg: (data.matches ?? []).length ? undefined : 'No researched property matches this deal yet. Run it through ARIA first.' })
    } catch (e) { setAria({ state: 'done', matches: [], msg: e instanceof Error ? e.message : 'ARIA search failed.' }) }
  }
  const ariaApply = async (id: string) => {
    const res = await fetch(`/api/sales/deals/${dealId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'aria_apply', aria_property_id: id }) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setAria(a => ({ ...a, msg: data?.error ?? 'Could not fill from ARIA.' })); return }
    if (data.card) onChanged?.(data.card as Deal)
    setAria({ state: 'idle', matches: [], msg: (data.filled ?? []).length ? `Filled ${data.filled.length} empty field${data.filled.length === 1 ? '' : 's'} from ARIA.` : 'Linked to ARIA — nothing was empty to fill.' })
    await load()
  }

  const property_ = (
    <section className="dp-sec">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <h4 style={{ margin: 0, flex: 1 }}>Property{deal.aria_property_id && <span className="sb-pill mid" style={{ marginLeft: 8 }}>Linked to ARIA</span>}</h4>
        <button type="button" className="sb-btn sm" onClick={() => void ariaFind()} disabled={aria.state === 'looking'}>{aria.state === 'looking' ? 'Searching…' : 'Fill from ARIA'}</button>
      </div>
      {aria.msg && <div className="sb-sub" style={{ marginBottom: 8 }}>{aria.msg}</div>}
      {aria.matches.map(m => (
        <div key={m.id} className="dp-row">
          <span style={{ flex: 1, minWidth: 0 }}><b style={{ fontWeight: 600 }}>{m.property_name}</b><span className="sb-sub" style={{ display: 'block' }}>{[m.address, m.units ? `${m.units} units` : null, m.year_built ? `built ${m.year_built}` : null].filter(Boolean).join(' · ')}</span></span>
          <button type="button" className="sb-btn pri sm" onClick={() => void ariaApply(m.id)}>Use this</button>
        </div>
      ))}
      <div className="dp-grid">
      <Field label="Account" k="account_name" value={deal.account_name} onSave={save} />
      <Field label="Management company" k="management_co" value={deal.management_co} onSave={save} />
      <Field label="Owner entity" k="owner_entity" value={deal.owner_entity} onSave={save} />
      <Field label="Property type" k="property_type" value={deal.property_type} onSave={save} />
      <Field label="Address" k="property_address" value={deal.property_address} onSave={save} />
      <Field label="City" k="property_city" value={deal.property_city} onSave={save} />
      <Field label="State" k="property_state" value={deal.property_state} onSave={save} />
      <Field label="ZIP" k="property_zip" value={deal.property_zip} onSave={save} />
      <Field label="Units" k="units" kind="number" value={deal.units} onSave={save} />
      <Field label="Buildings" k="buildings" kind="number" value={deal.buildings} onSave={save} />
      <Field label="Year built" k="year_built" kind="number" value={deal.year_built} onSave={save} />
      <Field label="Occupancy" k="occupancy_pct" kind="number" value={deal.occupancy_pct} onSave={save} suffix="%" />
    </div></section>
  )

  const scope_ = (
    <section className="dp-sec"><h4>Scope</h4><div className="dp-grid">
      <Field label="Vehicle gates" k="vehicle_gates" kind="number" value={deal.vehicle_gates} onSave={save} />
      <Field label="Pedestrian gates" k="pedestrian_gates" kind="number" value={deal.pedestrian_gates} onSave={save} />
      <Field label="Amenity doors" k="amenity_doors" kind="number" value={deal.amenity_doors} onSave={save} />
      <Field label="Existing cameras" k="existing_cameras" kind="number" value={deal.existing_cameras} onSave={save} />
      <Field label="New cameras" k="new_cameras" kind="number" value={deal.new_cameras} onSave={save} />
      <Field label="Current vendor" k="incumbent_vendor" value={deal.incumbent_vendor} onSave={save} />
      <Field label="Their contract ends" k="incumbent_contract_end" kind="date" value={deal.incumbent_contract_end} onSave={save} />
      <Field label="ISP / internet" k="isp_service" value={deal.isp_service} onSave={save} />
      <Field label="DirecTV package" k="dtv_package" value={deal.dtv_package} onSave={save} />
      <Field label="Bulk / MDU contract ends" k="mdu_contract_expiry" kind="date" value={deal.mdu_contract_expiry} onSave={save} />
      <Chips label="Interested in" values={deal.interests ?? []} options={[...new Set([...INTERESTS, ...(deal.interests ?? [])])]} onSave={v => save('interests', v)} />
    </div></section>
  )

  const people_ = (
    <section className="dp-sec"><h4>Contacts</h4>
      {d.contacts.length === 0 && !contact && <div className="sb-sub" style={{ marginBottom: 6 }}>No contacts yet.</div>}
      {d.contacts.map(c => (
        <div key={c.id} className="dp-row">
          <span className="sb-av" style={{ width: 28, height: 28 }}>{initials(c.contact_name)}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <b style={{ fontWeight: 600 }}>{c.contact_name}</b>{c.is_primary && <span className="sb-pill mid" style={{ marginLeft: 6 }}>Primary</span>}
            <span className="sb-sub" style={{ display: 'block' }}>{[c.role, c.contact_title].filter(Boolean).join(' · ')}</span>
            <span className="sb-sub" style={{ display: 'block' }}>
              {c.contact_phone && <a href={`tel:${c.contact_phone}`}>{c.contact_phone}</a>}{c.contact_phone && c.contact_email && ' · '}
              {c.contact_email && <a href={`mailto:${c.contact_email}`}>{c.contact_email}</a>}
            </span>
          </span>
          {!c.is_primary && <button type="button" className="sb-link sm" onClick={() => void contactCall('PATCH', { contactId: c.id, is_primary: true })}>Make primary</button>}
          <button type="button" className="sb-link sm" onClick={() => setContact({ id: c.id, name: c.contact_name, title: c.contact_title, email: c.contact_email, phone: c.contact_phone, role: c.role })}>Edit</button>
          <button type="button" className="sb-link sm r" onClick={() => { if (confirm(`Remove ${c.contact_name} from this deal?`)) void contactCall('DELETE', undefined, c.id) }}>Remove</button>
        </div>
      ))}
      {contact ? (
        <form className="dp-grid" style={{ marginTop: 8 }} onSubmit={async e => {
          e.preventDefault()
          if (!String(contact.name ?? '').trim()) return
          const ok = contact.id
            ? await contactCall('PATCH', { contactId: contact.id, name: contact.name, title: contact.title, email: contact.email, phone: contact.phone, role: contact.role })
            : await contactCall('POST', { name: contact.name, title: contact.title, email: contact.email, phone: contact.phone, role: contact.role, is_primary: d.contacts.length === 0 })
          if (ok) setContact(null)
        }}>
          {(['name', 'title', 'phone', 'email'] as const).map(f => (
            <label key={f} className="dp-f"><span>{f[0].toUpperCase() + f.slice(1)}{f === 'name' ? ' *' : ''}</span>
              <input className="sb-in" value={contact[f] ?? ''} onChange={e => setContact({ ...contact, [f]: e.target.value })} autoFocus={f === 'name'} /></label>
          ))}
          <label className="dp-f"><span>Role</span>
            <select className="sb-in" value={contact.role ?? ''} onChange={e => setContact({ ...contact, role: e.target.value })}>
              <option value="">—</option>{['Decision maker', 'Champion', 'Influencer', 'Billing', 'Site contact', 'Property manager'].map(r => <option key={r}>{r}</option>)}
            </select></label>
          <div className="dp-f" style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <button type="submit" className="sb-btn pri sm">{contact.id ? 'Save' : 'Add contact'}</button>
            <button type="button" className="sb-btn sm" onClick={() => setContact(null)}>Cancel</button>
          </div>
        </form>
      ) : <button type="button" className="sb-link" onClick={() => setContact({ name: '', role: d.contacts.length ? '' : 'Decision maker' })}>+ Add contact</button>}
    </section>
  )


  const all: Record<SectionKey, ReactNode> = { money: money_, deal: deal_, qual: qual_, people: people_, property: property_, scope: scope_ }
  return <>{(only ?? (['money', 'deal', 'qual', 'people', 'property', 'scope'] as SectionKey[])).map(k => <div key={k} id={`dp-sec-${k}`}>{all[k]}</div>)}</>
}
