'use client'

// Opportunity Life Cycle — glass shell (7 stages). Mock UI, on-vision.
// Vision: docs/nexus/OPPORTUNITY_LIFECYCLE_VISION.md. Wired to real data in AM.
import { useEffect, useState } from 'react'
import { PricingCalculator } from '@/components/nexus/PricingCalculator'

const cyan = '#00C8FF'
const STAGES = ['Survey', 'Financials', 'Proposal', 'Negotiate', 'Contract & Invoice', 'Sign', 'Payment'] as const

// Canonical stage key per lifecycle step (what we PATCH onto opportunities.stage).
const STAGE_KEYS = ['survey', 'financials', 'proposal', 'negotiate', 'contract_invoice', 'sign', 'payment'] as const
// Tolerant map from whatever stage an opp currently has → the right step index.
const STAGE_TO_STEP: Record<string, number> = {
  info_request: 0, survey_request: 0, site_survey: 0, meet_present: 0, survey: 0, new: 0,
  pre_approval: 1, financials: 1, quote: 1,
  proposal: 2, propose: 2, proposal_sent: 2,
  negotiate: 3, negotiation: 3,
  agreement_deposit: 4, contract_invoice: 4, contract: 4,
  agreement_signed: 5, sign: 5, signed: 5,
  deposit_collected: 6, payment: 6, won: 6,
}

const cardStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: 18 } as const
const inputStyle = { background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.92)', borderRadius: 12, padding: '10px 12px', width: '100%' } as const
const btn = { background: 'rgba(0,200,255,0.18)', border: '1px solid rgba(0,200,255,0.45)', color: '#7DE5FF', borderRadius: 12, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' } as const
const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ ...cardStyle, ...style }}>{children}</div>
}
function H({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.95)', marginBottom: 12 }}>{children}</div>
}
function Sub({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>{children}</div>
}

export function OpportunityLifecycle({ opportunityId, onClose, initialStage }: { opportunityId?: string; onClose?: () => void; initialStage?: number } = {}) {
  const [stage, setStage] = useState(initialStage ?? 0)
  const [opp, setOpp] = useState<{ name?: string; account_name?: string; stage?: string } | null>(null)

  // Load the real opportunity (when opened from New / Existing / Lead-convert).
  useEffect(() => {
    if (!opportunityId) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/nexus/opps/opportunity-window/${opportunityId}`)
        const data = await res.json().catch(() => ({}))
        const o = data.opportunity ?? data ?? {}
        if (cancelled) return
        setOpp(o)
        // A shortcut (Site Survey / BOM / SOW / Proposals) sets initialStage → it wins.
        if (initialStage == null && o.stage && STAGE_TO_STEP[o.stage] != null) setStage(STAGE_TO_STEP[o.stage])
      } catch { /* keep defaults */ }
    })()
    return () => { cancelled = true }
  }, [opportunityId])

  // Advance/jump a stage → persist to the opportunity (best-effort; interns refine in #82).
  function goToStage(i: number) {
    setStage(i)
    if (opportunityId) {
      void fetch(`/api/crm/opportunities/${opportunityId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: STAGE_KEYS[i] }),
      }).catch(() => {})
    }
  }

  const dealName = opp?.name || opp?.account_name || 'New opportunity'
  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at top left, #11183a, #050712 50%)', color: 'white', fontFamily: 'Inter, Arial, sans-serif', padding: 24 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {onClose && <button onClick={onClose} style={{ marginBottom: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.8)', borderRadius: 999, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>← Back to Sales</button>}
        <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#7DE5FF' }}>Opportunity · {dealName}{opp?.account_name && opp?.name ? ` · ${opp.account_name}` : ''}</div>
        <h1 style={{ margin: '4px 0 4px', fontSize: 26 }}>Deal life cycle</h1>
        <Sub>Move the deal from survey to signed &amp; paid. One step at a time.</Sub>

        {/* Stepper */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '20px 0 24px' }}>
          {STAGES.map((s, i) => {
            const active = i === stage, done = i < stage
            return (
              <button key={s} onClick={() => goToStage(i)} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 14, cursor: 'pointer',
                background: active ? 'rgba(0,200,255,0.18)' : done ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${active ? 'rgba(0,200,255,0.5)' : done ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.1)'}`,
                color: active ? '#7DE5FF' : done ? '#6ee7b7' : 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 600,
              }}>
                <span style={{ width: 20, height: 20, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, background: 'rgba(0,0,0,0.3)' }}>{done ? '✓' : i + 1}</span>
                {s}
              </button>
            )
          })}
        </div>

        {stage === 0 && <Survey />}
        {stage === 1 && <Financials />}
        {stage === 2 && <Proposal />}
        {stage === 3 && <Negotiate />}
        {stage === 4 && <ContractInvoice />}
        {stage === 5 && <Sign />}
        {stage === 6 && <Payment />}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
          <button onClick={() => goToStage(Math.max(0, stage - 1))} disabled={stage === 0} style={{ ...btn, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', opacity: stage === 0 ? 0.4 : 1 }}>← Back</button>
          <button onClick={() => stage === STAGES.length - 1 ? onClose?.() : goToStage(Math.min(STAGES.length - 1, stage + 1))} style={btn}>{stage === STAGES.length - 1 ? 'Done' : `Next: ${STAGES[stage + 1]} →`}</button>
        </div>
      </div>
    </div>
  )
}

