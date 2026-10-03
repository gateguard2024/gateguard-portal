'use client'

/**
 * PartnershipAgreement — client-facing service agreement, generated from the same
 * partnership config as the proposal so the two always match. Clean, print-ready.
 */
import { buildPartnershipAgreement } from '@/lib/partnership-agreement'
import type { PartnershipConfig } from '@/lib/partnership-proposal'

const NAVY = '#12233b'; const INK = '#1a2432'; const BODY = '#27364a'; const MUT = '#5a6c84'; const CYAN = '#2f7fb8'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function PartnershipAgreement({ quote, cfg }: { quote: any; cfg?: PartnershipConfig }) {
  const doc = buildPartnershipAgreement(quote, cfg ?? {})
  const dateStr = new Date(quote?.sent_at || quote?.created_at || Date.now()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const paper: React.CSSProperties = { maxWidth: 780, margin: '0 auto', background: '#fff', color: BODY, padding: '48px 56px', fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif', fontSize: 13.5, lineHeight: 1.6 }

  // The plain-English preamble reads as a lead paragraph; the numbered sections
  // read as the legal body. Both get the same roomy treatment as the proposal.
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
      <div style={{ fontSize: 20, fontWeight: 800, color: NAVY, lineHeight: 1.25 }}>{doc.title}</div>
      <div style={{ fontSize: 13, color: MUT, marginBottom: 6 }}>{doc.subtitle}</div>
      <div style={{ borderBottom: '1px solid #e5ebf1', margin: '10px 0 22px' }} />

      {doc.sections.map((s, i) => (
        <div key={i} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: NAVY, letterSpacing: '0.01em', marginBottom: 6 }}>{s.h}</div>
          <div style={{ whiteSpace: 'pre-line', color: BODY, lineHeight: 1.65 }}>{s.p}</div>
        </div>
      ))}

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
