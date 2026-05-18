'use client'

/**
 * /sign/[token] — Public document signing page
 * No Clerk auth required. Token is the credential.
 */

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

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
  signer_name: string | null
  signer_email: string
  signer_title: string | null
  signer_company: string | null
  sent_by_name: string | null
  expires_at: string
  status: string
}

type PageState = 'loading' | 'ready' | 'already_signed' | 'error' | 'submitting' | 'done'

export default function SignPage() {
  const { token } = useParams<{ token: string }>()
  const router     = useRouter()

  const [pageState, setPageState] = useState<PageState>('loading')
  const [sig,       setSig]       = useState<SigRecord | null>(null)
  const [errorMsg,  setErrorMsg]  = useState('')

  // Form fields
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
  const today    = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  // ─── Loading ─────────────────────────────────────────────────────────────
  if (pageState === 'loading') {
    return (
      <Screen>
        <div style={{ textAlign: 'center', color: '#94A3B8', padding: '60px 0' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #1E2A45', borderTopColor: '#6B7EFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ margin: 0, fontSize: 14 }}>Loading document…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </Screen>
    )
  }

  // ─── Error ────────────────────────────────────────────────────────────────
  if (pageState === 'error') {
    return (
      <Screen>
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ width: 56, height: 56, background: '#FF4D4D20', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <span style={{ fontSize: 28 }}>✕</span>
          </div>
          <h2 style={{ margin: '0 0 8px', color: '#F8FAFC', fontSize: 20 }}>Link Unavailable</h2>
          <p style={{ margin: 0, color: '#94A3B8', fontSize: 14, maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>{errorMsg}</p>
          <p style={{ margin: '24px 0 0', color: '#64748B', fontSize: 12 }}>Questions? Contact <a href="mailto:rfeldman@gateguard.co" style={{ color: '#6B7EFF' }}>rfeldman@gateguard.co</a></p>
        </div>
      </Screen>
    )
  }

  // ─── Already signed ───────────────────────────────────────────────────────
  if (pageState === 'already_signed') {
    return (
      <Screen>
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <div style={{ width: 64, height: 64, background: '#10B98120', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>✓</div>
          <h2 style={{ margin: '0 0 8px', color: '#F8FAFC', fontSize: 22 }}>Already Signed</h2>
          <p style={{ margin: 0, color: '#94A3B8', fontSize: 14 }}>{docLabel} has already been signed.</p>
          <p style={{ margin: '8px 0 0', color: '#64748B', fontSize: 12 }}>Questions? Contact <a href="mailto:rfeldman@gateguard.co" style={{ color: '#6B7EFF' }}>rfeldman@gateguard.co</a></p>
        </div>
      </Screen>
    )
  }

  // ─── Done ────────────────────────────────────────────────────────────────
  if (pageState === 'done') {
    return (
      <Screen>
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <div style={{ width: 72, height: 72, background: '#10B98120', border: '2px solid #10B981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 32 }}>✓</div>
          <h2 style={{ margin: '0 0 8px', color: '#F8FAFC', fontSize: 24, fontWeight: 700 }}>Document Signed</h2>
          <p style={{ margin: '0 0 4px', color: '#CBD5E1', fontSize: 15 }}>Thank you, <strong style={{ color: '#F8FAFC' }}>{signedName}</strong>.</p>
          <p style={{ margin: '0 0 32px', color: '#94A3B8', fontSize: 14 }}>
            Your signature on the <strong style={{ color: '#CBD5E1' }}>{docLabel}</strong> has been recorded.
          </p>
          <div style={{ background: '#0C111D', border: '1px solid #1E2A45', borderRadius: 12, padding: '20px 24px', display: 'inline-block', textAlign: 'left', minWidth: 280 }}>
            <Row label="Document" value={docLabel} />
            <Row label="Signed by" value={signedName} />
            {signedTitle && <Row label="Title" value={signedTitle} />}
            <Row label="Date" value={today} />
          </div>
          <p style={{ margin: '32px 0 0', color: '#64748B', fontSize: 12 }}>
            A copy will be emailed to you. Questions? Contact{' '}
            <a href="mailto:rfeldman@gateguard.co" style={{ color: '#6B7EFF' }}>rfeldman@gateguard.co</a>
          </p>
        </div>
      </Screen>
    )
  }

  // ─── Ready to sign ────────────────────────────────────────────────────────
  return (
    <Screen>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #1E2A45', paddingBottom: 24, marginBottom: 28 }}>
        <p style={{ margin: '0 0 4px', color: '#94A3B8', fontSize: 12, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Document for Signature</p>
        <h1 style={{ margin: '0 0 6px', color: '#F8FAFC', fontSize: 22, fontWeight: 700 }}>{docLabel}</h1>
        {sig?.document_version && (
          <span style={{ background: '#1E2A45', color: '#94A3B8', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>{sig.document_version}</span>
        )}
      </div>

      {/* Document info */}
      <div style={{ background: '#0C111D', border: '1px solid #1E2A45', borderRadius: 10, padding: '16px 20px', marginBottom: 28 }}>
        <Row label="Sent by"   value={sig?.sent_by_name ? `${sig.sent_by_name} · GateGuard` : 'GateGuard'} />
        <Row label="Recipient" value={sig?.signer_email ?? ''} />
        <Row label="Expires"   value={sig ? new Date(sig.expires_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''} />
      </div>

      {/* PDF viewer link */}
      {sig?.document_url && (
        <div style={{ marginBottom: 24 }}>
          <a
            href={sig.document_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#1E2A45', color: '#CBD5E1', textDecoration: 'none', padding: '10px 16px', borderRadius: 8, fontSize: 14, border: '1px solid #334155' }}
          >
            <span>📄</span>
            <span>Review Document (PDF)</span>
            <span style={{ color: '#64748B', fontSize: 11 }}>↗</span>
          </a>
        </div>
      )}

      {/* Signature form */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 20px', color: '#CBD5E1', fontSize: 16, fontWeight: 600 }}>Sign Document</h2>

        <Field label="Full Legal Name *">
          <input
            type="text"
            value={signedName}
            onChange={e => setSignedName(e.target.value)}
            placeholder="Your full name"
            style={inputStyle}
          />
        </Field>

        <Field label="Title / Role">
          <input
            type="text"
            value={signedTitle}
            onChange={e => setSignedTitle(e.target.value)}
            placeholder="e.g. CEO, Owner, Director"
            style={inputStyle}
          />
        </Field>

        {/* Signature preview */}
        {signedName.trim() && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ margin: '0 0 6px', color: '#64748B', fontSize: 12 }}>Your signature will appear as:</p>
            <div style={{ background: '#0C111D', border: '1px solid #1E2A45', borderRadius: 8, padding: '16px 20px' }}>
              <p style={{ margin: '0 0 4px', color: '#F8FAFC', fontFamily: 'Georgia, serif', fontSize: 24, fontStyle: 'italic' }}>{signedName}</p>
              <p style={{ margin: 0, color: '#64748B', fontSize: 12 }}>{today} · Electronic Signature</p>
            </div>
          </div>
        )}

        {/* Agreement checkbox */}
        <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer', marginBottom: 24 }}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
            style={{ width: 18, height: 18, marginTop: 2, accentColor: '#6B7EFF', cursor: 'pointer', flexShrink: 0 }}
          />
          <span style={{ color: '#94A3B8', fontSize: 13, lineHeight: 1.5 }}>
            By checking this box, I confirm that I have read and agree to the terms of the <strong style={{ color: '#CBD5E1' }}>{docLabel}</strong> and I consent to signing this document electronically. I understand this constitutes a legally binding electronic signature.
          </span>
        </label>

        {errorMsg && (
          <p style={{ margin: '0 0 16px', color: '#FF4D4D', fontSize: 13, background: '#FF4D4D10', border: '1px solid #FF4D4D30', borderRadius: 6, padding: '8px 12px' }}>{errorMsg}</p>
        )}

        <button
          onClick={handleSign}
          disabled={!agreed || !signedName.trim() || pageState === 'submitting'}
          style={{
            width: '100%',
            background: agreed && signedName.trim() ? '#6B7EFF' : '#1E2A45',
            color: agreed && signedName.trim() ? 'white' : '#475569',
            border: 'none',
            borderRadius: 10,
            padding: '14px 24px',
            fontSize: 15,
            fontWeight: 600,
            cursor: agreed && signedName.trim() ? 'pointer' : 'not-allowed',
            transition: 'background 0.2s',
          }}
        >
          {pageState === 'submitting' ? 'Signing…' : `Sign ${docLabel} →`}
        </button>
      </div>

      <p style={{ margin: 0, color: '#475569', fontSize: 11, textAlign: 'center', lineHeight: 1.6 }}>
        Powered by GateGuard Nexus · Electronic signatures are legally binding under ESIGN Act &amp; UETA
      </p>
    </Screen>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0C111D', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px 48px' }}>
      {/* Logo bar */}
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
        <div style={{ width: 36, height: 36, background: '#6B7EFF', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>GG</span>
        </div>
        <span style={{ color: '#6B7EFF', fontSize: 14, fontWeight: 600, letterSpacing: '0.5px' }}>GATEGUARD NEXUS</span>
      </div>
      {/* Card */}
      <div style={{ width: '100%', maxWidth: 560, background: '#131B2E', border: '1px solid #1E2A45', borderRadius: 16, padding: '32px 28px' }}>
        {children}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
      <span style={{ color: '#64748B', fontSize: 12, minWidth: 80 }}>{label}</span>
      <span style={{ color: '#CBD5E1', fontSize: 12 }}>{value}</span>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', color: '#94A3B8', fontSize: 12, marginBottom: 6, fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#0C111D',
  border: '1px solid #1E2A45',
  borderRadius: 8,
  padding: '10px 14px',
  color: '#F8FAFC',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
}