function Survey() {
  const questions = ['How many gates / entry points?', 'How many living units?', 'How many common-area doors?', 'Camera coverage needed?', 'Smart locks on units?']
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
      <Card style={{ gridColumn: '1 / -1', background: 'radial-gradient(circle at 12% 0%, rgba(139,92,246,0.16), transparent 40%), rgba(255,255,255,0.04)', border: '1px solid rgba(139,92,246,0.3)' }}>
        <H>🎙️ Audio walkthrough</H>
        <Sub>Walk the property and talk it through — Nexus turns the recording into your survey, SOW, and BOM automatically.</Sub>
        <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
          <button style={{ ...btn, background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.5)', color: '#c4b5fd', borderRadius: 999, padding: '12px 20px' }}>● Record walkthrough</button>
          <Sub>or answer the quick questions →</Sub>
        </div>
      </Card>
      <Card>
        <H>Quick survey</H>
        <div style={{ display: 'grid', gap: 12 }}>
          {questions.map(q => <label key={q} style={{ display: 'block' }}><div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>{q}</div><input style={inputStyle} placeholder="…" /></label>)}
        </div>
      </Card>
      <Card>
        <H>Generated SOW + BOM</H>
        <Sub>Scope of work</Sub>
        <ul style={{ margin: '6px 0 14px', paddingLeft: 18, fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
          <li>Install gate access at 2 entry points</li><li>Common-door access control</li><li>Camera coverage at amenities</li>
        </ul>
        <Sub>Bill of materials</Sub>
        <div style={{ marginTop: 6, fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
          <div>Brivo 2-Door Controller × 2</div><div>Eagle Eye 4MP Camera × 4</div><div>Talk-Down Speaker × 1</div>
        </div>
      </Card>
    </div>
  )
}

function Financials() {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card style={{ background: 'rgba(255,255,255,0.03)' }}>
        <H>Pricing &amp; profitability</H>
        <Sub>Built from the BOM. The calculator below feeds the deal — install cost + IRR keep the dealer profitable.</Sub>
      </Card>
      <PricingCalculator />
      <Card style={{ background: 'linear-gradient(180deg, rgba(52,211,153,0.1), rgba(8,18,34,0.6))', border: '1px solid rgba(52,211,153,0.3)' }}>
        <H>Install &amp; lifetime profitability (IRR)</H>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 12 }}>
          {[['Install cost (BOM + labor)', '$8,400'], ['Upfront margin', '$3,900'], ['Monthly net (recurring)', '$1,000'], ['Deal IRR (24 mo)', '38%']].map(([k, v]) => (
            <div key={k}><div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{k}</div><div style={{ fontSize: 22, fontWeight: 700, color: '#6ee7b7' }}>{v}</div></div>
          ))}
        </div>
        <Sub>Mock — wired to real BOM cost + recurring model in AM.</Sub>
      </Card>
    </div>
  )
}

function Proposal() {
  const addons = [
    { id: 'mon', name: 'Camera monitoring', price: 300 },
    { id: 'locks', name: 'Smart locks on units', price: 425 },
    { id: 'talk', name: 'Talk-down at gate', price: 95 },
  ]
  const [on, setOn] = useState<Record<string, boolean>>({})
  const base = 1250
  const total = base + addons.filter(a => on[a.id]).reduce((s, a) => s + a.price, 0)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: 16 }}>
      <Card style={{ gridColumn: '1 / -1', background: 'radial-gradient(circle at 50% 0%, rgba(0,124,255,0.2), transparent 50%), rgba(255,255,255,0.04)', textAlign: 'center', padding: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#7DE5FF' }}>Proposal · prepared for</div>
        <h2 style={{ margin: '6px 0', fontSize: 28 }}>The Stratford</h2>
        <Sub>A modern access &amp; security upgrade — interactive, add what you want.</Sub>
      </Card>
      <Card>
        <H>What's included</H>
        <ul style={{ paddingLeft: 18, fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.8 }}>
          <li>Gate access at 2 entry points</li><li>Common-door access control</li><li>500 resident mobile passes</li><li>4 amenity cameras</li>
        </ul>
        <div style={{ marginTop: 12, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Base service</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#7DE5FF' }}>{usd(base)}/mo</div>
      </Card>
      <Card>
        <H>Add to your plan</H>
        <Sub>Tap to add — your total updates live.</Sub>
        <div style={{ display: 'grid', gap: 10, margin: '12px 0' }}>
          {addons.map(a => (
            <button key={a.id} onClick={() => setOn(o => ({ ...o, [a.id]: !o[a.id] }))} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: 14, cursor: 'pointer', textAlign: 'left',
              background: on[a.id] ? 'rgba(52,211,153,0.14)' : 'rgba(0,0,0,0.2)', border: `1px solid ${on[a.id] ? 'rgba(52,211,153,0.45)' : 'rgba(255,255,255,0.1)'}`, color: 'white',
            }}>
              <span><span style={{ marginRight: 8 }}>{on[a.id] ? '✓' : '+'}</span>{a.name}</span>
              <b>{usd(a.price)}/mo</b>
            </button>
          ))}
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>Your total</span>
          <span style={{ fontSize: 26, fontWeight: 800, color: '#6ee7b7' }}>{usd(total)}/mo</span>
        </div>
        <button style={{ ...btn, width: '100%', marginTop: 12, padding: '12px' }}>Accept proposal</button>
      </Card>
    </div>
  )
}

