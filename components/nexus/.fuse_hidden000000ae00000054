'use client'

import { useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActionCardProps {
  // Display
  title:       string          // e.g. "WO-2026-100: Gate Repair"
  subtitle?:   string          // e.g. "Flint River Apartments"
  status:      string          // badge label  e.g. "Pending" | "In Progress"
  statusColor: 'blue' | 'amber' | 'green' | 'red'
  aiScore:     number          // 0–99
  aiContext:   string          // short label  e.g. "Technician Recommendation"
  reasoning:   string          // one-sentence AI explanation

  // Action
  actionLabel:    string       // e.g. "Execute Assignment"
  confirmLabel?:  string       // e.g. "Confirm Assignment"  (defaults to actionLabel)
  onExecute:      () => Promise<void> | void

  // Optional dismiss
  onDismiss?: () => void
}

const STATUS_COLORS = {
  blue:  { bg: 'rgba(107,126,255,0.18)', border: 'rgba(107,126,255,0.35)', text: '#93a3ff' },
  amber: { bg: 'rgba(251,191,36,0.15)',  border: 'rgba(251,191,36,0.35)',  text: '#fbbf24' },
  green: { bg: 'rgba(52,211,153,0.15)',  border: 'rgba(52,211,153,0.35)',  text: '#34d399' },
  red:   { bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.35)',   text: '#f87171' },
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ActionCard({
  title, subtitle, status, statusColor, aiScore, aiContext, reasoning,
  actionLabel, confirmLabel, onExecute, onDismiss,
}: ActionCardProps) {
  const [phase,     setPhase]     = useState<'recommend' | 'confirm' | 'executing' | 'done'>('recommend')
  const [execError, setExecError] = useState<string | null>(null)

  const colors = STATUS_COLORS[statusColor]
  const scoreColor = aiScore >= 85 ? '#34d399' : aiScore >= 70 ? '#fbbf24' : '#f87171'

  async function handleConfirm() {
    setPhase('executing')
    setExecError(null)
    try {
      await onExecute()
      setPhase('done')
    } catch (e) {
      setExecError(e instanceof Error ? e.message : 'Execution failed.')
      setPhase('confirm')
    }
  }

  return (
    <div
      className="rounded-2xl p-4 transition-all duration-200"
      style={{
        background:    'rgba(255,255,255,0.04)',
        border:        `0.5px solid rgba(255,255,255,0.09)`,
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* ── Done state ── */}
      {phase === 'done' && (
        <div className="flex items-center gap-3 py-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(52,211,153,0.2)', border: '1px solid rgba(52,211,153,0.4)' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>Assignment confirmed</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{title}</p>
          </div>
        </div>
      )}

      {/* ── Recommend / Confirm / Executing states ── */}
      {phase !== 'done' && (
        <>
          {/* Header row */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0 pr-2">
              <p className="text-sm font-semibold truncate" style={{ color: 'rgba(255,255,255,0.9)' }}>{title}</p>
              {subtitle && (
                <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>{subtitle}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* AI Score */}
              <span
                className="text-[10px] font-bold font-mono px-2 py-0.5 rounded"
                style={{ background: 'rgba(0,0,0,0.3)', color: scoreColor, border: `0.5px solid ${scoreColor}40` }}
              >
                AI {aiScore}
              </span>
              {/* Status badge */}
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded"
                style={{ background: colors.bg, border: `0.5px solid ${colors.border}`, color: colors.text }}
              >
                {status}
              </span>
            </div>
          </div>

          {/* AI context label */}
          <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'rgba(107,126,255,0.5)' }}>
            {aiContext}
          </p>

          {/* Reasoning text — always visible */}
          <p className="text-xs leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.55)' }}>
            {reasoning}
          </p>

          {/* Error */}
          {execError && (
            <p className="text-xs mb-3 text-red-400">{execError}</p>
          )}

          {/* ── Recommend phase: single Execute button ── */}
          {phase === 'recommend' && (
            <div className="flex gap-2">
              <button
                onClick={() => setPhase('confirm')}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: 'rgba(107,126,255,0.2)',
                  border:     '1px solid rgba(107,126,255,0.4)',
                  color:      '#a5b4ff',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(107,126,255,0.3)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(107,126,255,0.2)')}
              >
                {actionLabel}
              </button>
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="px-3 py-2.5 rounded-xl text-sm transition-all"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}
                >
                  Skip
                </button>
              )}
            </div>
          )}

          {/* ── Confirm phase: ConfirmationCard ── */}
          {(phase === 'confirm' || phase === 'executing') && (
            <div
              className="rounded-xl p-3"
              style={{
                background: 'linear-gradient(135deg, rgba(10,18,48,0.95) 0%, rgba(6,10,28,0.95) 100%)',
                border:     '1px solid rgba(251,191,36,0.3)',
              }}
            >
              {/* Pulsing amber dot + label */}
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    background: '#fbbf24',
                    boxShadow:  '0 0 6px rgba(251,191,36,0.7)',
                    animation:  'pulse 2s infinite',
                  }}
                />
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#fbbf24' }}>
                  Confirm action
                </p>
              </div>
              <p className="text-xs mb-3 leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)', fontStyle: 'italic' }}>
                &ldquo;{reasoning}&rdquo;
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleConfirm}
                  disabled={phase === 'executing'}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: phase === 'executing' ? 'rgba(251,191,36,0.1)' : 'rgba(251,191,36,0.2)',
                    border:     '1px solid rgba(251,191,36,0.4)',
                    color:      '#fbbf24',
                    opacity:    phase === 'executing' ? 0.7 : 1,
                  }}
                >
                  {phase === 'executing' ? 'Executing…' : (confirmLabel ?? confirmLabel ?? actionLabel)}
                </button>
                <button
                  onClick={() => setPhase('recommend')}
                  disabled={phase === 'executing'}
                  className="px-3 py-2 rounded-lg text-sm transition-all"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
