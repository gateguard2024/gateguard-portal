'use client'

/**
 * /sign/[token] — Public document signing page
 * No Clerk auth required. Token is the credential.
 */

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

const DOC_LABELS: Record<string, string> = {
  nda:                        'Mutual Non-Disclosure Agreement',
  master_agent_agreement:     'Master Agent Agreement',
  dealer_agreement:           'Authorized Dealer Agreement',
  service_agreement:          'Service Agreement',
  install_partner_agreement:  'Installation Partner Agreement',
  sales_partner_agreement:    'Sales Partner Agreement',
}

interface SigRecord {
  id: string
  document_type: string
  document_version: string | null
  document_url: string | null
  document_html: string | null
  signer_name: string | null
  signer_email: string
  signer_title: string | null
  signer_company: string | null
  signed_name?: string | null
  signed_title?: string | null
  signed_at?: string | null
  countersigned_name?: string | null
  countersigned_title?: string | null
  countersigned_at?: string | null
  executed_at?: string | null
  executed_cert_url?: string | null
  sent_by_name: string | null
  expires_at: string
  status: string
}

type PageState = 'loading' | 'ready' | 'already_signed' | 'error' | 'submitting' | 'done'

export default function SignPage() {
  const { token } = useParams<{ token: string }>()

  const [pageState, setPageState] = useState<PageState>('loading')
  const [sig,       setSig]       = useState<SigRecord | null>(null)
  const [errorMsg,  setErrorMsg]  = useState('')

  const [signedName,  setSignedName]  = useState('')
  const [signedTitle, setSignedTitle] = useState('')
  const [agreed,      setAgreed]      = useState(false)

  useEffect(() => {
    fetch(`/api/signatures/${token}`)
      .then(async r => {
        const json = await r.json()
        if (r.status === 409 && json.error === 'already_signed') {
          setSig(json.sig)
          setPageState('already_signed')
        } else if (!r.ok) {
          setErrorMsg(json.error ?? 'This signing link is invalid or has expired.')
          setPageState('error')
        } else {
          setSig(json.sig)
          setSignedName(json.sig.signer_name ?? '')
          setSignedTitle(json.sig.signer_title ?? '')
          setPageState('ready')
        }
      })
      .catch(() => {
        setErrorMsg('Unable to load document. Please try again.')
        setPageState('error')
      })
  }, [token])

  async function handleSign() {
    if (!agreed || !signedName.trim()) return
    setPageState('submitting')
    try {
      const r = await fetch(`/api/signatures/${token}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signed_name: signedName, signed_title: signedTitle }),
      })
      const json = await r.json()
      if (!r.ok) {
        setErrorMsg(json.error ?? 'Signing failed. Please try again.')
        setPageState('ready')
      } else {
        setPageState('done')
      }
    } catch {
      setErrorMsg('Network error. Please try again.')
      setPageState('ready')
    }
  }

  const docLabel = sig ? (DOC_LABELS[sig.document_type] ?? sig.document_type) : ''
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const partnerName = sig?.signer_company || sig?.signer_name || sig?.signer_email || 'Partner'
  const isFullyExecuted = sig?.status === 'fully_executed' || !!sig?.executed_at

  if (pageState === 'loading') {
    return (
      <Screen>
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.68)', padding: '56px 0' }}>
          <div style={{ width: 44, height: 44, border: '3px solid rgba(0,200,255,0.16)', borderTopColor: '#00C8FF', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Loading document…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </Screen>
    )
  }

  if (pageState === 'error') {
    return (
      <Screen>
        <div style={{ textAlign: 'center', padding: '56px 0' }}>
          <StatusOrb tone="error">✕</StatusOrb>
          <h2 style={doneTitle}>Link Unavailable</h2>
          <p style={doneCopy}>{errorMsg}</p>
          <SupportLine />
        </div>
      </Screen>
    )
  }

  if (pageState === 'already_signed') {
    return (
      <Screen>
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <StatusOrb tone="success">✓</StatusOrb>
          <h2 style={doneTitle}>{isFullyExecuted ? 'Document Fully Executed' : 'Document Already Signed'}</h2>
          <p style={doneCopy}>
            {isFullyExecuted
              ? `The ${docLabel} has been signed by both parties.`
              : `The ${docLabel} has already been signed. GateGuard will countersign next.`}
          </p>
          <div style={summaryBox}>
            <Row label="Document" value={docLabel} />
            <Row label="Partner" value={partnerName} />
            {sig?.signed_name && <Row label="Signed by" value={sig.signed_name} />}
            {sig?.countersigned_name && <Row label="GateGuard" value={sig.countersigned_name} />}
          </div>
          {sig?.executed_cert_url && <FinalCopyLink href={sig.executed_cert_url} />}
          <SupportLine />
        </div>
      </Screen>
    )
  }

  if (pageState === 'done') {
    return (
      <Screen>
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <StatusOrb tone="success">✓</StatusOrb>
          <h2 style={doneTitle}>Document Signed</h2>
          <p style={{ ...doneCopy, marginBottom: 4 }}>Thank you, <strong style={{ color: '#F8FAFC' }}>{signedName}</strong>.</p>
          <p style={doneCopy}>Your signature on the <strong style={{ color: '#CBD5E1' }}>{docLabel}</strong> has been recorded. GateGuard will countersign next.</p>
          <div style={summaryBox}>
            <Row label="Document" value={docLabel} />
            <Row label="Signed by" value={signedName} />
            {signedTitle && <Row label="Title" value={signedTitle} />}
            <Row label="Date" value={today} />
          </div>
          <p style={{ margin: '28px 0 0', color: 'rgba(255,255,255,0.52)', fontSize: 12, lineHeight: 1.6 }}>
            A final copy will be emailed and saved after GateGuard countersigns.
          </p>
          <SupportLine />
        </div>
      </Screen>
    )
  }

  return (
    <Screen>
      <div style={{ borderBottom: '1px solid rgba(0,200,255,0.16)', paddingBottom: 24, marginBottom: 26 }}>
        <p style={kicker}>Document for Signature</p>
        <h1 style={{ margin: '0 0 8px', color: '#F8FAFC', fontSize: 26, lineHeight: 1.14, fontWeight: 800 }}>{docLabel}</h1>
        <p style={{ margin: 0, color: 'rgba(255,255,255,0.64)', fontSize: 14, lineHeight: 1.5 }}>Prepared for <strong style={{ color: 'rgba(255,255,255,0.9)' }}>{partnerName}</strong></p>
        {sig?.document_version && <span style={versionPill}>{sig.document_version}</span>}
      </div>

      <div style={summaryBox}>
        <Row label="Sent by" value={sig?.sent_by_name ? `${sig.sent_by_name} · GateGuard` : 'GateGuard'} />
        <Row label="Recipient" value={sig?.signer_email ?? ''} />
        <Row label="Partner" value={partnerName} />
        <Row label="Expires" value={sig ? new Date(sig.expires_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''} />
      </div>

      {sig?.document_html && (
        <div style={{ marginBottom: 28 }}>
          <p style={sectionLabel}>Review Document</p>
          <div style={documentBox}>{sig.document_html}</div>
        </div>
      )}

      {!sig?.document_html && sig?.document_url && (
        <div style={{ marginBottom: 28 }}>
          <p style={sectionLabel}>Review Document</p>
          <a href={sig.document_url} target="_blank" rel="noopener noreferrer" style={documentLink}>
            <span>📄</span>
            <span>Review Document</span>
            <span style={{ color: '#94A3B8', fontSize: 11 }}>↗</span>
          </a>
        </div>
      )}

      {!sig?.document_url && !sig?.document_html && (
        <div style={{ marginBottom: 24, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: '14px 18px' }}>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.68)', fontSize: 13 }}>
            The document text will be provided separately. Please contact <a href="mailto:rfeldman@gateguard.co" style={{ color: '#7dd3fc' }}>rfeldman@gateguard.co</a> if you have not received it.
          </p>
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 18px', color: '#F8FAFC', fontSize: 18, fontWeight: 700 }}>Sign Document</h2>
        <Field label="Full Legal Name *"><input type="text" value={signedName} onChange={e => setSignedName(e.target.value)} placeholder="Your full name" style={inputStyle} /></Field>
        <Field label="Title / Role"><input type="text" value={signedTitle} onChange={e => setSignedTitle(e.target.value)} placeholder="e.g. CEO, Owner, Director" style={inputStyle} /></Field>
        {signedName.trim() && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ margin: '0 0 6px', color: 'rgba(255,255,255,0.58)', fontSize: 12 }}>Your signature will appear as:</p>
            <div style={{ background: 'rgba(3,9,22,0.54)', border: '1px solid rgba(0,200,255,0.16)', borderRadius: 14, padding: '16px 20px' }}>
              <p style={{ margin: '0 0 4px', color: '#F8FAFC', fontFamily: 'Georgia, serif', fontSize: 26, fontStyle: 'italic' }}>{signedName}</p>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.50)', fontSize: 12 }}>{today} · Electronic Signature</p>
            </div>
          </div>
        )}
        <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer', marginBottom: 24 }}>
          <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ width: 18, height: 18, marginTop: 2, accentColor: '#00C8FF', cursor: 'pointer', flexShrink: 0 }} />
          <span style={{ color: 'rgba(255,255,255,0.68)', fontSize: 13, lineHeight: 1.55 }}>By checking this box, I confirm that I have read and agree to the terms of the <strong style={{ color: '#F8FAFC' }}>{docLabel}</strong> and I consent to signing this document electronically. I understand this constitutes a legally binding electronic signature.</span>
        </label>
        {errorMsg && <p style={{ margin: '0 0 16px', color: '#fecaca', fontSize: 13, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.28)', borderRadius: 10, padding: '9px 12px' }}>{errorMsg}</p>}
        <button onClick={handleSign} disabled={!agreed || !signedName.trim() || pageState === 'submitting'} style={{ width: '100%', background: agreed && signedName.trim() ? 'linear-gradient(135deg, #00C8FF, #007CFF)' : 'rgba(255,255,255,0.07)', color: agreed && signedName.trim() ? 'white' : 'rgba(255,255,255,0.42)', border: agreed && signedName.trim() ? '1px solid rgba(0,200,255,0.36)' : '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: '14px 24px', fontSize: 15, fontWeight: 700, cursor: agreed && signedName.trim() ? 'pointer' : 'not-allowed', boxShadow: agreed && signedName.trim() ? '0 0 24px rgba(0,124,255,0.22)' : 'none' }}>
          {pageState === 'submitting' ? 'Signing…' : `Sign ${docLabel} →`}
        </button>
      </div>
      <p style={{ margin: 0, color: 'rgba(255,255,255,0.40)', fontSize: 11, textAlign: 'center', lineHeight: 1.6 }}>Powered by GateGuard Nexus · Electronic signatures are legally binding under ESIGN Act &amp; UETA</p>
    </Screen>
  )
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100dvh', background: 'radial-gradient(circle at 50% 0%, rgba(0,124,255,0.18), transparent 34%), linear-gradient(180deg, #020713, #061225 48%, #020713)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px 48px' }}>
      <div style={{ width: '100%', maxWidth: 640, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
        <div style={{ width: 38, height: 38, background: 'linear-gradient(135deg, #00C8FF, #007CFF)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 0 22px rgba(0,124,255,0.28)' }}>
          <span style={{ color: 'white', fontWeight: 800, fontSize: 13 }}>GG</span>
        </div>
        <span style={{ color: '#7dd3fc', fontSize: 14, fontWeight: 800, letterSpacing: '0.12em' }}>GATEGUARD NEXUS</span>
      </div>
      <div style={{ width: '100%', maxWidth: 640, background: 'linear-gradient(180deg, rgba(8,18,34,0.94), rgba(3,9,22,0.92))', border: '1px solid rgba(0,200,255,0.20)', borderRadius: 28, padding: '34px 30px', boxShadow: '0 30px 100px rgba(0,0,0,0.52), 0 0 58px rgba(0,124,255,0.12), inset 0 1px 0 rgba(255,255,255,0.07)', backdropFilter: 'blur(28px)' }}>
        {children}
      </div>
    </div>
  )
}

function StatusOrb({ children, tone }: { children: React.ReactNode; tone: 'success' | 'error' }) {
  const color = tone === 'success' ? '#10B981' : '#F87171'
  return <div style={{ width: 74, height: 74, background: `${color}20`, border: `2px solid ${color}`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 32, color }}>{children}</div>
}

function FinalCopyLink({ href }: { href: string }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', marginTop: 20, alignItems: 'center', gap: 8, background: 'rgba(16,185,129,0.12)', color: '#86efac', textDecoration: 'none', padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 700, border: '1px solid rgba(16,185,129,0.28)' }}>Open Final Copy ↗</a>
}

function SupportLine() {
  return <p style={{ margin: '28px 0 0', color: 'rgba(255,255,255,0.42)', fontSize: 12 }}>Questions? Contact <a href="mailto:rfeldman@gateguard.co" style={{ color: '#7dd3fc' }}>rfeldman@gateguard.co</a></p>
}

function Row({ label, value }: { label: string; value: string }) {
  return <div style={{ display: 'flex', gap: 14, marginBottom: 9 }}><span style={{ color: 'rgba(255,255,255,0.48)', fontSize: 12, minWidth: 84 }}>{label}</span><span style={{ color: 'rgba(255,255,255,0.82)', fontSize: 12, fontWeight: 600 }}>{value}</span></div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 16 }}><label style={{ display: 'block', color: 'rgba(255,255,255,0.62)', fontSize: 12, marginBottom: 6, fontWeight: 600 }}>{label}</label>{children}</div>
}

const kicker: React.CSSProperties = { margin: '0 0 6px', color: 'rgba(125,211,252,0.78)', fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 800 }
const sectionLabel: React.CSSProperties = { margin: '0 0 10px', color: 'rgba(125,211,252,0.78)', fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }
const versionPill: React.CSSProperties = { display: 'inline-flex', marginTop: 14, background: 'rgba(0,200,255,0.12)', border: '1px solid rgba(0,200,255,0.22)', color: 'rgba(210,245,255,0.92)', padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700 }
const summaryBox: React.CSSProperties = { background: 'rgba(3,9,22,0.50)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, padding: '18px 20px', marginBottom: 28 }
const documentBox: React.CSSProperties = { background: 'rgba(3,9,22,0.50)', border: '1px solid rgba(0,200,255,0.16)', borderRadius: 16, padding: '22px 24px', maxHeight: 460, overflowY: 'auto', fontFamily: 'Georgia, serif', fontSize: 14, lineHeight: 1.75, color: 'rgba(255,255,255,0.82)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }
const documentLink: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.84)', textDecoration: 'none', padding: '11px 16px', borderRadius: 12, fontSize: 14, fontWeight: 700, border: '1px solid rgba(255,255,255,0.16)' }
const doneTitle: React.CSSProperties = { margin: '0 0 8px', color: '#F8FAFC', fontSize: 25, fontWeight: 800 }
const doneCopy: React.CSSProperties = { margin: '0 0 26px', color: 'rgba(255,255,255,0.66)', fontSize: 14, lineHeight: 1.6 }

const inputStyle: React.CSSProperties = { width: '100%', background: 'rgba(3,9,22,0.56)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 12, padding: '11px 14px', color: '#F8FAFC', fontSize: 14, outline: 'none', boxSizing: 'border-box' }
