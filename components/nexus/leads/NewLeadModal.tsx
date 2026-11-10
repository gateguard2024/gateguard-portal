'use client'

/**
 * NewLeadModal — light "Add a lead" sheet for Nexus Leads.
 * Checks for duplicates as you type (so the same property isn't worked twice),
 * shows est. MRR from the sizing, and saves through POST /api/crm/leads.
 */
import React, { useEffect, useState } from 'react'
import { X, Loader2, AlertTriangle, Check } from 'lucide-react'
import { M, N } from '@/components/nexus/mail/mailShared'
import { money } from '@/components/nexus/LeadsHub'

const SOURCES: [string, string][] = [['aria', 'ARIA research'], ['outbound', 'Cold call / field'], ['referral', 'Referral'], ['website', 'Website'], ['phone', 'Called in'], ['company', 'Company supplied']]
const TYPES = ['MDU', 'HOA', 'Commercial', 'Single family', 'Other']
export type FoundLead = { id: string; name: string; contact: string | null; company: string | null; location: string | null; phone: string | null; email: string | null
  status: 'open' | 'lost' | 'snoozed' | 'deal'; opportunity_id: string | null; snoozed_until: string | null; owner: string | null }
type Dup = FoundLead
const STATUS: Record<FoundLead['status'], { label: string; color: string; bg: string; action: string }> = {
  open: { label: 'Open lead', color: '#0B5CAD', bg: 'rgba(74,140,255,0.12)', action: 'Open it' },
  snoozed: { label: 'Not now', color: '#475569', bg: '#E7ECF3', action: 'Open it' },
  lost: { label: 'Marked lost', color: '#9A5B00', bg: 'rgba(245,165,36,0.16)', action: 'Bring it back' },
  deal: { label: 'Already a deal', color: '#6D4FD8', bg: 'rgba(139,92,246,0.12)', action: 'Open the deal' },
}
/** One found lead: who it is, where it sits (open / lost / not now / deal) and the button to get there. */
export function FoundRow({ m, onGo }: { m: FoundLead; onGo: (m: FoundLead) => void }) {
  const st = STATUS[m.status]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, padding: '4px 0' }}>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: M.ink }}>
        <b style={{ fontWeight: 600 }}>{m.name}</b>{[m.contact && m.contact !== m.name ? m.contact : null, m.location].filter(Boolean).map((x) => ` · ${x}`).join('')}
      </span>
      <span style={{ fontSize: 11, fontWeight: 600, color: st.color, background: st.bg, borderRadius: 6, padding: '2px 7px', whiteSpace: 'nowrap' }}>
        {st.label}{m.status === 'snoozed' && m.snoozed_until ? ` until ${new Date(`${m.snoozed_until}T00:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' })}` : ''}
      </span>
      <button type="button" onClick={() => onGo(m)} style={{ fontSize: 12, fontWeight: 600, color: '#0B5CAD', background: 'none', border: 0, cursor: 'pointer', whiteSpace: 'nowrap' }}>{st.action}</button>
    </div>
  )
}

