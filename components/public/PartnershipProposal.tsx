'use client'

/**
 * PartnershipProposal — the client-facing GateGuard Property Partnership letter.
 * Renders the exact format we send (Birch Landing / Laurel Hill), driven by the
 * quote + its partnership config. Supports two billing modes:
 *   resident         — property $0/mo; residents pay the parking & amenity fee
 *   property_monthly — the property pays those fees in bulk each month; no resident billing
 * Clean, print-ready letter (white paper) so screen view and PDF match.
 */
import { resolvePartnership, money, type PartnershipConfig } from '@/lib/partnership-proposal'

const NAVY = '#12233b'
const INK = '#1a2432'
const MUT = '#5a6c84'
const CYAN = '#2f7fb8'
const GREEN = '#12855f'

function Check({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'baseline' }}>
      <span style={{ color: GREEN, fontWeight: 700, flexShrink: 0 }}>✓</span>
      <span style={{ color: INK, lineHeight: 1.5 }}>{children}</span>
    </div>
  )
}
function H({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', color: CYAN, textTransform: 'uppercase', margin: '22px 0 10px' }}>{children}</div>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function PartnershipProposal({ quote, cfg }: { quote: any; cfg?: PartnershipConfig }) {
  const r = resolvePartnership(quote, cfg ?? {})
  const dateStr = new Date(quote?.sent_at || quote?.created_at || Date.now()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const resident = r.billingMode === 'resident'

  const paper: React.CSSProperties = { maxWidth: 780, margin: '0 auto', background: '#fff', color: INK, padding: '40px 48px', fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif', fontSize: 14, lineHeight: 1.55 }
  const termCell: React.CSSProperties = { flex: 1, padding: '12px 14px' }

  return (
    <div style={paper}>
      {/* Letterhead */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `2px solid ${CYAN}`, paddingBottom: 12, marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: NAVY, letterSpacing: '0.02em' }}>GATE<span style={{ color: CYAN }}>GUARD</span></div>
        <div style={{ textAlign: 'right', fontSize: 11.5, color: MUT, lineHeight: 1.5 }}>
          Gate Guard, LLC<br />980 Hammond Drive, Ste. 200 · Atlanta, GA 30328<br />844-4MY-GATE | (770) 776-8095 · rfeldman@gateguard.co
        </div>
      </div>

      <div style={{ fontSize: 12.5, color: MUT, marginBottom: 14 }}>{dateStr}</div>
      <div style={{ fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
        {r.contactName && <><b>{r.contactName}</b>{r.contactTitle ? `, ${r.contactTitle}` : ''}<br /></>}
        {r.property}{r.managementCo ? ` — ${r.managementCo}` : ''}<br />
        {r.address}
      </div>

      <div style={{ fontWeight: 800, color: INK, fontSize: 14 }}>RE: Proposal — GateGuard Property Partnership Program</div>
      <div style={{ fontSize: 12.5, color: MUT, marginBottom: 16 }}>Gate, access control, and resident technology management for {r.property}</div>

      <p style={{ margin: '0 0 12px' }}>Dear {r.contactFirst},</p>
      <p style={{ margin: '0 0 12px' }}>Thank you for your time reviewing the GateGuard program. This letter sets out our proposal to take over the gates, access control, and supporting technology at {r.property} under our Property Partnership model.</p>
      <p style={{ margin: '0 0 12px' }}>
        The structure is straightforward, and it is different from every gate quote you have received before. The property pays a single, one-time set-up fee of <b>{money(r.setupFee)}</b>{r.setupNote ? ` — ${r.setupNote}` : ''}, half at signing and half at Go-Live.{' '}
        {resident
          ? 'After that, GateGuard does not invoice the property again. The ongoing program is funded by residents through a parking and amenity fee that we bill and collect directly at each lease signing and renewal — never through your office.'
          : `After that, the property covers the parking and amenity program at a flat ${money(r.propertyMonthly)} per month, billed in bulk — so your residents are never billed individually.`}
      </p>

      {/* THE TERMS */}
      <H>The terms</H>
      <div style={{ display: 'flex', border: `1px solid #d8e1ea`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={termCell}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: CYAN, textTransform: 'uppercase' }}>One-time set-up fee</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: NAVY }}>{money(r.setupFee)}</div>
          <div style={{ fontSize: 11, color: MUT }}>{money(r.deposit)} at signing, {money(r.goLive)} at Go-Live.</div>
        </div>
        <div style={{ ...termCell, borderLeft: '1px solid #eef2f6' }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: CYAN, textTransform: 'uppercase' }}>Ongoing cost to property</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: NAVY }}>{resident ? '$0' : `${money(r.propertyMonthly)}`}<span style={{ fontSize: 12, color: MUT }}>{resident ? '' : ' /mo'}</span></div>
          <div style={{ fontSize: 11, color: MUT }}>{resident ? 'No monthly fee, no service calls, no parts or labor billing.' : 'Bulk parking & amenity fees, billed to the property monthly.'}</div>
        </div>
        <div style={{ ...termCell, borderLeft: '1px solid #eef2f6' }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: CYAN, textTransform: 'uppercase' }}>Resident fee — billed by us</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: NAVY }}>{resident ? money(r.residentFee) : '$0'}</div>
          <div style={{ fontSize: 11, color: MUT }}>{resident ? 'Per unit at each lease signing and renewal, covering a 12-month parking and amenity term.' : 'Residents are not billed — the property covers the fees in bulk.'}</div>
        </div>
      </div>

      {/* SCOPE */}
      <H>Scope at {r.property}</H>
      <div style={{ display: 'flex', textAlign: 'center', border: '1px solid #d8e1ea', borderRadius: 10, background: '#f6f9fc' }}>
        {[
          { num: r.gates, label: `vehicle gates`, sub: r.gateNote },
          { num: r.amenityDoors, label: 'amenity doors', sub: '' },
          { num: r.cameras, label: 'monitored cameras', sub: r.cameraNote },
          { num: r.units, label: 'residential units', sub: '' },
        ].map((c, i) => (
          <div key={i} style={{ flex: 1, padding: '12px 8px', borderLeft: i ? '1px solid #e5ebf1' : 'none' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: NAVY }}>{c.num}</div>
            <div style={{ fontSize: 11.5, color: MUT }}>{c.label}</div>
            {c.sub ? <div style={{ fontSize: 10.5, color: '#8494a6' }}>{c.sub}</div> : null}
          </div>
        ))}
      </div>

      <H>What GateGuard delivers</H>
      <Check>All {r.accessPoints} access points brought online and kept that way — parts, welding, and operator repair at install, included in the set-up fee with no change orders.</Check>
      <Check>Every repair for the full term. Parts, labor, and trip charges on the operators, controls, and electronics, plus monthly preventative maintenance — however many times service is required.</Check>
      <Check>Proactive monitoring and remote reset. We watch gate health around the clock and clear most faults remotely, so your maintenance team is not dispatched every time a gate is bumped.</Check>
      <Check>Mobile access with PMS integration. Residents enter by phone — no fobs or cards to issue, buy, or replace. Move-ins and move-outs sync with Yardi, Entrata, or RealPage.</Check>
      <Check>{r.cameras} monitored cameras{r.cameraNote ? ` — ${r.cameraNote}` : ''}. Monitored, not merely recorded. When a gate is struck we make the footage available so the damage can be attributed to the driver and pursued as a chargeback.</Check>
      <Check>Resident support. Access questions, credentials, and troubleshooting are handled by GateGuard directly, so your leasing office is not the help desk.</Check>

      <H>What the property stops paying</H>
      <Check>Gate repair invoices and emergency capital requests — commonly $10,000 to $40,000 annually</Check>
      <Check>Callbox telephone line and service fees, where applicable</Check>
      <Check>Fobs, access cards, and clickers, including every replacement</Check>
      <Check>Separate camera monitoring contracts</Check>
      <Check>Staff hours spent adding and removing residents from the access system</Check>

      <H>The one thing not covered</H>
      <p style={{ margin: '0 0 8px' }}>GateGuard covers everything at each opening except the physical gate itself — the steel panel, frame, posts, hinges, and welds. That coverage is available below. Everything that operates the gate — motors, operators, controllers, readers, callboxes, cameras — is covered.</p>

      <H>Optional add-ons</H>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: '#f2f6fb', color: MUT, textAlign: 'left' }}>
            <th style={{ padding: '6px 10px', fontWeight: 700 }}>Optional add-on</th>
            <th style={{ padding: '6px 10px', fontWeight: 700 }}>Qty</th>
            <th style={{ padding: '6px 10px', fontWeight: 700 }}>Price</th>
            <th style={{ padding: '6px 10px', fontWeight: 700, textAlign: 'right' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderTop: '1px solid #e5ebf1' }}>
            <td style={{ padding: '6px 10px' }}>Physical gate &amp; hinge coverage — the steel panel, frame, posts, hinges, and welds</td>
            <td style={{ padding: '6px 10px' }}>{r.gates} gates</td>
            <td style={{ padding: '6px 10px' }}>{money(r.addonGateRate)} / gate / mo</td>
            <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700 }}>{money(r.addonGateTotal)} / mo</td>
          </tr>
          <tr style={{ borderTop: '1px solid #e5ebf1' }}>
            <td style={{ padding: '6px 10px' }}>Additional monitored cameras beyond the {r.cameras} included</td>
            <td style={{ padding: '6px 10px' }}>as elected</td>
            <td style={{ padding: '6px 10px' }}>{money(r.addonCameraRate)} / camera / mo</td>
            <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700 }}>{money(r.addonCameraRate)} / mo ea</td>
          </tr>
        </tbody>
      </table>
      <div style={{ fontSize: 11.5, color: MUT, marginTop: 6 }}>Neither is required. The set-up fee and ongoing terms above are unchanged either way.</div>

      <H>Term and what we need from you</H>
      <Check>{r.termYears}-year term. The initial term runs {r.termMonths} months from the Go-Live Date, then renews for one-year terms unless either party gives 60 days’ written notice.</Check>
      <Check>Power and internet at each access point. The property provides and maintains these; everything else at the opening is ours.</Check>
      <Check>Unit count. Pricing is based on {r.units} units. If that changes by more than 5%, either party may request a good-faith adjustment at the same per-unit basis.</Check>
      <Check>Resident services. GateGuard reserves the right to offer residents optional television and streaming, internet, home security, and video doorbell service — billed and supported by us, never touching the property’s budget or leasing office.</Check>

      <p style={{ margin: '14px 0 12px' }}><b>Why we structure it this way.</b> Traditional vendors are paid when your gate breaks. We are paid whether it breaks or not, so our incentive is to keep it running rather than to return and repair it again. We are taking responsibility for your asset and serving your residents directly.</p>

      <H>Next steps</H>
      <Check>Execute this proposal and the accompanying service agreement</Check>
      <Check>Pay the {money(r.deposit)} deposit; the balance is due at Go-Live</Check>
      <Check>Site survey to document the gates, access points, and existing equipment</Check>
      <Check>Installation, system commissioning, and PMS integration</Check>
      <Check>Resident onboarding and program launch</Check>

      <p style={{ margin: '14px 0 12px' }}>This proposal is valid for {r.validDays} days. I am glad to walk it through with your regional or ownership group, and to build a savings model showing what {r.property} is spending today against what this program eliminates.</p>
      <p style={{ margin: '0 0 4px' }}>Respectfully,</p>
      <p style={{ margin: 0, fontSize: 13 }}><b>{r.preparedBy}</b><br /><span style={{ color: MUT, fontSize: 12 }}>Gate Guard, LLC · (770) 776-8095 · rfeldman@gateguard.co</span></p>

      {/* Acceptance */}
      <div style={{ marginTop: 24, padding: 16, border: '1px solid #d8e1ea', borderRadius: 10, background: '#f8fafc' }}>
        <div style={{ fontWeight: 800, color: INK, marginBottom: 4 }}>Acceptance</div>
        <div style={{ fontSize: 12, color: MUT, marginBottom: 20 }}>
          By signing below, {r.property} accepts these terms, including the {r.termYears}-year term, and authorizes GateGuard to proceed. Add-ons apply only if initialed: ____ gate &amp; hinge coverage&nbsp;&nbsp;&nbsp;____ additional cameras.
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          {['Authorized signature', 'Printed name & title', 'Date'].map((l, i) => (
            <div key={i} style={{ flex: l === 'Date' ? 0.6 : 1 }}>
              <div style={{ borderBottom: '1px solid #1a2432', height: 26 }} />
              <div style={{ fontSize: 9.5, fontWeight: 700, color: MUT, textTransform: 'uppercase', marginTop: 3 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default PartnershipProposal
