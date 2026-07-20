'use client'

// Slide-out portal navigation for full-screen "glass" routes (ARIA, design tools)
// that render OUTSIDE the normal PortalShell sidebar. A thin tab on the left edge
// opens the real Sidebar as an overlay drawer, so those pages keep their full
// width but the main nav is always one click away. Desktop only — mobile already
// has MobileNav.

import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Menu, X } = require('lucide-react') as any

export function GlassNavDrawer() {
  const [open, setOpen] = useState(false)

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      {/* Edge tab — vertically centred on the left so it never collides with the
          page's own top-left controls (ARIA's "Back to Dashboard", etc.). */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="hidden md:flex fixed left-0 top-1/2 z-[55] h-16 w-6 -translate-y-1/2 items-center justify-center rounded-r-lg text-white/75 transition-colors hover:text-white"
          style={{
            background: 'linear-gradient(90deg, rgba(13,33,80,0.96), rgba(6,14,40,0.92))',
            border: '1px solid rgba(255,255,255,0.12)',
            borderLeft: 'none',
          }}
        >
          <Menu size={16} />
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[60] hidden md:block" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full shadow-2xl">
            <Sidebar />
            <button
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
              className="absolute right-2 top-3 z-[61] flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
