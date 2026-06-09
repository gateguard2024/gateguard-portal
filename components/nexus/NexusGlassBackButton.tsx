'use client'

export function NexusGlassBackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-5 inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:opacity-95 active:translate-y-0"
      style={{
        background: 'linear-gradient(135deg, rgba(0,200,255,0.18), rgba(139,92,246,0.20))',
        border: '1px solid rgba(0,200,255,0.34)',
        color: 'rgba(255,255,255,0.94)',
        boxShadow: '0 0 24px rgba(0,200,255,0.14), inset 0 1px 0 rgba(255,255,255,0.10)',
        textShadow: '0 0 12px rgba(0,200,255,0.20)',
      }}
      aria-label={label}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full text-base" style={{ background: 'rgba(0,200,255,0.16)', border: '1px solid rgba(0,200,255,0.24)' }}>←</span>
      <span>{label}</span>
    </button>
  )
}
