'use client'

/**
 * PartnershipAgreement — client-facing service agreement, generated from the same
 * partnership config as the proposal so the two always match. Clean, print-ready.
 */
import { buildPartnershipAgreement } from '@/lib/partnership-agreement'
import { resolvePartnership, money, type PartnershipConfig } from '@/lib/partnership-proposal'

const NAVY = '#12233b'; const INK = '#1a2432'; const BODY = '#27364a'; const MUT = '#5a6c84'; const CYAN = '#2f7fb8'; const LINE = '#e5ebf1'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function PartnershipAgreement({ quote, cfg }: { quote: any; cfg?: PartnershipConfig }) {
  const doc = buildPartnershipAgreement(quote, cfg ?? {})
  const r = resolvePartnership(quote, cfg ?? {})
  const resident = r.billingMode === 'resident'
  const dateStr = new Date(quote?.sent_at || quote?.created_at || Date.now()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const paper: React.CSSProperties = { maxWidth: 780, margin: '0 auto', background: '#fff', color: BODY, padding: '48px 56px', fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif', fontSize: 13.5, lineHeight: 1.6 }
  const termCell: React.CSSProperties = { flex: 1, padding: '12px 14px', border: `1px solid ${LINE}`, borderRadius: 10 }

  return (
    <div style={paper}>
      {/* Letterhead — matches the proposal exactly */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `2px solid ${CYAN}`, paddingBottom: 12, marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: NAVY, letterSpacing: '0.02em' }}>GATE<span style={{ color: CYAN }}>GUARD</span></div>
        <div style={{ textAlign: 'right', fontSize: 11.5, color: MUT, lineHeight: 1.5 }}>
          Gate Guard, LLC<br />980 Hammond Drive, Ste. 200 · Atlanta, GA 30328<br />844-4MY-GATE | (770) 776-8095 · rfeldman@gateguard.co
        </div>
      </div>

      <div style={{ fontSize: 11.5, color: MUT, marginBottom: 10 }}>{dateStr}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: NAVY, lineHeight: 1.2 }}>{doc.title}</div>
      <div style={{ fontSize: 13, color: MUT, marginBottom: 14 }}>{doc.subtitle}</div>

      {/* Terms summary strip — the same at-a-glance numbers as the proposal. */}
      <div style={{ display: 'flex', gap: 10, margin: '0 0 24px' }}>
        <div style={termCell}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: CYAN }}>One-time set-up</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: NAVY }}>{money(r.setupFee)}</div>
          <div style={{ fontSize: 10.5, color: MUT }}>{money(r.deposit)} at signing · {money(r.goLive)} at Go-Live</div>
        </div>
        <div style={termCell}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: CYAN }}>Ongoing to property</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: NAVY }}>{resident ? '$0' : money(r.propertyMonthly)}<span style={{ fontSize: 12, color: MUT }}>{resident ? '' : ' /mo'}</span></div>
          <div style={{ fontSize: 10.5, color: MUT }}>{resident ? 'No monthly fee or service calls' : 'Billed in bulk'}</div>
        </div>
        <div style={{ ...termCell, background: NAVY, border: `1px solid ${NAVY}` }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#7fc4ec' }}>{r.residentFeeLabel}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{resident ? money(r.residentFee) : '$0'}</div>
          <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.65)' }}>{resident ? 'Per unit · signing + renewal' : ''}</div>
        </div>
      </div>

      {doc.sections.map((s, i) => {
        const m = s.h.match(/^(\d+)\.\s*(.*)$/)
        const isLead = i === 0 // "What this agreement does, in plain English"
        if (isLead) {
          return (
            <div key={i} style={{ marginBottom: 22, padding: '14px 16px', background: '#f2f7fb', border: `1px solid ${LINE}`, borderRadius: 10 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: CYAN, marginBottom: 6 }}>{s.h}</div>
              <div style={{ whiteSpace: 'pre-line', color: BODY, lineHeight: 1.65 }}>{s.p}</div>
            </div>
          )
        }
        return (
          <div key={i} style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, borderBottom: `1px solid ${LINE}`, paddingBottom: 5 }}>
              {m && <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', background: CYAN, borderRadius: 5, padding: '1px 7px', flexShrink: 0 }}>{m[1]}</span>}
              <span style={{ fontSize: 13.5, fontWeight: 800, color: NAVY, letterSpacing: '0.01em' }}>{m ? m[2] : s.h}</span>
            </div>
            <div style={{ whiteSpace: 'pre-line', color: BODY, lineHeight: 1.65 }}>{s.p}</div>
          </div>
        )
      })}

      {/* Signatures */}
      <div style={{ marginTop: 26, borderTop: `2px solid ${CYAN}`, paddingTop: 18 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: NAVY, marginBottom: 16 }}>Signatures</div>
        <div style={{ display: 'flex', gap: 36 }}>
          {[
            { who: 'GATE GUARD, LLC', name: 'Russel Feldman', org: false },
            { who: 'CUSTOMER', name: '', org: true },
          ].map((c, i) => (
            <div key={i} style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUT }}>{c.who}</div>
              <div style={{ borderBottom: '1px solid #1a2432', height: 30, marginTop: 18 }} />
              <div style={{ fontSize: 9.5, color: MUT, marginTop: 4 }}>Signature</div>
              <div style={{ fontSize: 11.5, color: INK, marginTop: 12, lineHeight: 1.9 }}>Name: {c.name || '____________________'}<br />Title: ____________________<br />{c.org ? <>Organization: ____________________<br /></> : null}Date: ____________________</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default PartnershipAgreement
