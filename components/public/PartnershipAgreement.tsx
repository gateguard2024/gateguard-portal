'use client'

/**
 * PartnershipAgreement — client-facing service agreement, generated from the same
 * partnership config as the proposal so the two always match. Clean, print-ready.
 */
import { buildPartnershipAgreement } from '@/lib/partnership-agreement'
import type { PartnershipConfig } from '@/lib/partnership-proposal'

const NAVY = '#12233b'; const INK = '#1a2432'; const MUT = '#5a6c84'; const CYAN = '#2f7fb8'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function PartnershipAgreement({ quote, cfg }: { quote: any; cfg?: PartnershipConfig }) {
  const doc = buildPartnershipAgreement(quote, cfg ?? {})
  const paper: React.CSSProperties = { maxWidth: 780, margin: '0 auto', background: '#fff', color: INK, padding: '40px 48px', fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif', fontSize: 12.5, lineHeight: 1.5 }

  return (
    <div style={paper}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `2px solid ${CYAN}`, paddingBottom: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: NAVY }}>GATE<span style={{ color: CYAN }}>GUARD</span></div>
        <div style={{ textAlign: 'right', fontSize: 10.5, color: MUT, lineHeight: 1.45 }}>Gate Guard, LLC · 980 Hammond Drive, Ste. 200 · Atlanta, GA 30328<br />844-4MY-GATE | (770) 776-8095 · gateguard.co</div>
      </div>

      <div style={{ fontSize: 18, fontWeight: 800, color: NAVY, lineHeight: 1.2 }}>{doc.title}</div>
      <div style={{ fontSize: 12, color: MUT, marginBottom: 12 }}>{doc.subtitle}</div>

      {doc.sections.map((s, i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: CYAN, marginBottom: 3 }}>{s.h}</div>
          <div style={{ whiteSpace: 'pre-line', color: INK }}>{s.p}</div>
        </div>
      ))}

      {/* Signatures */}
      <div style={{ marginTop: 18, borderTop: '1px solid #d8e1ea', paddingTop: 14 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: CYAN, marginBottom: 12 }}>Signatures</div>
        <div style={{ display: 'flex', gap: 28 }}>
          {[
            { who: 'GATE GUARD, LLC', name: 'Russel Feldman', org: false },
            { who: 'CUSTOMER', name: '', org: true },
          ].map((c, i) => (
            <div key={i} style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: INK }}>{c.who}</div>
              <div style={{ borderBottom: '1px solid #1a2432', height: 26, marginTop: 16 }} />
              <div style={{ fontSize: 9.5, color: MUT, marginTop: 3 }}>Signature</div>
              <div style={{ fontSize: 11, color: INK, marginTop: 10 }}>Name: {c.name || '____________________'}<br />Title: ____________________<br />{c.org ? 'Organization: ____________________\n' : ''}Date: ____________________</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default PartnershipAgreement
