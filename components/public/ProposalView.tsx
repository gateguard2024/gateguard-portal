'use client'

/**
 * ProposalView — the ONE customer-facing proposal renderer (Phase 1).
 *
 * Replaces the two divergent pages (/quotes/[id]/proposal + /approve). It renders
 * the ordered module stack (lib/proposal-modules) in a single Qwilr-style theme,
 * computes every total the shared way, makes optional upgrades interactive, and
 * handles accept / sign via the existing public POST endpoint.
 */
import { useMemo, useState } from 'react'
import {
  resolveBlocks, moduleDef, computeTotals,
  type ProposalBlock, type PricedLine,
} from '@/lib/proposal-modules'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Quote = Record<string, any>

const money = (n: number) => '$' + Math.round(n || 0).toLocaleString()

// ── Theme tokens (dark steel — the Qwilr look) ───────────────────────────────
const C = {
  cover: 'radial-gradient(120% 140% at 15% 0%,#16406b 0%,#0c1a2e 55%,#070d18 100%)',
  sec: '#0e1a2b', close: '#0b1524', tile: '#12233a',
  line: 'rgba(150,180,210,0.16)', accent: '#5FB8E0', good: '#12b886',
  ink: '#f2f8fd', dim: '#b8cad9', dim2: '#8fabc4',
}
const kick = { fontSize: 10, letterSpacing: '0.16em', fontWeight: 800, color: C.accent, textTransform: 'uppercase' as const }
const secH = { fontSize: 20, fontWeight: 800, margin: '5px 0 16px', color: C.ink }
const tile = { background: C.tile, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14 }

function Grid({ items }: { items: { h: string; p: string }[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
      {items.map((it, i) => (
        <div key={i} style={tile}>
          <b style={{ color: C.ink, fontSize: 13 }}>{it.h}</b>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: C.dim, lineHeight: 1.45 }}>{it.p}</p>
        </div>
      ))}
    </div>
  )
}

