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

// ── Theme tokens — the app's STEEL schema. Medium brushed-steel bands with
// darker brushed cards, bright text, and brighter borders for real contrast.
const BRUSH = 'repeating-linear-gradient(90deg,rgba(255,255,255,0.05) 0 1px,transparent 1px 4px)'
const C = {
  page:  `${BRUSH}, linear-gradient(180deg,#40546e,#2a3a4d)`,   // outer sheet — light steel
  cover: 'linear-gradient(105deg,#1a2c44 0%,#22374f 55%,#2c435f 100%)', // hero base under the photo
  sec:   `${BRUSH}, linear-gradient(180deg,#3a4d67,#31435b)`,   // section band — brighter steel
  close: `${BRUSH}, linear-gradient(180deg,#33465e,#26313f)`,
  tile:  `${BRUSH}, linear-gradient(180deg,#22303f,#1a2634)`,   // brushed dark card = strong contrast
  line:  'rgba(170,198,222,0.34)', accent: '#5FB8E0', good: '#12b886',
  ink:   '#f6fbff', dim: '#d6e3ef', dim2: '#a9bed1',
}
const kick = { fontSize: 10, letterSpacing: '0.16em', fontWeight: 800, color: C.accent, textTransform: 'uppercase' as const }
const secH = { fontSize: 20, fontWeight: 800, margin: '5px 0 16px', color: C.ink }
const tile = { background: C.tile, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10)' }

// Real brand assets from gateguard.co — used as tasteful defaults; any block can
// override with vars.image, and the hero prefers the quote's own cover_image_url.
const BRAND = {
  hero: 'https://www.gateguard.co/hero-bg.jpg',
  logo: 'https://www.gateguard.co/logo.png',
  brivo: 'https://www.gateguard.co/app-brivo.png',
  callbox: 'https://www.gateguard.co/app-callbox.png',
}

