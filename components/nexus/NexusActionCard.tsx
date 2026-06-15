'use client'
// Shared Nexus surface card — the approved "My Day" standard.
// Bigger/brighter text, stronger glass, and the action label in flow (never
// overlapping the subtitle). Used by every surface landing grid.
import { NexusGlyphTile, type NexusGlyphKind } from '@/components/nexus/NexusGlyphTile'

function rgb(hex: string): string {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return r ? `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}` : '0,200,255'
}

export function NexusActionCard({
  title,
  subtitle,
  hex,
  glyph,
  badge,
  actionLabel = 'Open →',
  onClick,
  disabled = false,
}: {
  title: string
  subtitle: string
  hex: string
  glyph: NexusGlyphKind
  badge?: string | null
  actionLabel?: string
  onClick?: () => void
  disabled?: boolean
}) {
  const color = rgb(hex)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group relative flex min-h-[184px] flex-col overflow-hidden rounded-3xl p-5 text-left transition-all duration-200 hover:-translate-y-1 disabled:opacity-60"
      style={{
        background: `radial-gradient(circle at 18% 8%, rgba(${color},0.34), transparent 36%), linear-gradient(145deg, rgba(14,26,46,0.92), rgba(6,14,30,0.86))`,
        border: `1px solid rgba(${color},0.55)`,
        boxShadow: `0 0 30px rgba(${color},0.22), 0 22px 58px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.14)`,
        backdropFilter: 'blur(20px)',
      }}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full" style={{ background: `rgba(${color},0.20)`, filter: 'blur(18px)' }} />
      {badge && (
        <div className="absolute right-4 top-4 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ background: `rgba(${color},0.26)`, border: `1px solid rgba(${color},0.55)`, color: '#ffffff' }}>
          {badge}
        </div>
      )}
      <NexusGlyphTile kind={glyph} color={hex} />
      <div className="text-lg font-bold leading-tight" style={{ color: '#ffffff' }}>{title}</div>
      <div className="mt-2 text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.82)' }}>{subtitle}</div>
      <div className="mt-auto pt-4 self-center text-center rounded-full px-3.5 py-1.5 text-[13px] font-semibold opacity-95 transition-opacity group-hover:opacity-100" style={{ background: `rgba(${color},0.20)`, border: `1px solid rgba(${color},0.45)`, color: '#ffffff', boxShadow: `0 0 14px rgba(${color},0.22)` }}>{actionLabel}</div>
    </button>
  )
}