export default function ProposalView({ quote, lineItems, preview = false }: { quote: Quote; lineItems: PricedLine[]; preview?: boolean }) {
  const blocks = useMemo(() => resolveBlocks(quote), [quote])
  const vars = (b: ProposalBlock) => ({ ...(moduleDef(b.type)?.defaultVars ?? {}), ...(b.vars ?? {}) })

  // Optional upgrades: start from whatever the client already selected (is_included).
  const optionalIds = useMemo(() => lineItems.filter(l => l.is_optional).map(l => l.id), [lineItems])
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(lineItems.filter(l => l.is_optional && l.is_included).map(l => l.id))
  )
  const totals = useMemo(() => computeTotals(lineItems, selected), [lineItems, selected])

  const units = Number(quote?.units) || 0
  const perUnit = units > 0 ? totals.recurring / units : 0

  const requiredOneTime = lineItems.filter(l => !l.is_optional && !l.recurring)
  const requiredRecurring = lineItems.filter(l => !l.is_optional && l.recurring)
  const optional = lineItems.filter(l => l.is_optional)

  // ── Accept / sign ──────────────────────────────────────────────────────────
  const alreadyAccepted = quote?.status === 'accepted' || !!quote?.signed_at || !!quote?.accepted_at
  const [signName, setSignName] = useState('')
  const [signEmail, setSignEmail] = useState(quote?.client_email ?? '')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(alreadyAccepted)
  const [err, setErr] = useState<string | null>(null)

  async function accept() {
    setBusy(true); setErr(null)
    try {
      const item_selections = optionalIds.map(id => ({ id, is_included: selected.has(id) }))
      const signing = signName.trim().length > 0
      const body = signing
        ? { action: 'sign', signer_name: signName.trim(), signer_email: signEmail, item_selections }
        : { action: 'approve', item_selections }
      const r = await fetch(`/api/quotes/${quote.id}/public`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || j?.error) { setErr(j?.error || 'Could not submit. Please try again.'); return }
      setDone(true)
    } catch { setErr('Could not submit. Please try again.') }
    finally { setBusy(false) }
  }

  // What's-included items: quote.whats_included (string[] or {h,p}[]) else module default.
  function includedItems(v: { items?: { h: string; p: string }[] }): { h: string; p: string }[] {
    const wi = quote?.whats_included
    if (Array.isArray(wi) && wi.length) {
      return wi.map((x: unknown) => typeof x === 'string' ? { h: x, p: '' } : (x as { h: string; p: string }))
    }
    return v.items ?? []
  }

  function renderBlock(b: ProposalBlock, i: number) {
    if (!b.enabled) return null
    const v = vars(b)
    switch (b.type) {
      case 'hero':
        return (
          <div key={i} style={{ padding: '34px 32px 28px', background: C.cover, color: '#eaf3fb', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 24, right: 28, textAlign: 'right' }}>
              <b style={{ fontSize: 26, display: 'block', color: '#fff' }}>{money(totals.dueToday)}</b>
              <span style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9fc2dc' }}>due today</span>
            </div>
            <div style={kick}>{v.kicker}</div>
            <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.12, margin: '10px 0 12px', maxWidth: '76%' }}>{v.headline}</div>
            <div style={{ fontSize: 13, color: '#c4d6e6', lineHeight: 1.5, maxWidth: '82%' }}>{v.subhead}</div>
            <div style={{ display: 'flex', gap: 26, marginTop: 18, fontSize: 11, color: '#9fc2dc', flexWrap: 'wrap' }}>
              <div>Prepared for<b style={{ display: 'block', color: '#eaf3fb', fontSize: 12 }}>{quote?.property_name || quote?.client_name || '—'}</b></div>
              <div>Date<b style={{ display: 'block', color: '#eaf3fb', fontSize: 12 }}>{quote?.created_at ? new Date(quote.created_at).toLocaleDateString() : '—'}</b></div>
              <div>Prepared by<b style={{ display: 'block', color: '#eaf3fb', fontSize: 12 }}>{quote?.created_by_name || quote?.org_name || 'Gate Guard'}</b></div>
            </div>
          </div>
        )
      case 'cover_letter':
        return (
          <div key={i} style={{ padding: '22px 32px', background: C.sec, borderBottom: `1px solid ${C.line}`, color: C.dim }}>
            <div style={secH}>{v.title}</div>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: C.dim, whiteSpace: 'pre-line' }}>{v.body}</p>
            <div style={{ marginTop: 10, fontWeight: 700, color: C.ink }}>{quote?.created_by_name || 'Russel Feldman'}</div>
          </div>
        )
      case 'problem':
        return (
          <div key={i} style={{ padding: '22px 32px', background: C.sec, borderBottom: `1px solid ${C.line}` }}>
            <div style={kick}>{v.kicker}</div><div style={secH}>{v.title}</div>
            <Grid items={v.steps} />
          </div>
        )
      case 'included': {
        const items = includedItems(v)
        return (
          <div key={i} style={{ padding: '22px 32px', background: C.sec, borderBottom: `1px solid ${C.line}` }}>
            <div style={kick}>{v.kicker}</div><div style={secH}>{v.title}</div>
            {items.map((it, k) => (
              <div key={k} style={{ display: 'flex', gap: 11, marginBottom: 12 }}>
                <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(18,182,134,.18)', border: '1px solid rgba(18,182,134,.5)', color: '#4fe0aa', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', marginTop: 1 }}>✓</span>
                <div><b style={{ color: C.ink, fontSize: 13 }}>{it.h}</b>{it.p ? <p style={{ margin: '2px 0 0', fontSize: 12, color: C.dim, lineHeight: 1.45 }}>{it.p}</p> : null}</div>
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 8 }}>
              {[
                { b: units ? String(units) : '—', s: 'units' },
                { b: money(perUnit), s: 'per unit/mo' },
                { b: money(totals.monthly), s: 'monthly' },
                { b: '$0', s: 'trip charges' },
              ].map((st, k) => (
                <div key={k} style={{ ...tile, textAlign: 'center' }}>
                  <b style={{ fontSize: 20, color: C.ink, display: 'block' }}>{st.b}</b>
                  <span style={{ fontSize: 10, color: C.dim2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{st.s}</span>
                </div>
              ))}
            </div>
          </div>
        )
      }
      case 'costs_gone':
      case 'cameras':
      case 'value_props':
        return (
          <div key={i} style={{ padding: '22px 32px', background: C.sec, borderBottom: `1px solid ${C.line}` }}>
            <div style={kick}>{v.kicker}</div><div style={secH}>{v.title}</div>
            <Grid items={v.items} />
          </div>
        )
      case 'testimonial':
        return (
          <div key={i} style={{ padding: '24px 32px', background: C.sec, borderBottom: `1px solid ${C.line}` }}>
            <p style={{ fontSize: 15, fontStyle: 'italic', color: C.ink, lineHeight: 1.5, margin: 0 }}>&ldquo;{v.quote}&rdquo;</p>
            <div style={{ marginTop: 8, fontSize: 12, color: C.dim2 }}><b style={{ color: C.dim }}>{v.author}</b> · {v.role}</div>
          </div>
        )
      case 'quote':
        return (
          <div key={i} style={{ padding: '22px 32px', background: C.sec, borderBottom: `1px solid ${C.line}` }}>
            <div style={kick}>YOUR QUOTE</div>
            <div style={{ background: 'linear-gradient(180deg,#13293f,#0d1c2e)', border: `1px solid rgba(95,184,224,0.4)`, borderRadius: 16, padding: 18, marginTop: 8, boxShadow: '0 12px 40px rgba(0,0,0,.35)' }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', color: '#0c1424', background: C.accent, display: 'inline-block', padding: '3px 9px', borderRadius: 999, textTransform: 'uppercase' }}>Recommended</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '10px 0 6px' }}>
                <b style={{ fontSize: 30, color: C.ink }}>{money(totals.monthly)}</b>
                <em style={{ fontStyle: 'normal', color: '#9fc2dc', fontSize: 12 }}>/ month{units ? ` · ${units} units` : ''}</em>
              </div>

              {requiredRecurring.length > 0 && (
                <div style={{ margin: '10px 0 2px', fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: C.dim2 }}>MONTHLY PROGRAM</div>
              )}
              {requiredRecurring.map(l => (
                <div key={l.id} style={row}><span>{l.description}</span><span>{money(l.total)}/mo</span></div>
              ))}

              {requiredOneTime.length > 0 && (
                <div style={{ margin: '12px 0 2px', fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: C.dim2 }}>ONE-TIME SETUP</div>
              )}
              {requiredOneTime.map(l => (
                <div key={l.id} style={row}><span>{l.description}{l.qty > 1 ? ` ×${l.qty}` : ''}</span><span>{money(l.total)}</span></div>
              ))}

              {optional.length > 0 && (
                <>
                  <div style={{ margin: '14px 0 2px', fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: C.dim2 }}>OPTIONAL UPGRADES — YOU CHOOSE</div>
                  {optional.map(l => {
                    const on = selected.has(l.id)
                    return (
                      <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 0', borderBottom: `1px dashed ${C.line}`, cursor: done ? 'default' : 'pointer' }}>
                        <input type="checkbox" checked={on} disabled={done} onChange={e => {
                          setSelected(prev => { const n = new Set(prev); if (e.target.checked) n.add(l.id); else n.delete(l.id); return n })
                        }} style={{ accentColor: C.accent, width: 16, height: 16 }} />
                        <span style={{ flex: 1 }}><b style={{ color: '#eaf3fb', fontSize: 12.5 }}>{l.description}</b>{l.notes ? <em style={{ display: 'block', fontStyle: 'normal', fontSize: 10.5, color: C.dim2 }}>{l.notes}</em> : null}</span>
                        <span style={{ fontWeight: 700, color: '#7fd0f0' }}>{money(l.total)}{l.recurring ? '/mo' : ''}</span>
                      </label>
                    )
                  })}
                </>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 14 }}>
                <div style={{ ...tile, textAlign: 'center' }}><span style={totSpan}>One-time</span><b style={totB}>{money(totals.setup)}</b></div>
                <div style={{ ...tile, textAlign: 'center' }}><span style={totSpan}>Monthly</span><b style={totB}>{money(totals.monthly)}</b></div>
                <div style={{ ...tile, textAlign: 'center', borderColor: 'rgba(95,184,224,.5)', background: '#143050' }}><span style={totSpan}>Due today</span><b style={totB}>{money(totals.dueToday)}</b></div>
              </div>
            </div>
          </div>
        )
      case 'payment_schedule': {
        const sched = Array.isArray(quote?.payment_schedule_json) ? quote.payment_schedule_json : []
        if (!sched.length) return null
        return (
          <div key={i} style={{ padding: '22px 32px', background: C.sec, borderBottom: `1px solid ${C.line}` }}>
            <div style={kick}>PAYMENT SCHEDULE</div><div style={secH}>{v.title}</div>
            {sched.map((s: { label?: string; description?: string; amount?: number; suffix?: string }, k: number) => (
              <div key={k} style={row}>
                <span><b style={{ color: C.ink }}>{s.label}</b>{s.description ? ` — ${s.description}` : ''}</span>
                <span>{typeof s.amount === 'number' ? money(s.amount) : ''}{s.suffix ?? ''}</span>
              </div>
            ))}
          </div>
        )
      }
      case 'attachments': {
        const files = Array.isArray(quote?.attachments) ? quote.attachments : []
        if (!files.length) return null
        return (
          <div key={i} style={{ padding: '22px 32px', background: C.sec, borderBottom: `1px solid ${C.line}` }}>
            <div style={kick}>ATTACHMENTS</div><div style={secH}>{v.title}</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {files.map((f: { name?: string; url?: string }, k: number) => (
                <a key={k} href={f.url} target="_blank" rel="noreferrer" style={{ ...tile, display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: C.accent, fontSize: 13, fontWeight: 600 }}>
                  <span>{f.name || 'Attachment'}</span><span>Download ↗</span>
                </a>
              ))}
            </div>
          </div>
        )
      }
      case 'agreement': {
        const html = quote?.agreement_html
        const sow = quote?.sow_text
        if (!html && !sow) return null
        return (
          <div key={i} style={{ padding: '22px 32px', background: C.sec, borderBottom: `1px solid ${C.line}` }}>
            <div style={kick}>AGREEMENT</div><div style={secH}>Service agreement & scope</div>
            {html
              ? <div style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: String(html) }} />
              : <p style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{sow}</p>}
          </div>
        )
      }
      case 'close':
        return (
          <div key={i} style={{ padding: '24px 32px', background: C.close, color: C.dim }}>
            <div style={secH}>{v.title}</div>
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>{v.body} — <b style={{ color: C.ink }}>{quote?.created_by_name || 'Russel Feldman'}</b>, Gate Guard</div>
            {preview ? (
              <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 11, background: 'rgba(95,184,224,.10)', border: '1px dashed rgba(95,184,224,.4)', color: '#9fc2dc', fontSize: 12, fontWeight: 600 }}>Preview — the client signs & accepts here.</div>
            ) : done ? (
              <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 11, background: 'rgba(18,184,134,.14)', border: '1px solid rgba(18,184,134,.4)', color: '#7fe0b8', fontWeight: 700 }}>✓ Accepted — thank you! We’ll be in touch to get started.</div>
            ) : (
              <div style={{ marginTop: 14, ...tile }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <input value={signName} onChange={e => setSignName(e.target.value)} placeholder="Type your name to sign" style={inp} />
                  <input value={signEmail} onChange={e => setSignEmail(e.target.value)} placeholder="Email" style={inp} />
                </div>
                {err && <div style={{ fontSize: 12, color: '#fca5a5', marginBottom: 8 }}>{err}</div>}
                <button onClick={accept} disabled={busy} style={{ width: '100%', background: C.good, color: '#04231a', border: 0, fontWeight: 800, padding: '12px 16px', borderRadius: 11, fontSize: 14, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                  {busy ? 'Submitting…' : signName.trim() ? 'Accept & Sign →' : 'Accept Proposal →'}
                </button>
              </div>
            )}
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', background: '#0c1424', color: C.ink, borderRadius: 16, overflow: 'hidden', fontFamily: 'ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif' }}>
      {blocks.map(renderBlock)}
    </div>
  )
}

const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0', borderBottom: `1px dashed ${C.line}`, color: '#cdddec' }
const totSpan: React.CSSProperties = { fontSize: 9.5, color: C.dim2, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block' }
const totB: React.CSSProperties = { fontSize: 18, color: C.ink }
const inp: React.CSSProperties = { padding: '9px 11px', border: `1px solid ${C.line}`, borderRadius: 9, background: 'rgba(0,0,0,0.28)', color: C.ink, fontSize: 13 }
