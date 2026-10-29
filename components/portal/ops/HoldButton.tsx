'use client'

/**
 * HoldButton — press-and-hold to confirm a high-consequence action (lockdown,
 * force-close, hold-open, arming). Prevents accidental 1-tap triggers: the caller's
 * onConfirm fires only after the user holds for ~1.1s; releasing early cancels.
 */
import { useRef, useState } from 'react'

const HOLD_MS = 1100

type Tone = 'cyan' | 'amber' | 'alert'
const TONE: Record<Tone, { bg: string; fill: string; text: string; border: string }> = {
  cyan: { bg: 'rgba(0,113,227,0.08)', fill: 'rgba(0,113,227,0.22)', text: '#0058B0', border: 'rgba(0,113,227,0.35)' },
  amber: { bg: 'rgba(255,149,0,0.1)', fill: 'rgba(255,149,0,0.3)', text: '#8A3D00', border: 'rgba(178,80,0,0.35)' },
  alert: { bg: 'rgba(255,59,48,0.08)', fill: 'rgba(255,59,48,0.25)', text: '#B0000F', border: 'rgba(215,0,21,0.35)' },
}

export function HoldButton({ label, holdingLabel, onConfirm, tone = 'cyan', disabled, title }: {
  label: string
  holdingLabel?: string
  onConfirm: () => void
  tone?: Tone
  disabled?: boolean
  title?: string
}) {
  const [pct, setPct] = useState(0)
  const [holding, setHolding] = useState(false)
  const raf = useRef<number | null>(null)
  const start = useRef(0)
  const done = useRef(false)
  const t = TONE[tone]

  const stop = () => { if (raf.current) cancelAnimationFrame(raf.current); raf.current = null; setHolding(false); setPct(0) }
  const tick = () => {
    const p = Math.min(1, (performance.now() - start.current) / HOLD_MS)
    setPct(p)
    if (p >= 1) { if (!done.current) { done.current = true; stop(); onConfirm() } return }
    raf.current = requestAnimationFrame(tick)
  }
  const begin = () => { if (disabled) return; done.current = false; start.current = performance.now(); setHolding(true); raf.current = requestAnimationFrame(tick) }

  return (
    <button
      type="button"
      title={title || 'Press and hold to confirm'}
      disabled={disabled}
      onPointerDown={begin}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      style={{
        position: 'relative', overflow: 'hidden', width: '100%', padding: '11px 14px', borderRadius: 10,
        border: `1px solid ${t.border}`, background: t.bg, color: t.text, fontSize: 13, fontWeight: 800,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1, userSelect: 'none', touchAction: 'none',
      }}
    >
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct * 100}%`, background: t.fill, transition: holding ? 'none' : 'width 0.15s' }} />
      <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        {holding ? (holdingLabel || 'Keep holding…') : label}
      </span>
    </button>
  )
}

export default HoldButton