export function NewLeadModal({ onClose, onCreated, onOpenExisting }: { onClose: () => void; onCreated: (id: string) => void; onOpenExisting: (m: FoundLead) => void }) {
  const [f, setF] = useState({ property: '', name: '', title: '', company: '', email: '', phone: '', location: '', source: 'aria', lead_type: 'MDU', units: '', entry_points: '', cameras: '', notes: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [dups, setDups] = useState<Dup[]>([])
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }))

  // Duplicate check: property, contact, phone or email that already exists.
  useEffect(() => {
    const terms = [f.property, f.name, f.phone.replace(/\D/g, '').length >= 7 ? f.phone : '', f.email.includes('@') ? f.email : ''].map((s) => s.trim()).filter((s) => s.length >= 4)
    if (!terms.length) { setDups([]); return }
    const h = window.setTimeout(async () => {
      const seen = new Map<string, Dup>()
      for (const t of terms.slice(0, 3)) {
        const d = await fetch(`/api/nexus/leads?find=${encodeURIComponent(t)}`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null)
        for (const l of (d?.matches ?? []) as Dup[]) if (!seen.has(l.id)) seen.set(l.id, l)
      }
      setDups([...seen.values()].slice(0, 4))
    }, 450)
    return () => window.clearTimeout(h)
  }, [f.property, f.name, f.phone, f.email])

  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])

  const u = Number(f.units) || 0, c = Number(f.cameras) || 0
  const mrr = u || c ? u * 10 + c * 100 : null

  async function save() {
    if (!f.property.trim() && !f.name.trim()) { setErr('Add a property or a contact name.'); return }
    setBusy(true); setErr(null)
    try {
      const r = await fetch('/api/crm/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: f.name.trim() || f.property.trim(), property_name: f.property.trim() || undefined, contact_title: f.title, company: f.company, email: f.email, phone: f.phone, city: f.location, source: f.source, lead_type: f.lead_type, units: f.units, entry_points: f.entry_points, cameras: f.cameras, notes: f.notes }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d?.id) throw new Error(d?.error || 'Could not add the lead.')
      onCreated(d.id)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not add the lead.'); setBusy(false) }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="New lead" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 115, background: 'rgba(8,13,22,0.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: M.font }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, maxHeight: '92dvh', overflowY: 'auto', background: '#fff', borderRadius: 16, boxShadow: '0 30px 80px -20px rgba(0,0,0,0.5)', color: M.ink }}>
        <div style={{ padding: '16px 18px', background: N.bg, color: '#fff', display: 'flex', alignItems: 'center', gap: 10, borderRadius: '16px 16px 0 0' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: N.label }}>New lead</div>
            <div style={{ fontSize: 17, fontWeight: 650 }}>Add a lead</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 0, background: 'rgba(255,255,255,0.1)', color: '#fff', width: 30, height: 30, borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
        </div>

        <div style={{ padding: 18, display: 'grid', gap: 12 }}>
          <div>
            <div style={lbl}>Where did it come from?</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {SOURCES.map(([v, l]) => <button key={v} type="button" onClick={() => setF((p) => ({ ...p, source: v }))} aria-pressed={f.source === v} style={pick(f.source === v)}>{l}</button>)}
            </div>
          </div>

          <Field label="Property name"><input autoFocus value={f.property} onChange={set('property')} placeholder="e.g. Marbella Apartments" style={inp} /></Field>
          <div style={two}>
            <Field label="Contact name"><input value={f.name} onChange={set('name')} placeholder="Who you'll talk to" style={inp} /></Field>
            <Field label="Their title"><input value={f.title} onChange={set('title')} placeholder="Property manager" style={inp} /></Field>
          </div>
          <div style={two}>
            <Field label="Phone"><input value={f.phone} onChange={set('phone')} inputMode="tel" style={inp} /></Field>
            <Field label="Email"><input value={f.email} onChange={set('email')} inputMode="email" style={inp} /></Field>
          </div>
          <div style={two}>
            <Field label="Management company"><input value={f.company} onChange={set('company')} style={inp} /></Field>
            <Field label="City / address"><input value={f.location} onChange={set('location')} style={inp} /></Field>
          </div>

          {dups.length > 0 && (
            <div role="status" style={{ border: '1px solid rgba(245,165,36,0.45)', background: 'rgba(245,165,36,0.08)', borderRadius: 10, padding: '9px 11px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 650, color: '#9A5B00', marginBottom: 4 }}><AlertTriangle size={14} /> Might already be in Nexus</div>
              {dups.map((d) => <FoundRow key={d.id} m={d} onGo={onOpenExisting} />)}
            </div>
          )}

          <div>
            <div style={lbl}>Size it <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>{mrr != null ? `· about ${money(mrr)}/mo` : '· optional'}</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr 1fr', gap: 6 }}>
              <select aria-label="Type" value={f.lead_type} onChange={set('lead_type')} style={inp}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
              <input aria-label="Units" placeholder="Units" inputMode="numeric" value={f.units} onChange={set('units')} style={inp} />
              <input aria-label="Cameras" placeholder="Cameras" inputMode="numeric" value={f.cameras} onChange={set('cameras')} style={inp} />
              <input aria-label="Entry points" placeholder="Entries" inputMode="numeric" value={f.entry_points} onChange={set('entry_points')} style={inp} />
            </div>
          </div>
          <Field label="Notes"><textarea value={f.notes} onChange={set('notes')} rows={2} placeholder="Anything we know — current vendor, pain, timing…" style={{ ...inp, resize: 'vertical' }} /></Field>

          {err && <div role="alert" style={{ fontSize: 12.5, color: M.red }}>{err}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={onClose} style={{ fontSize: 13.5, fontWeight: 600, padding: '8px 14px', borderRadius: 10, border: `1px solid ${M.lineStrong}`, background: '#fff', color: M.ink2, cursor: 'pointer' }}>Cancel</button>
            <button type="button" onClick={() => void save()} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 600, padding: '8px 16px', borderRadius: 10, border: 0, background: N.brand, color: '#fff', cursor: 'pointer', boxShadow: '0 8px 20px -10px rgba(74,140,255,0.9)' }}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Add lead
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'block' }}><div style={lbl}>{label}</div>{children}</label>
}
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: M.ink3, marginBottom: 5 }
const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', fontSize: 13.5, padding: '8px 10px', borderRadius: 9, border: `1px solid ${M.lineStrong}`, background: '#fff', color: M.ink, fontFamily: M.font, outline: 'none' }
const two: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }
const pick = (on: boolean): React.CSSProperties => ({ fontSize: 12.5, fontWeight: 600, padding: '5px 10px', borderRadius: 20, cursor: 'pointer', fontFamily: M.font, border: `1px solid ${on ? N.accent : M.lineStrong}`, background: on ? 'rgba(74,140,255,0.12)' : '#fff', color: on ? '#0B5CAD' : M.ink2 })
