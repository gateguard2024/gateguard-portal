'use client'

export type NexusGlyphKind =
  | 'schedule'
  | 'priority'
  | 'todo'
  | 'email'
  | 'lead'
  | 'pipeline'
  | 'quote'
  | 'research'
  | 'job-alert'
  | 'job-calendar'
  | 'job-open'
  | 'activity'

function GlyphPath({ kind }: { kind: NexusGlyphKind }) {
  const stroke = 'currentColor'

  if (kind === 'schedule') return <><rect x="7" y="9" width="18" height="15" rx="2" stroke={stroke} strokeWidth="1.5" fill="none"/><path d="M10 6v5M22 6v5M7 14h18M11 18h3M17 18h3" stroke={stroke} strokeWidth="1.5" strokeLinecap="round"/></>
  if (kind === 'priority') return <><circle cx="16" cy="16" r="9" stroke={stroke} strokeWidth="1.5" fill="none"/><circle cx="16" cy="16" r="4" stroke={stroke} strokeWidth="1.5" fill="none"/><path d="M16 4v4M28 16h-4M16 28v-4M4 16h4" stroke={stroke} strokeWidth="1.5" strokeLinecap="round"/></>
  if (kind === 'todo') return <><rect x="7" y="7" width="18" height="18" rx="3" stroke={stroke} strokeWidth="1.5" fill="none"/><path d="M11 13h2M16 13h5M11 18h2M16 18h5M11 22l2 2 4-5" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></>
  if (kind === 'email') return <><rect x="6" y="9" width="20" height="15" rx="3" stroke={stroke} strokeWidth="1.5" fill="none"/><path d="M7 11l9 7 9-7M10 24l5-5M22 24l-5-5" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></>
  if (kind === 'lead') return <><circle cx="14" cy="13" r="4" stroke={stroke} strokeWidth="1.5" fill="none"/><path d="M7 25c1.2-4.3 4-6.5 7-6.5s5.8 2.2 7 6.5" stroke={stroke} strokeWidth="1.5" strokeLinecap="round"/><path d="M23 10v7M19.5 13.5h7" stroke={stroke} strokeWidth="1.5" strokeLinecap="round"/></>
  if (kind === 'pipeline') return <><path d="M7 22h5v-5h5v-5h8" stroke={stroke} strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round"/><circle cx="7" cy="22" r="2" stroke={stroke} strokeWidth="1.5" fill="none"/><circle cx="17" cy="17" r="2" stroke={stroke} strokeWidth="1.5" fill="none"/><circle cx="25" cy="12" r="2" stroke={stroke} strokeWidth="1.5" fill="none"/></>
  if (kind === 'quote') return <><path d="M10 6h10l5 5v15H10z" stroke={stroke} strokeWidth="1.5" fill="none" strokeLinejoin="round"/><path d="M20 6v6h5M13 16h9M13 20h9M13 24h5" stroke={stroke} strokeWidth="1.5" strokeLinecap="round"/></>
  if (kind === 'research') return <><path d="M16 6l8 4v8l-8 4-8-4v-8z" stroke={stroke} strokeWidth="1.5" fill="none" strokeLinejoin="round"/><path d="M16 10v6l5 3M11 19l5-3" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="16" cy="16" r="2" fill="currentColor"/></>
  if (kind === 'job-alert') return <><path d="M16 6l11 20H5z" stroke={stroke} strokeWidth="1.5" fill="none" strokeLinejoin="round"/><path d="M16 12v7M16 23h.01" stroke={stroke} strokeWidth="2" strokeLinecap="round"/></>
  if (kind === 'job-calendar') return <><rect x="7" y="8" width="18" height="16" rx="3" stroke={stroke} strokeWidth="1.5" fill="none"/><path d="M11 5v5M21 5v5M7 14h18M12 19h8" stroke={stroke} strokeWidth="1.5" strokeLinecap="round"/></>
  if (kind === 'job-open') return <><rect x="7" y="11" width="18" height="13" rx="3" stroke={stroke} strokeWidth="1.5" fill="none"/><path d="M12 11V8h8v3M7 16h18M16 16v3" stroke={stroke} strokeWidth="1.5" strokeLinecap="round"/></>
  return <><path d="M6 18h4l3-8 5 14 3-6h5" stroke={stroke} strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round"/><circle cx="6" cy="18" r="1.5" fill="currentColor"/><circle cx="26" cy="18" r="1.5" fill="currentColor"/></>
}

export function NexusGlyphTile({ kind, color }: { kind: NexusGlyphKind; color: string }) {
  return (
    <div
      className="relative mb-4 flex h-10 w-10 items-center justify-center overflow-hidden"
      style={{
        color,
        clipPath: 'polygon(18% 0%, 82% 0%, 100% 18%, 100% 82%, 82% 100%, 18% 100%, 0% 82%, 0% 18%)',
        background: 'linear-gradient(145deg, rgba(8,18,34,0.90), rgba(3,9,22,0.72))',
        border: `1px solid ${color}66`,
        boxShadow: `0 0 20px ${color}33, inset 0 1px 0 rgba(255,255,255,0.10)`,
      }}
    >
      <div className="absolute inset-x-1 top-1 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)`, opacity: 0.72 }} />
      <div className="absolute -right-4 -top-4 h-9 w-9 rounded-full" style={{ background: color, opacity: 0.12, filter: 'blur(10px)' }} />
      <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden="true" className="relative z-10">
        <GlyphPath kind={kind} />
      </svg>
    </div>
  )
}
