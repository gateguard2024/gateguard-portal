'use client'

import React from 'react'

export function NexusGlassBackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-5 inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:opacity-95 active:translate-y-0"
      style={{
        background: 'linear-gradient(165deg,rgba(255,255,255,0.045),transparent 55%), linear-gradient(180deg,rgba(32,44,66,0.82),rgba(18,26,42,0.78))',
        border: '1px solid #1E293B',
        color: '#EAF1F8',
        boxShadow: '0 10px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.16)',
      }}
      aria-label={label}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full text-base" style={{ background: 'rgba(0,163,255,0.16)', border: '1px solid rgba(0,163,255,0.32)', color: '#00A3FF' }}>←</span>
      <span>{label}</span>
    </button>
  )
}
