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
import { Sidebar }      from '@/components/layout/Sidebar'

export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isTech   = pathname.startsWith('/tech')

  // Tech tool: full-screen, dark, no portal chrome at all
  if (isTech) {
    return (
      <div style={{
        minHeight: '100dvh',
        background: '#0C0F14',
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
        <Sidebar />
        <main className="flex-1 flex flex-col ml-64 overflow-y-auto min-w-0 transition-all duration-200 relative z-10">
          {children}
        </main>
      </div>
    </ThemeProvider>
  )
}
