'use client'

type NexusComingSoonButtonProps = {
  label: string
}

export function NexusComingSoonButton({ label }: NexusComingSoonButtonProps) {
  return (
    <button
      type="button"
      className="w-full rounded-2xl px-3 py-3 text-left text-xs font-semibold transition-all hover:-translate-y-0.5 hover:opacity-95 active:translate-y-0"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.075), rgba(0,200,255,0.055))',
        border: '1px solid rgba(255,255,255,0.22)',
        color: 'rgba(255,255,255,0.92)',
        boxShadow: '0 0 16px rgba(0,200,255,0.08), inset 0 1px 0 rgba(255,255,255,0.08)',
      }}
      title={`${label} is coming soon`}
      aria-label={`${label} is coming soon`}
    >
      <span>{label}</span>
      <span
        className="ml-2 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]"
        style={{
          background: 'rgba(0,200,255,0.12)',
          border: '1px solid rgba(0,200,255,0.20)',
          color: 'rgba(210,245,255,0.92)',
        }}
      >
        Coming Soon
      </span>
    </button>
  )
}
