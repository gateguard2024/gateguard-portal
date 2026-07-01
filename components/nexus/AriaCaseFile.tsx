'use client'
// ARIA Case File — glass 2036, 5th-grade-simple property intel view.
// Operations-Hub style: one scannable record + inline editing (sales stage/notes)
// + actions one click away. Self-contained; the parent passes the prospect.
import { useState } from 'react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Wifi, UserCheck, MessageSquare, ShieldCheck, Building2, CheckCircle2, Phone, Mail, Linkedin, RefreshCw, UserPlus, Loader2, MapPin } = require('lucide-react') as any

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = Record<string, any>
const BG = '#0A1020', CARD = '#0F1830', LINE = '#1E2A45', TILE = '#111B30', TXT = '#F8FAFC', MUT = '#94A3B8', BRAND = '#6B7EFF', CYAN = '#7DE5FF', GREEN = '#6EE7B7', AMBER = '#FBBF24', RED = '#FCA5A5'

const STAGES = ['prospect', 'researching', 'contacted', 'meeting', 'proposal', 'won', 'lost'] as const

const val = (v: unknown, fb = 'No data found') => (v === null || v === undefined || v === '' || v === 0 ? fb : String(v))

function Tile({ label, value }: { label: string; value: string }) {
  return <div style={{ background: TILE, border: `1px solid ${LINE}`, borderRadius: 12, padding: 12 }}>
    <div style={{ fontSize: 11, color: MUT }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 500, marginTop: 3 }}>{value}</div>
  </div>
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Card({ icon: Icon, title, right, children }: { icon: any; title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 16, padding: 16 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: CYAN }}><Icon size={16} /> {title}</div>
      {right}
    </div>
    <div style={{ marginTop: 12 }}>{children}</div>
  </div>
}
function Row({ k, v, color }: { k: string; v: string; color?: string }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 14, padding: '2px 0' }}>
    <span style={{ color: MUT }}>{k}</span><span style={{ color: color || TXT, textAlign: 'right' }}>{v}</span>
  </div>
}

