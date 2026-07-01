'use client'

/**
 * PortalShell — conditionally renders the dealer portal sidebar + chrome.
 *
 * Routes that start with /tech, /aria, /sign, or Nexus get a clean full-screen shell
 * with no sidebar and no portal nav. Everything else gets the full portal layout.
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
import { AdminLauncher }    from '@/components/layout/AdminLauncher'

export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isTech       = pathname.startsWith('/tech')
  const isAria       = pathname.startsWith('/aria')
  const isSign       = pathname.startsWith('/sign')
  const isDocument   = pathname.startsWith('/document/')
  const isNexus      = pathname === '/' || pathname.startsWith('/opps')
  const isCmms       = pathname.startsWith('/cmms')   // Operations Hub — glass, full-screen
  const isSchedule   = pathname.startsWith('/schedule') // public booking page — no chrome
  const isLog        = pathname.startsWith('/log')      // Quick Log — phone-first PWA capture
  const isTrash      = pathname.startsWith('/trash')    // Deleted Items — glass recycle bin
  const isDesignStudio = pathname.startsWith('/design/studio') // rebuilt design tool — glass, full-screen
  // Proposal + approve pages, signing links, and the public document portal are
  // customer-facing — no sidebar, no portal chrome, no auth wall
  const isStandalone = isTech || isAria || isSign || isDocument || isNexus || isCmms || isSchedule || isLog || isDesignStudio
    || /^\/quotes\/[^/]+(\/proposal|\/approve)(\/|$)/.test(pathname)
  const isFullGlass = isAria || isDesignStudio  // 100dvh flex-column, own internal scroll

  // Standalone: full-screen, no portal chrome
  if (isStandalone) {
    return (
      <div style={{
        minHeight: '100dvh',
        height: isFullGlass ? '100dvh' : undefined,
        display: isFullGlass ? 'flex' : undefined,
        flexDirection: isFullGlass ? 'column' : undefined,
        overflow: isFullGlass ? 'hidden' : undefined,
        background: isTech ? '#F1F5F9' : isNexus || isFullGlass || isSign || isDocument ? 'transparent' : '#ffffff',
        overscrollBehavior: 'none',
      }}>
        {/* No admin launcher on the public booking page (prospect-facing) */}
        {!isSchedule && <AdminLauncher />}
        {children}
      </div>
    )
  }

  // Portal: sidebar + main content area
  return (
    <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light" disableTransitionOnChange>
      <div className="flex h-screen overflow-hidden relative">
        <div className="gate-bg-layer" aria-hidden="true" />
        <AdminLauncher />

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
