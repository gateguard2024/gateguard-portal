'use client'

/**
 * ModuleCard — the universal card every offering wears in the builder's right
 * column. Three visual states, no modals:
 *   • collapsed  — 5th-grader summary (they pay / you keep)
 *   • active     — inline configurator (the module's own controls, as children)
 *   • ledger     — expandable P&L detail (COGS, labor, remittance, net)
 *
 * Optional modules carry an enable toggle; toggling recomputes the deal live.
 * Steel-skinned to match the app.
 */
import { useState, type ReactNode } from 'react'

export function ModuleCard({
  icon = '▦', title, type = 'required', accent = '#5FB8E0',
  enabled = true, onToggleEnabled, summary, ledger, defaultOpen = false, children,
}: {
  icon?: string
  title: string
  type?: 'required' | 'optional'
  accent?: string
  enabled?: boolean
  onToggleEnabled?: () => void
  summary?: ReactNode
  ledger?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [showLedger, setShowLedger] = useState(false)
  const dim = !enabled

  return (
    <div className="rounded-xl mb-2.5" style={{ background: 'repeating-linear-gradient(90deg,rgba(255,255,255,0.03) 0 1px,transparent 1px 4px), linear-gradient(180deg,#28384c,#1b2735)', border: `1px solid ${enabled ? 'rgba(95,184,224,0.28)' : 'rgba(140,170,200,0.16)'}`, opacity: dim ? 0.72 : 1 }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span style={{ fontSize: 14 }}>{icon}</span>
        <button onClick={() => setOpen(o => !o)} className="flex-1 text-left flex items-center gap-2 min-w-0">
          <span className="text-[12.5px] font-bold truncate" style={{ color: '#eaf2fb' }}>{title}</span>
          {type === 'optional' && <span className="text-[9px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5" style={{ background: 'rgba(95,184,224,0.14)', color: accent, border: '1px solid rgba(95,184,224,0.3)' }}>optional</span>}
        </button>
        {type === 'optional' && onToggleEnabled && (
          <button onClick={onToggleEnabled} title={enabled ? 'Included — click to remove' : 'Add to deal'} className="text-[10px] font-bold rounded-full px-2 py-0.5" style={{ background: enabled ? 'rgba(61,220,151,0.16)' : 'rgba(255,255,255,0.06)', border: `1px solid ${enabled ? 'rgba(61,220,151,0.4)' : 'rgba(140,170,200,0.24)'}`, color: enabled ? '#7fe0b8' : '#9fb4c9' }}>{enabled ? '✓ in' : '+ add'}</button>
        )}
        <button onClick={() => setOpen(o => !o)} aria-label={open ? 'Collapse' : 'Expand'} className="text-[13px] px-1" style={{ color: '#8fa4b8', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>⌄</button>
      </div>

      {/* Collapsed summary */}
      {!open && summary && (
        <div className="px-3 pb-2.5 -mt-0.5">{summary}</div>
      )}

      {/* Active controls */}
      {open && (
        <div className="px-3 pb-3">
          {children}
          {ledger && (
            <>
              <button onClick={() => setShowLedger(s => !s)} className="mt-2 text-[11px] font-bold flex items-center gap-1" style={{ color: accent }}>
                <span style={{ transform: showLedger ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform .15s' }}>⌄</span>
                {showLedger ? 'Hide P&L detail' : 'P&L detail'}
              </button>
              {showLedger && (
                <div className="mt-1.5 rounded-lg p-2.5" style={{ background: 'rgba(6,12,20,0.5)', border: '1px solid rgba(140,170,200,0.18)' }}>{ledger}</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** A single ledger line — label left, value right, optional tone. */
export function LedgerRow({ k, v, tone, strong }: { k: string; v: string; tone?: 'pos' | 'neg' | 'muted'; strong?: boolean }) {
  const color = tone === 'pos' ? '#3ddc97' : tone === 'neg' ? '#f0a5ad' : tone === 'muted' ? '#8fa4b8' : '#d6e3ef'
  return (
    <div className="flex items-baseline justify-between py-0.5" style={{ fontSize: 12 }}>
      <span style={{ color: '#9fb4c9', fontWeight: strong ? 700 : 400 }}>{k}</span>
      <span style={{ color, fontWeight: strong ? 800 : 600, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
    </div>
  )
}
