'use client'

/**
 * NexusDocShell — the universal public document frame.
 *
 * Dark Nexus glass "GateGuard Nexus Document Portal" chrome wrapping a clean
 * white document sheet. Used by every external/no-login document page (proposal,
 * approve, sign, and the future /document/[slug]). No portal sidebar, no app nav.
 *
 * Print-safe: the dark chrome is hidden on print so only the white sheet prints.
 */
import type { ReactNode } from 'react'

export function NexusDocShell({
  meta,
  onDownload,
  children,
}: {
  meta?: { number?: string | null; validUntil?: string | null }
  onDownload?: () => void
  children: ReactNode
}) {
  return (
    <div
      className="nexus-doc-portal"
      style={{
        minHeight: '100dvh',
        background:
          'radial-gradient(circle at 50% 0%, rgba(0,124,255,0.16), transparent 36%), linear-gradient(180deg, #020713, #061225 50%, #020713)',
      }}
    >
      <style>{`@media print { .nexus-doc-portal { background:#fff !important; } .nexus-doc-chrome { display:none !important; } }`}</style>

      {/* Header */}
      <div
        className="nexus-doc-chrome"
        style={{ borderBottom: '1px solid rgba(0,200,255,0.16)', background: 'rgba(3,9,22,0.55)', backdropFilter: 'blur(20px)' }}
      >
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg, #00C8FF, #007CFF)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(0,124,255,0.30)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z" stroke="white" strokeWidth="1.6" fill="rgba(255,255,255,0.12)" />
              </svg>
            </div>
            <div>
              <p style={{ margin: 0, color: '#fff', fontWeight: 700, fontSize: 13 }}>GateGuard Nexus</p>
              <p style={{ margin: 0, color: 'rgba(125,229,255,0.72)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase' }}>Document Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {meta?.number && (
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{meta.number}</p>
                {meta.validUntil && <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Valid until {meta.validUntil}</p>}
              </div>
            )}
            {onDownload && (
              <button
                onClick={onDownload}
                className="no-print"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.82)', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10, cursor: 'pointer' }}
              >
                Download PDF
              </button>
            )}
          </div>
        </div>
      </div>

      {/* White document sheet */}
      <div className="mx-auto max-w-4xl px-3 sm:px-6 py-6 sm:py-8">
        <div style={{ background: '#fff', borderRadius: 24, boxShadow: '0 30px 100px rgba(0,0,0,0.5), 0 0 58px rgba(0,124,255,0.08)', overflow: 'hidden' }}>
          {children}
        </div>
      </div>

      <p className="nexus-doc-chrome" style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 11, padding: '4px 16px 36px' }}>
        Powered by GateGuard Nexus · Secure document portal
      </p>
    </div>
  )
}
