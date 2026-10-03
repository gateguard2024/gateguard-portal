'use client'

/**
 * SurveyRecord — the client-facing GateGuard Pre-Proposal Survey document.
 * Renders the designed multi-section record (cover, findings, openings, per-area
 * records with photos, scope schedule, open items, recommendations, photo index)
 * from a survey + its stored survey_doc overrides. Screen view and print match.
 */
import { resolveSurvey, staticMapUrl, type SurveyDocConfig, type AreaPhoto } from '@/lib/survey-doc'

const NAVY = '#12233b'
const INK = '#1a2432'
const BODY = '#27364a'
const MUT = '#5a6c84'
const ORANGE = '#c2410c'
const LINE = '#e5ebf1'

function Kicker({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: ORANGE, textTransform: 'uppercase', marginBottom: 4 }}>{children}</div>
}
function H({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 26, fontWeight: 800, color: NAVY, lineHeight: 1.1, marginBottom: 14 }}>{children}</div>
}
function statusChip(status: string) {
  const u = status.toUpperCase()
  const map: Record<string, { bg: string; fg: string }> = {
    'NON-WORKING': { bg: '#fdecea', fg: '#b4330f' },
    'NOT VERIFIED': { bg: '#eef1f5', fg: '#5a6c84' },
    'NONE': { bg: '#eef1f5', fg: '#5a6c84' },
    'WORKING': { bg: '#e7f4ec', fg: '#12855f' },
  }
  const c = map[u] || { bg: '#eef1f5', fg: '#5a6c84' }
  return <span style={{ display: 'inline-block', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.04em', padding: '2px 7px', borderRadius: 4, background: c.bg, color: c.fg, whiteSpace: 'nowrap' }}>{u}</span>
}
function prChip(p?: string) {
  const u = (p || 'MEDIUM').toUpperCase()
  const fg = u === 'HIGH' ? '#b4330f' : u === 'LOW' ? '#5a6c84' : '#9a6b00'
  return <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', color: fg }}>{u}</span>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function SurveyRecord({ survey, cfg }: { survey: any; cfg?: SurveyDocConfig }) {
  const r = resolveSurvey(survey, cfg ?? {})
  const paper: React.CSSProperties = { maxWidth: 840, margin: '0 auto', background: '#fff', color: BODY, fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif', fontSize: 13.5, lineHeight: 1.6 }
  const pad = '40px 52px'
  const sectionGap: React.CSSProperties = { borderTop: `1px solid ${LINE}`, margin: '0', padding: pad }
  const th: React.CSSProperties = { textAlign: 'left', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUT, padding: '8px 10px', borderBottom: `2px solid ${NAVY}` }
  const td: React.CSSProperties = { padding: '8px 10px', borderBottom: `1px solid ${LINE}`, verticalAlign: 'top', fontSize: 12.5 }

  return (
    <div style={paper}>
      <style>{`@media print { .sr-break { page-break-before: always; } } .sr-photo { width:100%; aspect-ratio: 4/3; object-fit: cover; border-radius: 8px; display:block; background:#eef1f5; }`}</style>

      {/* ── Cover (dark) ────────────────────────────────────── */}
      <div style={{ padding: '48px 52px', background: '#0f1c2e', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '0.02em' }}>GATE<span style={{ color: '#f0763f' }}>GUARD</span></div>
          <div style={{ textAlign: 'right', fontSize: 10.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, borderTop: '2px solid #f0763f', paddingTop: 4 }}>SURVEY RECORD {r.recordNo}<br />VERSION {r.version} · ISSUED {r.issuedDate}</div>
        </div>
        {r.heroUrl ? (
          <div style={{ position: 'relative', marginBottom: 22 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.heroUrl} alt={r.heroCaption || r.property} style={{ width: '100%', height: 330, objectFit: 'cover', borderRadius: 10, display: 'block' }} />
            {r.heroCaption && <div style={{ position: 'absolute', left: 12, bottom: 12, background: 'rgba(8,14,22,0.72)', color: '#fff', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', padding: '4px 8px', borderRadius: 4, textTransform: 'uppercase' }}>{r.heroCaption}</div>}
          </div>
        ) : <div style={{ height: 8 }} />}
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: '#f0763f', textTransform: 'uppercase', marginBottom: 6 }}>GateGuard Pre-Proposal Survey</div>
        <div style={{ fontSize: 44, fontWeight: 800, color: '#fff', lineHeight: 1.03 }}>{r.property}</div>
        {r.address && <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>{r.address}</div>}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', margin: '22px 0' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 24px' }}>
          <CoverCell dark label="Prepared for" value={r.preparedForName} sub={[r.preparedForContact, r.contactTitle].filter(Boolean).join(', ')} />
          <CoverCell dark label="Survey date" value={r.surveyDate || '—'} sub={r.walkWindow ? `On-site walk, ${r.walkWindow}` : ''} />
          <CoverCell dark label="Surveyed by" value={r.surveyedBy} sub={r.surveyorRole} />
          <CoverCell dark label="Record" value={`${r.totalPhotos} photos`} sub={r.recordSummary} />
        </div>
      </div>

      {/* ── Executive summary ───────────────────────────────── */}
      {r.execSummary && (
        <div className="sr-break" style={sectionGap}>
          <Kicker>01 · Summary</Kicker>
          <H>Executive summary</H>
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 28 }}>
            <div style={{ whiteSpace: 'pre-line' }}>{r.execSummary}</div>
            <div>
              <SidebarTitle>Property</SidebarTitle>
              {r.facts.map((f, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '5px 0', borderBottom: `1px solid ${LINE}`, fontSize: 12 }}>
                  <span style={{ color: MUT }}>{f.label}</span><span style={{ color: INK, fontWeight: 600, textAlign: 'right' }}>{f.value}</span>
                </div>
              ))}
              {r.directionNote && <><SidebarTitle style={{ marginTop: 14 }}>Direction</SidebarTitle><div style={{ fontSize: 12, color: BODY }}>{r.directionNote}</div></>}
            </div>
          </div>
        </div>
      )}

      {/* ── Summary of findings ─────────────────────────────── */}
      <div className="sr-break" style={sectionGap}>
        <Kicker>02 · Findings</Kicker>
        <H>Summary of findings</H>
        <div style={{ fontSize: 12.5, color: MUT, marginBottom: 14 }}>{r.findingsIntro}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: r.priorityFindings.length ? 24 : 0 }}>
          {r.stats.map((st, i) => (
            <div key={i} style={{ background: '#f6f8fb', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 30, fontWeight: 800, color: NAVY, lineHeight: 1 }}>{st.num}</div>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: CYANish(), marginTop: 6 }}>{st.label}</div>
              {st.sub && <div style={{ fontSize: 11.5, color: MUT, marginTop: 2 }}>{st.sub}</div>}
            </div>
          ))}
        </div>
        {r.priorityFindings.length > 0 && (
          <>
            <SidebarTitle>Priority findings</SidebarTitle>
            {r.priorityFindings.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: `1px solid ${LINE}` }}>
                <div style={{ color: ORANGE, fontWeight: 800, width: 28, flexShrink: 0 }}>{f.ref || `F${i + 1}`}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: INK }}>{f.title}</div>
                  {f.detail && <div style={{ fontSize: 12.5, color: BODY, marginTop: 2 }}>{f.detail}</div>}
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' }}>{prChip(f.priority)}</div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* ── Site layout ─────────────────────────────────────── */}
      {(r.aerialUrl || r.pins.length > 0) && (() => {
        const mapUrl = r.aerialUrl || (r.hasGeo ? staticMapUrl(r.pins) : '')
        return (
        <div className="sr-break" style={sectionGap}>
          <Kicker>03 · Overview</Kicker>
          <H>Site layout</H>
          {mapUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mapUrl} alt="Site aerial" style={{ width: '100%', borderRadius: 10, display: 'block', marginBottom: 12 }} />
          )}
          {!r.aerialUrl && r.hasGeo && <div style={{ fontSize: 10.5, color: MUT, marginBottom: 10 }}>Pins placed from photo GPS · imagery © Mapbox, © OpenStreetMap</div>}
          {r.pins.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Pin</th><th style={th}>Area</th><th style={th}>Type</th></tr></thead>
              <tbody>
                {r.pins.map((p, i) => (
                  <tr key={i}><td style={{ ...td, color: ORANGE, fontWeight: 800, width: 50 }}>{p.pin}</td><td style={td}>{p.area}</td><td style={{ ...td, color: MUT }}>{p.kind === 'amenity' ? 'Amenity' : 'Vehicle entrance'}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        )
      })()}

      {/* ── Openings as found ───────────────────────────────── */}
      {r.openings.length > 0 && (
        <div className="sr-break" style={sectionGap}>
          <Kicker>04 · Access</Kicker>
          <H>Openings as found</H>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Type</th><th style={th}>Opening</th><th style={th}>Pin</th><th style={th}>Photos</th><th style={th}>Status</th><th style={th}>Notes</th></tr></thead>
            <tbody>
              {r.openings.map((o, i) => (
                <tr key={i}>
                  <td style={{ ...td, color: MUT }}>{o.type}</td>
                  <td style={{ ...td, fontWeight: 700, color: INK }}>{o.opening}</td>
                  <td style={{ ...td, color: ORANGE, fontWeight: 800 }}>{o.pin}</td>
                  <td style={{ ...td, color: MUT }}>{o.photos}</td>
                  <td style={td}>{statusChip(o.status || '')}</td>
                  <td style={td}>{o.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(r.hardwareNote || r.headendNote || r.videoNote) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginTop: 18 }}>
              {r.hardwareNote && <div><SidebarTitle>Hardware in place</SidebarTitle><div style={{ fontSize: 12, color: BODY }}>{r.hardwareNote}</div></div>}
              {r.headendNote && <div><SidebarTitle>Head-end</SidebarTitle><div style={{ fontSize: 12, color: BODY }}>{r.headendNote}</div></div>}
              {r.videoNote && <div><SidebarTitle>Video</SidebarTitle><div style={{ fontSize: 12, color: BODY }}>{r.videoNote}</div></div>}
            </div>
          )}
        </div>
      )}

      {/* ── Area records ────────────────────────────────────── */}
      {r.areas.map((a, ai) => (
        <div key={ai} className="sr-break" style={sectionGap}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: ORANGE }}>{a.no}</span>
            <span style={{ fontSize: 24, fontWeight: 800, color: NAVY }}>{a.title}</span>
          </div>
          {a.subtitle && <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: MUT, textTransform: 'uppercase', margin: '4px 0 2px' }}>{a.subtitle}</div>}
          {a.statusTags && a.statusTags.length > 0 && <div style={{ display: 'flex', gap: 6, margin: '8px 0' }}>{a.statusTags.map((t, i) => <span key={i}>{statusChip(t)}</span>)}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 28, marginTop: 10 }}>
            <div>
              {a.narrative && <div style={{ whiteSpace: 'pre-line', marginBottom: 12 }}>{a.narrative}</div>}
              {a.observations && a.observations.length > 0 && (
                <>
                  <SidebarTitle>Observations</SidebarTitle>
                  <ul style={{ margin: '0 0 0 18px', padding: 0 }}>
                    {a.observations.map((o, i) => <li key={i} style={{ marginBottom: 4, color: BODY }}>{o}</li>)}
                  </ul>
                </>
              )}
            </div>
            {a.equipment && a.equipment.length > 0 && (
              <div>
                <SidebarTitle>Equipment observed</SidebarTitle>
                {a.equipment.map((e, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: `1px solid ${LINE}` }}>
                    <span style={{ color: ORANGE, fontWeight: 800, fontSize: 11, width: 36, flexShrink: 0 }}>{e.tag}</span>
                    <div><div style={{ fontWeight: 700, color: INK, fontSize: 12.5 }}>{e.label}</div>{e.sub && <div style={{ fontSize: 11.5, color: MUT }}>{e.sub}</div>}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {a.photos && a.photos.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 16 }}>
              {a.photos.map((p, i) => <PhotoCard key={i} p={p} />)}
            </div>
          )}
        </div>
      ))}

      {/* ── Scope schedule ──────────────────────────────────── */}
      {r.schedule.length > 0 && (
        <div className="sr-break" style={sectionGap}>
          <Kicker>Schedule</Kicker>
          <H>Scope schedule</H>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Device</th><th style={th}>Qty</th><th style={th}>Make</th><th style={th}>Condition</th><th style={th}>Disposition</th></tr></thead>
            <tbody>
              {r.schedule.map((row, i) => (
                <tr key={i}>
                  <td style={{ ...td, fontWeight: 700, color: INK }}>{row.device}</td>
                  <td style={td}>{row.qty}</td>
                  <td style={{ ...td, color: MUT }}>{row.make}</td>
                  <td style={td}>{row.condition}</td>
                  <td style={td}>{row.disposition}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {r.scheduleNote && <div style={{ fontSize: 11, color: MUT, marginTop: 8 }}>{r.scheduleNote}</div>}
        </div>
      )}

      {/* ── Open items ──────────────────────────────────────── */}
      {r.openItems.length > 0 && (
        <div className="sr-break" style={sectionGap}>
          <Kicker>Register</Kicker>
          <H>Open items</H>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>ID</th><th style={th}>Open item</th><th style={th}>Why it matters</th><th style={th}>Owner</th></tr></thead>
            <tbody>
              {r.openItems.map((o, i) => (
                <tr key={i}>
                  <td style={{ ...td, color: ORANGE, fontWeight: 800 }}>{o.ref || `O${String(i + 1).padStart(2, '0')}`}</td>
                  <td style={{ ...td, fontWeight: 700, color: INK }}>{o.item}</td>
                  <td style={td}>{o.why}</td>
                  <td style={{ ...td, color: MUT }}>{o.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Recommendations ─────────────────────────────────── */}
      {r.recommendations.length > 0 && (
        <div className="sr-break" style={sectionGap}>
          <Kicker>Next steps</Kicker>
          <H>Recommendations</H>
          {r.recommendations.map((rec, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: `1px solid ${LINE}` }}>
              <div style={{ color: ORANGE, fontWeight: 800, width: 32, flexShrink: 0 }}>{rec.ref || `R${i + 1}`}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: INK }}>{rec.title}</div>
                {rec.detail && <div style={{ fontSize: 12.5, color: BODY, marginTop: 2 }}>{rec.detail}</div>}
                {rec.owner && <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: MUT, textTransform: 'uppercase', marginTop: 4 }}>Owner · {rec.owner}</div>}
              </div>
              <div style={{ flexShrink: 0 }}>{prChip(rec.priority)}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Photo index ─────────────────────────────────────── */}
      {r.photoIndex.length > 0 && (
        <div className="sr-break" style={sectionGap}>
          <Kicker>Appendix</Kicker>
          <H>Photo index</H>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {r.photoIndex.map((p, i) => <PhotoCard key={i} p={p} small />)}
          </div>
        </div>
      )}

      <div style={{ padding: '16px 52px', borderTop: `1px solid ${LINE}`, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: MUT }}>
        <span>GATE<span style={{ color: ORANGE }}>GUARD</span> · {r.property} · Pre-Proposal Survey</span>
        <span>{r.recordNo}</span>
      </div>
    </div>
  )
}

function CoverCell({ label, value, sub, dark }: { label: string; value: string; sub?: string; dark?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', color: dark ? 'rgba(255,255,255,0.55)' : MUT, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: dark ? '#fff' : INK, marginTop: 3 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: dark ? 'rgba(255,255,255,0.65)' : MUT, marginTop: 1 }}>{sub}</div>}
    </div>
  )
}
function SidebarTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', color: NAVY, textTransform: 'uppercase', margin: '0 0 8px', borderBottom: `2px solid ${LINE}`, paddingBottom: 4, ...style }}>{children}</div>
}
function PhotoCard({ p, small }: { p: AreaPhoto; small?: boolean }) {
  return (
    <div>
      <div style={{ position: 'relative' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.url} alt={p.caption || 'Survey photo'} className="sr-photo" />
        {p.code && <div style={{ position: 'absolute', left: 6, top: 6, background: 'rgba(8,14,22,0.8)', color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 5px', borderRadius: 3 }}>{p.code}</div>}
      </div>
      <div style={{ fontSize: small ? 10.5 : 12, fontWeight: 700, color: INK, marginTop: 5 }}>{p.caption}</div>
      {!small && p.sub && <div style={{ fontSize: 11.5, color: MUT }}>{p.sub}</div>}
      {p.time && <div style={{ fontSize: 10, color: MUT }}>{p.time}</div>}
    </div>
  )
}
function CYANish() { return '#185fa5' }

export default SurveyRecord
