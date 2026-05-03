'use client';

import { useState } from 'react';
import { CheckCircle2, MessageSquare, Phone, Mail, Shield } from 'lucide-react';

const lineItems = [
  {
    description: 'Access Control System Setup',
    detail: 'LiftMaster RSW12V (2 gates)',
    amount: '$2,400',
    type: 'one-time' as const,
  },
  {
    description: 'Camera Installation',
    detail: 'Axis P3245-V x 8',
    amount: '$3,200',
    type: 'one-time' as const,
  },
  {
    description: 'Brivo Panel + Credentials Setup',
    detail: '',
    amount: '$900',
    type: 'one-time' as const,
  },
  {
    description: 'Monthly Monitoring & Support',
    detail: 'Recurring',
    amount: '$1,480',
    type: 'monthly' as const,
  },
  {
    description: 'Quarterly Preventive Maintenance',
    detail: 'Recurring',
    amount: '$350',
    type: 'monthly' as const,
  },
  {
    description: '24/7 SOC Coverage',
    detail: 'Recurring',
    amount: '$650',
    type: 'monthly' as const,
  },
];

type Status = 'pending' | 'approved' | 'changes';

export default function QuoteApprovePage({ params }: { params: { id: string } }) {
  const [status, setStatus] = useState<Status>('pending');
  const [changesNote, setChangesNote] = useState('');
  const [showChangesForm, setShowChangesForm] = useState(false);

  if (status === 'approved') {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: '#fff',
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif",
          padding: '24px',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '420px' }}>
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: '#f0fdf4',
              border: '2px solid #bbf7d0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
            }}
          >
            <CheckCircle2 size={40} color="#22c55e" />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
            Proposal Approved!
          </h1>
          <p style={{ color: '#64748b', marginBottom: '24px', lineHeight: '1.6' }}>
            Thank you for approving this proposal. The GateGuard team will reach out within 1 business day to send your service agreement for signature.
          </p>
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '20px',
              textAlign: 'left',
            }}
          >
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', marginBottom: '12px' }}>
              What happens next:
            </p>
            {[
              'GateGuard sends service agreement for e-signature',
              'Setup fee of $6,500 collected at contract signing',
              'Site survey scheduled with your installation team',
              'Equipment pre-configured and installed on-site',
            ].map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: '#eff1ff',
                    color: '#6B7EFF',
                    fontSize: '11px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '1px',
                  }}
                >
                  {i + 1}
                </div>
                <p style={{ fontSize: '13px', color: '#475569', margin: 0, lineHeight: '1.5' }}>{step}</p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '20px' }}>
            Questions? Contact{' '}
            <a href="mailto:rfeldman@gateguard.co" style={{ color: '#6B7EFF', textDecoration: 'none' }}>
              rfeldman@gateguard.co
            </a>{' '}
            · (832) 787-0900
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#f8fafc',
        zIndex: 50,
        overflowY: 'auto',
        fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        color: '#0f172a',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: '#fff',
          borderBottom: '1px solid #e2e8f0',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            maxWidth: '680px',
            margin: '0 auto',
            padding: '14px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: '#6B7EFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 800,
                letterSpacing: '-0.5px',
              }}
            >
              GG
            </div>
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.3px' }}>
              GateGuard
            </span>
          </div>
          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Proposal Review</span>
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '32px 24px 60px' }}>

        {/* Property info card */}
        <div
          style={{
            background: '#fff',
            borderRadius: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
            padding: '28px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#6B7EFF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                Quote for
              </p>
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px', lineHeight: '1.3' }}>
                The Villages on Riverwalk
              </h1>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px' }}>
                Augusta, GA · 248 Units
              </p>
              <p style={{ fontSize: '13px', color: '#475569', marginBottom: '4px' }}>
                <span style={{ color: '#94a3b8' }}>Prepared by: </span>
                GateGuard Direct · Russel Feldman
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '12px' }}>
                {[
                  ['Quote #', 'GG-2026-0042'],
                  ['Sent', 'April 17, 2026'],
                  ['Valid through', 'May 17, 2026'],
                ].map(([label, val]) => (
                  <div key={label}>
                    <p style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
                      {label}
                    </p>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#334155', fontFamily: "'IBM Plex Mono', monospace" }}>
                      {val}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '20px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#d97706',
                whiteSpace: 'nowrap',
                alignSelf: 'flex-start',
              }}
            >
              Awaiting Your Approval
            </div>
          </div>
        </div>

        {/* Line items card */}
        <div
          style={{
            background: '#fff',
            borderRadius: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
            overflow: 'hidden',
            marginBottom: '16px',
          }}
        >
          <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9' }}>
            <p style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', margin: 0 }}>Services & Pricing</p>
          </div>

          {/* One-time items */}
          <div style={{ padding: '8px 0' }}>
            <p style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 24px 4px' }}>
              One-Time Setup
            </p>
            {lineItems.filter((l) => l.type === 'one-time').map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 24px',
                  borderBottom: '1px solid #f8fafc',
                }}
              >
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 500, color: '#0f172a', margin: '0 0 2px' }}>{item.description}</p>
                  {item.detail && (
                    <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>{item.detail}</p>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', margin: 0 }}>{item.amount}</p>
                  <p style={{ fontSize: '10px', color: '#94a3b8', margin: 0 }}>one-time</p>
                </div>
              </div>
            ))}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '12px 24px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#475569', margin: 0 }}>Subtotal — One-Time</p>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: 0 }}>$6,500</p>
            </div>
          </div>

          {/* Monthly items */}
          <div style={{ padding: '8px 0' }}>
            <p style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 24px 4px' }}>
              Monthly Recurring
            </p>
            {lineItems.filter((l) => l.type === 'monthly').map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 24px',
                  borderBottom: '1px solid #f8fafc',
                }}
              >
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 500, color: '#0f172a', margin: 0 }}>{item.description}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', margin: 0 }}>{item.amount}</p>
                  <p style={{ fontSize: '10px', color: '#94a3b8', margin: 0 }}>/month</p>
                </div>
              </div>
            ))}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '12px 24px',
                background: '#f8fafc',
              }}
            >
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#475569', margin: 0 }}>Subtotal — Monthly</p>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#6B7EFF', margin: 0 }}>$2,480/mo</p>
            </div>
          </div>
        </div>

        {/* Summary totals card */}
        <div
          style={{
            background: '#fff',
            borderRadius: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
            padding: '24px',
            marginBottom: '16px',
          }}
        >
          <p style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginBottom: '16px' }}>Investment Summary</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
            {[
              { label: 'One-Time Setup', value: '$6,500', sub: 'due at signing' },
              { label: 'Monthly Service', value: '$2,480', sub: 'per month' },
              { label: 'Annual Value', value: '$29,760', sub: 'per year' },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  background: '#f8fafc',
                  borderRadius: '10px',
                  padding: '14px',
                  textAlign: 'center',
                  border: '1px solid #e2e8f0',
                }}
              >
                <p style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: '0 0 2px' }}>{s.value}</p>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#475569', margin: '0 0 1px' }}>{s.label}</p>
                <p style={{ fontSize: '10px', color: '#94a3b8', margin: 0 }}>{s.sub}</p>
              </div>
            ))}
          </div>
          <div
            style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '12px',
              color: '#92400e',
              lineHeight: '1.5',
            }}
          >
            Prices locked until May 17, 2026. Setup fee due at contract signing.
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ marginBottom: '16px' }}>
          <button
            onClick={() => setStatus('approved')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '16px',
              background: '#6B7EFF',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
              marginBottom: '10px',
              boxShadow: '0 4px 14px rgba(107, 126, 255, 0.35)',
              transition: 'background 0.15s',
              letterSpacing: '0.02em',
            }}
            onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.background = '#5a6de8')}
            onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.background = '#6B7EFF')}
          >
            <CheckCircle2 size={20} />
            APPROVE &amp; SIGN
          </button>

          {!showChangesForm ? (
            <button
              onClick={() => setShowChangesForm(true)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '15px',
                background: '#fff',
                color: '#475569',
                border: '1.5px solid #e2e8f0',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#6B7EFF';
                (e.currentTarget as HTMLButtonElement).style.color = '#6B7EFF';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#e2e8f0';
                (e.currentTarget as HTMLButtonElement).style.color = '#475569';
              }}
            >
              <MessageSquare size={16} />
              REQUEST CHANGES
            </button>
          ) : (
            <div
              style={{
                border: '1.5px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px',
                background: '#fff',
              }}
            >
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '10px' }}>
                What would you like changed?
              </p>
              <textarea
                value={changesNote}
                onChange={(e) => setChangesNote(e.target.value)}
                placeholder="Describe what you'd like adjusted — scope, pricing, timeline, etc."
                rows={3}
                style={{
                  width: '100%',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  fontSize: '13px',
                  color: '#0f172a',
                  background: '#f8fafc',
                  resize: 'vertical',
                  outline: 'none',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  marginBottom: '10px',
                }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setStatus('changes')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: '#6B7EFF',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Send Request
                </button>
                <button
                  onClick={() => setShowChangesForm(false)}
                  style={{
                    padding: '10px 16px',
                    background: '#f1f5f9',
                    color: '#64748b',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <p style={{ textAlign: 'center', fontSize: '12px', color: '#94a3b8', marginTop: '16px', lineHeight: '1.6' }}>
            Questions?{' '}
            <a href="mailto:rfeldman@gateguard.co" style={{ color: '#6B7EFF', textDecoration: 'none' }}>
              rfeldman@gateguard.co
            </a>
            {' · '}
            <a href="tel:8327870900" style={{ color: '#6B7EFF', textDecoration: 'none' }}>
              (832) 787-0900
            </a>
          </p>
        </div>

        {/* Prepared by strip */}
        <div
          style={{
            background: '#fff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: '#eff1ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Shield size={16} color="#6B7EFF" />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', margin: '0 0 2px' }}>
              Russel Feldman · GateGuard Direct
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <a href="mailto:rfeldman@gateguard.co" style={{ fontSize: '11px', color: '#6B7EFF', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Mail size={10} /> rfeldman@gateguard.co
              </a>
              <a href="tel:8327870900" style={{ fontSize: '11px', color: '#6B7EFF', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Phone size={10} /> (832) 787-0900
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '11px', color: '#cbd5e1' }}>
            Powered by GateGuard Dealer OS · portal.gateguard.co
          </p>
        </div>
      </div>
    </div>
  );
}