function Negotiate() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: 16 }}>
      <Card>
        <H>🤖 Negotiation coach</H>
        <Sub>Ask for advice — the coach keeps you inside profitable margins (tied to the IRR model).</Sub>
        <div style={{ display: 'grid', gap: 10, margin: '14px 0' }}>
          <div style={{ alignSelf: 'flex-start', maxWidth: '85%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 12, padding: '10px 12px', fontSize: 13 }}>Customer says $1,250/mo is too high. What can I do?</div>
          <div style={{ alignSelf: 'flex-end', maxWidth: '85%', background: 'rgba(0,124,255,0.18)', border: '1px solid rgba(0,124,255,0.4)', borderRadius: 12, padding: '10px 12px', fontSize: 13 }}>Offer 1 month free monitoring instead of cutting the rate — keeps your recurring margin and IRR above target. Holding the monthly protects 24-mo profit.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 12px', color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>Ask the coach…<span style={{ marginLeft: 'auto', ...btn, padding: '6px 12px' }}>Send</span></div>
      </Card>
      <Card>
        <H>Suggested moves</H>
        {[['1 month free monitoring', 'Margin impact −$300 · still 34% IRR ✅'], ['Waive install fee', 'Margin impact −$1,200 · IRR 21% ⚠️'], ['Drop to $1,150/mo', 'Below target margin ❌ — not recommended']].map(([m, impact]) => (
          <div key={m} style={{ marginBottom: 10, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{m}</div><Sub>{impact}</Sub>
          </div>
        ))}
      </Card>
    </div>
  )
}

function ContractInvoice() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: 16 }}>
      <Card>
        <H>Contract</H>
        <Sub>Generated from the accepted proposal + agreement template.</Sub>
        <div style={{ marginTop: 12, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 14, fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.7 }}>
          Service & Install Agreement — The Stratford<br />Monthly: $1,250 · Term: 36 months<br />Install: $8,400 · Deposit: 50% ($4,200)
        </div>
        <button style={{ ...btn, marginTop: 12 }}>Generate contract</button>
      </Card>
      <Card>
        <H>Deposit invoice</H>
        <Sub>Collect the deposit to lock the install.</Sub>
        <div style={{ fontSize: 30, fontWeight: 800, color: '#7DE5FF', margin: '12px 0' }}>{usd(4200)}</div>
        <Sub>50% of $8,400 install</Sub>
        <button style={{ ...btn, marginTop: 12 }}>Send deposit invoice (Stripe)</button>
      </Card>
    </div>
  )
}

function Sign() {
  return (
    <Card style={{ maxWidth: 560, margin: '0 auto' }}>
      <H>Sign the agreement</H>
      <Sub>Customer signs online — e-signature, IP captured, fully executed copy stored.</Sub>
      <div style={{ marginTop: 14, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 18, minHeight: 120, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
        Service &amp; Install Agreement — The Stratford …
      </div>
      <div style={{ marginTop: 14, borderBottom: '1px dashed rgba(255,255,255,0.3)', paddingBottom: 6, fontStyle: 'italic', color: 'rgba(255,255,255,0.4)' }}>Sign here</div>
      <button style={{ ...btn, marginTop: 16, width: '100%', padding: 12 }}>Send for signature</button>
    </Card>
  )
}

function Payment() {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card style={{ background: 'linear-gradient(180deg, rgba(52,211,153,0.1), rgba(8,18,34,0.6))', border: '1px solid rgba(52,211,153,0.3)' }}>
        <H>Deposit payment</H>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: '#6ee7b7' }}>{usd(4200)}</div>
          <span style={{ padding: '6px 12px', borderRadius: 999, background: 'rgba(251,191,36,0.16)', border: '1px solid rgba(251,191,36,0.4)', color: '#fde68a', fontSize: 12 }}>Awaiting payment</span>
        </div>
        <Sub>When the contract is signed AND the deposit is paid, the deal converts automatically.</Sub>
      </Card>
      <Card>
        <H>Auto-handover on signed + paid</H>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 12 }}>
          <div style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.3)', borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#7DE5FF' }}>→ Customer created</div><Sub>The Stratford becomes an active customer account.</Sub>
          </div>
          <div style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6ee7b7' }}>→ Active Job created</div><Sub>Install job opens with the BOM, schedule, and deposit linked.</Sub>
          </div>
        </div>
      </Card>
    </div>
  )
}
