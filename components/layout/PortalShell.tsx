'use client'

/**
 * PortalShell — conditionally renders the dealer portal sidebar + chrome.
 *
 * Routes that start with /tech get a clean full-screen shell (no sidebar,
 * no ThemeProvider, no portal nav). Everything else gets the full portal layout.
 *
 * This lives in the root layout so Next.js only has one <html>/<body> pair,
 * which is required by the App Router.
 */

import { usePathname } from 'next/navigation'
import { ThemeProvider } from 'next-themes'
import { Sidebar }          from '@/components/layout/Sidebar'
import { AddToL10Button }   from '@/components/layout/AddToL10Button'
import { NexusAssistant }   from '@/components/layout/NexusAssistant'
import { MobileNav }        from '@/components/layout/MobileNav'

export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isTech       = pathname.startsWith('/tech')
  // Proposal + approve pages are customer-facing — no sidebar, no portal chrome, no auth wall
  const isStandalone = isTech
    || /^\/quotes\/[^/]+(\/proposal|\/approve)(\/|$)/.test(pathname)

  // Standalone: full-screen, white canvas, no portal chrome
  if (isStandalone) {
    return (
      <div style={{
        minHeight: '100dvh',
        background: isTech ? '#F1F5F9' : '#ffffff',
        overscrollBehavior: 'none',
      }}>
        {children}
      </div>
    )
  }

  // Portal: sidebar + main content area
  return (
    <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light" disableTransitionOnChange>
      <div className="flex h-screen overflow-hidden relative">
        <div className="gate-bg-layer" aria-hidden="true" />

        {/* Sidebar — hidden on mobile, always visible md+ */}
        <div className="hidden md:block flex-shrink-0">
          <Sidebar />
        </div>

        {/* Main content — full width on mobile, offset by sidebar on md+ */}
        <main className="portal-main flex-1 flex flex-col md:ml-0 overflow-y-auto min-w-0 transition-all duration-200 relative z-10 pb-16 md:pb-0">
          {children}
        </main>

        {/* Ambient EOS L10 button — floats on every portal page (desktop only) */}
        <div className="hidden md:block">
          <AddToL10Button />
        </div>

        {/* NEXUS Personal AI Assistant — bottom-right on every portal page (desktop only for now) */}
        <div className="hidden md:block">
          <NexusAssistant />
        </div>

        {/* Mobile bottom tab bar — only shown on mobile */}
        <MobileNav />
      </div>
    </ThemeProvider>
  )
}