// Section header with an energetic accent underline.
function Head({ k, t }: { k?: string; t: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {k && <div style={kick}>{k}</div>}
      <div style={{ ...secH, margin: '6px 0 8px' }}>{t}</div>
      <div style={{ width: 46, height: 3, borderRadius: 2, background: 'linear-gradient(90deg,#5FB8E0,#3ddc97)' }} />
    </div>
  )
}

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
      case 'hero': {
        const heroImg = quote?.cover_image_url || v.image || BRAND.hero
        return (
          <div key={i} style={{
            padding: '30px 34px 30px', color: '#eaf3fb', position: 'relative', minHeight: 340,
            background: `linear-gradient(105deg, rgba(20,34,52,0.90) 0%, rgba(26,42,62,0.72) 46%, rgba(34,55,79,0.42) 100%), url("${heroImg}") center/cover no-repeat`,
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BRAND.logo} alt="Gate Guard" style={{ height: 92, marginBottom: 16, filter: 'drop-shadow(0 3px 10px rgba(0,0,0,0.55))' }} />
            <div style={{ position: 'absolute', top: 24, right: 28, textAlign: 'right' }}>
              <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8fe3c6', fontWeight: 800 }}>Your price</span>
              <b style={{ fontSize: 46, display: 'block', lineHeight: 1, marginTop: 2, background: 'linear-gradient(90deg,#7fe0ff,#8fe3c6)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.4))' }}>{money(totals.monthly)}</b>
              <span style={{ fontSize: 11, color: '#c4d6e6' }}>per month{units ? ` · ${units} units` : ''}</span>
              <div style={{ fontSize: 11, color: '#9fc2dc', marginTop: 6 }}>{money(totals.dueToday)} due today</div>
            </div>
            <div style={kick}>{v.kicker}</div>
            <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.08, margin: '10px 0 12px', maxWidth: '70%', textShadow: '0 2px 14px rgba(0,0,0,0.45)' }}>{v.headline}</div>
            <div style={{ fontSize: 14, color: '#dbe7f2', lineHeight: 1.5, maxWidth: '74%', textShadow: '0 1px 8px rgba(0,0,0,0.45)' }}>{v.subhead}</div>
            <a href="#gg-accept" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 18, padding: '12px 22px', borderRadius: 12, fontWeight: 800, fontSize: 14, textDecoration: 'none', color: '#04231a', background: 'linear-gradient(135deg,#3ddc97,#12b886)', boxShadow: '0 10px 26px rgba(18,184,134,0.4)' }}>Get started →</a>
            <div style={{ display: 'flex', gap: 26, marginTop: 18, fontSize: 11, color: '#9fc2dc', flexWrap: 'wrap' }}>
              <div>Prepared for<b style={{ display: 'block', color: '#eaf3fb', fontSize: 12 }}>{quote?.property_name || quote?.client_name || '—'}</b></div>
              <div>Date<b style={{ display: 'block', color: '#eaf3fb', fontSize: 12 }}>{quote?.created_at ? new Date(quote.created_at).toLocaleDateString() : '—'}</b></div>
              <div>Prepared by<b style={{ display: 'block', color: '#eaf3fb', fontSize: 12 }}>{quote?.created_by_name || quote?.org_name || 'Gate Guard'}</b></div>
            </div>
          </div>
        )
      }
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
            <Head k={v.kicker} t={v.title} />
            <Grid items={v.steps} />
          </div>
        )
      case 'included': {
        const items = includedItems(v)
        return (
          <div key={i} style={{ padding: '22px 32px', background: C.sec, borderBottom: `1px solid ${C.line}` }}>
            <Head k={v.kicker} t={v.title} />
            {items.map((it, k) => (
              <div key={k} style={{ display: 'flex', gap: 11, marginBottom: 12 }}>
                <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(18,182,134,.18)', border: '1px solid rgba(18,182,134,.5)', color: '#4fe0aa', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', marginTop: 1 }}>✓</span>
                <div><b style={{ color: C.ink, fontSize: 13 }}>{it.h}</b>{it.p ? <p style={{ margin: '2px 0 0', fontSize: 12, color: C.dim, lineHeight: 1.45 }}>{it.p}</p> : null}</div>
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 8 }}>
              {[
                { b: units ? String(units) : '—', s: 'units', c: C.ink },
                { b: money(perUnit), s: 'per unit / mo', c: '#7fe0ff' },
                { b: money(totals.monthly), s: 'monthly', c: '#7fe0ff' },
                { b: '$0', s: 'trip charges', c: '#3ddc97' },
              ].map((st, k) => (
                <div key={k} style={{ ...tile, textAlign: 'center', paddingTop: 14, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#5FB8E0,#3ddc97)' }} />
                  <b style={{ fontSize: 32, fontWeight: 900, color: st.c, display: 'block', lineHeight: 1 }}>{st.b}</b>
                  <span style={{ fontSize: 10, color: C.dim2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{st.s}</span>
                </div>
              ))}
            </div>
            {/* Brand app imagery — resident mobile pass + visitor callbox. */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
              {[{ img: BRAND.brivo, cap: 'Resident mobile pass — enter by phone' }, { img: BRAND.callbox, cap: 'Digital visitor callbox' }].map((x, k) => (
                <figure key={k} style={{ margin: 0, ...tile, padding: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={x.img} alt={x.cap} style={{ height: 150, width: 'auto', maxWidth: '100%', objectFit: 'contain', borderRadius: 8 }} />
                  <figcaption style={{ fontSize: 11, color: C.dim2, marginTop: 8, textAlign: 'center' }}>{x.cap}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        )
      }
      case 'costs_gone':
      case 'cameras':
      case 'value_props': {
        // Optional banner image (defaults to the brand hero shot on the cameras
        // block). Any block can set vars.image to add its own.
        const banner = v.image || (b.type === 'cameras' ? BRAND.hero : null)
        // value_props gets an accent-tinted band so there's a colour break.
        const bg = b.type === 'value_props'
          ? `${BRUSH}, linear-gradient(120deg,#124a5e 0%,#16405a 60%,#1a3a52 100%)`
          : C.sec
        return (
          <div key={i} style={{ padding: '22px 32px', background: bg, borderBottom: `1px solid ${C.line}` }}>
            <Head k={v.kicker} t={v.title} />
            {banner && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={banner} alt={v.title} style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 12, marginBottom: 14, border: `1px solid ${C.line}` }} />
            )}
            <Grid items={v.items} />
          </div>
        )
      }
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
            <div style={{ background: 'linear-gradient(180deg,#1a3550,#12263a)', border: `1px solid rgba(95,184,224,0.55)`, borderRadius: 16, padding: 20, marginTop: 8, boxShadow: '0 16px 46px rgba(0,0,0,.4), 0 0 40px rgba(95,184,224,0.14)' }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', color: '#04231a', background: 'linear-gradient(135deg,#3ddc97,#12b886)', display: 'inline-block', padding: '4px 11px', borderRadius: 999, textTransform: 'uppercase', boxShadow: '0 4px 14px rgba(18,184,134,0.4)' }}>★ Recommended</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '12px 0 6px' }}>
                <b style={{ fontSize: 48, fontWeight: 900, lineHeight: 1, background: 'linear-gradient(90deg,#7fe0ff,#8fe3c6)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{money(totals.monthly)}</b>
                <em style={{ fontStyle: 'normal', color: '#c4d6e6', fontSize: 13, fontWeight: 600 }}>/ month{units ? ` · ${units} units` : ''}</em>
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
          <div key={i} id="gg-accept" style={{ padding: '28px 32px', background: `${BRUSH}, linear-gradient(140deg,#153a4e,#122a3d)`, color: C.dim, scrollMarginTop: 12 }}>
            <div style={{ ...secH, fontSize: 24 }}>{v.title}</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{v.body} — <b style={{ color: C.ink }}>{quote?.created_by_name || 'Russel Feldman'}</b>, Gate Guard</div>
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
                <button onClick={accept} disabled={busy} style={{ width: '100%', background: 'linear-gradient(135deg,#3ddc97,#12b886)', color: '#04231a', border: 0, fontWeight: 900, padding: '16px 16px', borderRadius: 12, fontSize: 16, letterSpacing: '0.01em', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, boxShadow: '0 12px 30px rgba(18,184,134,0.42)' }}>
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
    <div style={{ maxWidth: 900, margin: '0 auto', background: C.page, color: C.ink, borderRadius: 16, overflow: 'hidden', border: `1px solid ${C.line}`, boxShadow: '0 24px 70px rgba(0,0,0,0.45)', fontFamily: 'ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif' }}>
      {blocks.map(renderBlock)}
    </div>
  )
}

const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0', borderBottom: `1px dashed ${C.line}`, color: '#cdddec' }
const totSpan: React.CSSProperties = { fontSize: 9.5, color: C.dim2, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block' }
const totB: React.CSSProperties = { fontSize: 18, color: C.ink }
const inp: React.CSSProperties = { padding: '9px 11px', border: `1px solid ${C.line}`, borderRadius: 9, background: 'rgba(0,0,0,0.28)', color: C.ink, fontSize: 13 }
