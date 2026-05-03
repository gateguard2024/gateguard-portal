import type { Metadata } from 'next'

/**
 * app/tech/layout.tsx
 *
 * Adds PWA manifest link + mobile meta tags for the /tech field tool.
 * "Add to Home Screen" on iOS/Android installs as a standalone app (no browser chrome).
 * Theme color matches GateGuard dark sidebar (#0C111D).
 */
export const metadata: Metadata = {
  title: 'GateGuard Field Tech',
  description: 'GateGuard field diagnostic tool — wiring, troubleshooting, cable testing.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'GG Tech',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export default function TechLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