export function AriaCaseFile({ prospect, social, propertyId, fresh, busy, onSaveSales, onImport, onReResearch }: {
  prospect: Any
  social?: { social_posts?: Any[] } | null
  propertyId?: string | null
  fresh?: boolean
  busy?: boolean
  onSaveSales?: (patch: { sales_stage: string; sales_notes: string }) => void | Promise<void>
  onImport?: () => void | Promise<void>
  onReResearch?: () => void | Promise<void>
}) {
  const p: Any = prospect?.property ?? {}
  const dm: Any = prospect?.decision_maker ?? {}
  const prof: Any = prospect?.profile ?? {}
  const own: Any = prospect?.ownership ?? {}
  const pains: Any[] = prospect?.pain_signals ?? []
  const posts: Any[] = social?.social_posts ?? []
  const bulk: Any[] = p.bulk_agreements ?? []
  const pt: Any = p.proptech ?? {}
  const inferred: Any[] = p.inferred_proptech ?? []

  const [stage, setStage] = useState<string>(prospect?.sales_stage ?? 'prospect')
  const [notes, setNotes] = useState<string>(prospect?.sales_notes ?? '')
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  const bulkInternet = bulk.find(b => (b.service_type ?? '').includes('internet'))
  const bulkVideo = bulk.find(b => (b.service_type ?? '').includes('video'))
  const contractEnd = p.roe_expiry_year || bulkInternet?.expiry_estimate || prof.contract_window || 'No data found'
  const hook = prospect?.pitch_strategy?.primary_hook || prospect?.scout_queue?.key_finding || prof.primary_concern

  async function save() {
    if (!onSaveSales) return
    setSaving(true); setSavedMsg(null)
    try { await onSaveSales({ sales_stage: stage, sales_notes: notes }); setSavedMsg('Saved ✓') }
    catch { setSavedMsg('Could not save') } finally { setSaving(false); setTimeout(() => setSavedMsg(null), 2500) }
  }

  const sentiment = pains.some(x => x.severity === 'high') ? { t: 'Frustrated', c: RED } : pains.length ? { t: 'Mixed', c: AMBER } : { t: 'Quiet', c: MUT }

  // Decision-maker score (0–10) — SAME additive formula as the list cards so the
  // number never disagrees: phone 3 · onsite PM 2 · regional/asset 2 · owner 2 · email 1.
  const chain: Any[] = prospect?.decision_maker_chain ?? []
  const rawPhone = dm.phone || p.phone
  const hasPhone = !!rawPhone && rawPhone !== 'No data found' && String(rawPhone).length > 5
  const hasPM = chain.some(c => c.role_type === 'property_manager' && c.name && c.name !== 'Unknown') || (!!dm.name && !chain.length)
  const hasSenior = chain.some(c => ['regional_manager', 'asset_manager'].includes(c.role_type) && c.name && c.name !== 'Unknown')
  const hasOwner = (!!own.owner_entity && own.owner_entity !== 'Unknown') || !!p.owner_entity || chain.some(c => c.role_type === 'owner' && c.name && c.name !== 'Unknown')
  const hasEmail = (!!dm.email && dm.email.includes('@')) || chain.some(c => c.email && c.email.includes('@'))
  let dmScore = 0
  if (hasPhone) dmScore += 3
  if (hasPM) dmScore += 2
  if (hasSenior) dmScore += 2
  if (hasOwner) dmScore += 2
  if (hasEmail) dmScore += 1
  const dmColor = dmScore >= 7 ? GREEN : dmScore >= 4 ? AMBER : RED
  const chip = (ok: boolean, label: string) => <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, background: ok ? 'rgba(52,211,153,0.14)' : 'rgba(255,255,255,0.05)', border: `1px solid ${ok ? 'rgba(52,211,153,0.4)' : LINE}`, color: ok ? GREEN : MUT }}>{ok ? '✓' : '–'} {label}</span>

  // Confirmed value, else an inferred guess shown with a confidence %, else "No data found".
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const techField = (arr: any[], cats: string[]): { text: string; suspected: boolean } => {
    const c = arr?.[0]
    if (c) return { text: String(c), suspected: false }
    const inf = inferred.find(i => cats.includes(i.category))
    if (inf) return { text: `${inf.name} (suspected ~${Math.round(Number(inf.confidence_pct) || 0)}%)`, suspected: true }
    return { text: 'No data found', suspected: false }
  }
  const tGate = techField(pt.gate_operators, ['gate_operator'])
  const tAccess = techField([...(pt.access_control || []), ...(pt.intercoms || [])], ['access_control', 'intercom'])
  const tCam = techField(pt.cameras, ['camera'])

  return (
    <div style={{ background: BG, border: `1px solid ${LINE}`, borderRadius: 20, overflow: 'hidden', color: TXT, fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif' }}>
      {/* Header */}
      <div style={{ padding: '20px 22px', borderBottom: `1px solid ${LINE}`, background: '#0C1426' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: BRAND }}>ARIA case file</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 500 }}>{val(p.name, 'Unnamed property')}</div>
            <div style={{ fontSize: 13, color: MUT, marginTop: 2 }}>{[p.address, p.city, p.state].filter(Boolean).join(', ') || 'No address found'}</div>
          </div>
          {prospect?.freshness_score != null && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: GREEN, background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 999, padding: '5px 11px' }}><CheckCircle2 size={13} /> Saved</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 10, marginTop: 16 }}>
          <Tile label="Units" value={val(p.units)} />
          <Tile label="Type · Class" value={[p.property_type, p.class].filter(Boolean).join(' · ') || 'No data found'} />
          <Tile label="Built" value={val(p.year_built)} />
          <Tile label="Occupancy" value={val(p.occupancy)} />
        </div>
      </div>

      {/* What to say first */}
      {hook && (
        <div style={{ margin: '16px 22px 0', background: 'linear-gradient(90deg, rgba(107,126,255,0.16), rgba(107,126,255,0.04))', border: '1px solid rgba(107,126,255,0.3)', borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: '#C7D0FF' }}>What to say first</div>
          <div style={{ fontSize: 15, marginTop: 5, lineHeight: 1.5 }}>{hook}</div>
        </div>
      )}

      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 12, padding: '16px 22px' }}>
        <Card icon={Wifi} title="Internet & TV">
          <Row k="Internet" v={val(p.isp_providers?.[0])} />
          <Row k="TV / video" v={val(p.video_providers?.[0] || bulkVideo?.provider)} />
          <Row k="Bulk deal?" v={bulk.length ? 'Yes — exclusive' : 'No data found'} color={bulk.length ? AMBER : undefined} />
          <Row k="Contract ends" v={val(contractEnd)} color={GREEN} />
        </Card>

        <Card icon={UserCheck} title="Who to call" right={<span style={{ fontSize: 12, fontWeight: 500, color: BG, background: dmColor, borderRadius: 999, padding: '3px 9px' }} title="Decision-maker data score">{dmScore} / 10</span>}>
          <div style={{ fontSize: 14 }}>{val(dm.name, 'No contact found')} {dm.title && <span style={{ color: MUT }}>· {dm.title}</span>}</div>
          <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>{chip(hasPhone, 'phone')}{chip(hasPM, 'onsite')}{chip(hasSenior, 'mgmt')}{chip(hasOwner, 'owner')}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {dm.phone && <a href={`tel:${dm.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, background: TILE, border: `1px solid ${LINE}`, borderRadius: 8, padding: '6px 9px', color: '#C7D0FF', textDecoration: 'none' }}><Phone size={13} /> Call</a>}
            {dm.email && <a href={`mailto:${dm.email}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, background: TILE, border: `1px solid ${LINE}`, borderRadius: 8, padding: '6px 9px', color: '#C7D0FF', textDecoration: 'none' }}><Mail size={13} /> Email</a>}
            {dm.linkedin_slug && <a href={`https://linkedin.com/in/${dm.linkedin_slug}`} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, background: TILE, border: `1px solid ${LINE}`, borderRadius: 8, padding: '6px 9px', color: '#C7D0FF', textDecoration: 'none' }}><Linkedin size={13} /> LinkedIn</a>}
          </div>
        </Card>

        <Card icon={MessageSquare} title="What residents say" right={<span style={{ fontSize: 11, color: sentiment.c, background: `${sentiment.c}22`, border: `1px solid ${sentiment.c}55`, borderRadius: 999, padding: '3px 9px' }}>{sentiment.t}</span>}>
          {[...pains, ...posts].slice(0, 4).length === 0 ? <div style={{ fontSize: 13, color: MUT }}>No data found</div> :
            [...pains, ...posts].slice(0, 4).map((x, i) => (
              <div key={i} style={{ fontSize: 13, lineHeight: 1.45, color: '#CBD5E1', marginBottom: 7 }}>“{val(x.quote, '')}” <span style={{ color: '#64748B' }}>· {val(x.platform || x.source, 'web')}</span></div>
            ))}
        </Card>

        <Card icon={ShieldCheck} title="Tech on site">
          <Row k="Gate" v={tGate.text} color={tGate.suspected ? AMBER : undefined} />
          <Row k="Access / intercom" v={tAccess.text} color={tAccess.suspected ? AMBER : undefined} />
          <Row k="Cameras" v={tCam.text} color={tCam.suspected ? AMBER : undefined} />
          {(tGate.suspected || tAccess.suspected || tCam.suspected) && <div style={{ fontSize: 11, color: AMBER, marginTop: 6 }}>“Suspected” = inferred from market data, not confirmed on site.</div>}
        </Card>

        <Card icon={Building2} title="Owner & money">
          <Row k="Owner" v={val(own.owner_entity || p.owner_entity)} />
          <Row k="Owner type" v={val(own.owner_type)} />
          <Row k="Portfolio" v={val(own.portfolio_size)} />
          <Row k="Acquired" v={val(own.acquisition_year)} />
          <Row k="Last sale" v={[p.last_sale_price, p.last_sale_date].filter(Boolean).join(' · ') || 'No data found'} />
        </Card>

        {/* Hub functionality — sales stage + notes (inline edit) */}
        <Card icon={UserCheck} title="Sales status">
          <div style={{ fontSize: 11, color: MUT, marginBottom: 5 }}>Stage</div>
          <select value={stage} onChange={e => setStage(e.target.value)} style={{ width: '100%', background: TILE, border: `1px solid ${LINE}`, color: TXT, borderRadius: 10, padding: '8px 10px', fontSize: 13, textTransform: 'capitalize' }}>
            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes for the team…" rows={3} style={{ width: '100%', boxSizing: 'border-box', marginTop: 8, background: TILE, border: `1px solid ${LINE}`, color: TXT, borderRadius: 10, padding: 10, fontSize: 13, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={save} disabled={saving || !onSaveSales} style={{ fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 10, border: 0, cursor: 'pointer', background: BRAND, color: BG, display: 'inline-flex', alignItems: 'center', gap: 6 }}>{saving ? <Loader2 size={13} /> : null} Save</button>
            {onImport && <button onClick={onImport} disabled={busy} style={{ fontSize: 12, fontWeight: 600, padding: '8px 12px', borderRadius: 10, cursor: 'pointer', background: 'rgba(52,211,153,0.16)', border: '1px solid rgba(52,211,153,0.4)', color: GREEN, display: 'inline-flex', alignItems: 'center', gap: 6 }}><UserPlus size={13} /> Import to CRM</button>}
            {onReResearch && <button onClick={onReResearch} disabled={busy} style={{ fontSize: 12, fontWeight: 600, padding: '8px 12px', borderRadius: 10, cursor: 'pointer', background: TILE, border: `1px solid ${LINE}`, color: MUT, display: 'inline-flex', alignItems: 'center', gap: 6 }}><RefreshCw size={13} /> Re-research</button>}
            {savedMsg && <span style={{ fontSize: 12, color: GREEN }}>{savedMsg}</span>}
          </div>
        </Card>
      </div>

      {/* Map */}
      {p.lat && p.lng && (
        <div style={{ padding: '0 22px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: MUT, marginBottom: 8 }}><MapPin size={14} /> Location</div>
          <iframe title="map" width="100%" height="220" style={{ border: 0, borderRadius: 14 }} loading="lazy" src={`https://maps.google.com/maps?q=${p.lat},${p.lng}&z=16&output=embed`} />
        </div>
      )}
      {fresh && <div style={{ padding: '0 22px 18px', fontSize: 11, color: '#64748B' }}>Live result — import to save to your Intel DB.</div>}
    </div>
  )
}
