/**
 * app/tech/layout.tsx
 *
 * Standalone layout for the field tech tool.
 * Bypasses the portal's root layout (sidebar, nav, ThemeProvider).
 * Full-screen, dark, no chrome — the tool owns 100% of the viewport.
 */

export const metadata = {
  title: 'GateGuard Field Tool',
  description: 'Field diagnostic tool for GateGuard technicians.',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
}

export default function TechLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#0C0F14" />
      </head>
      <body style={{ margin: 0, padding: 0, background: '#0C0F14', overscrollBehavior: 'none' }}>
        {children}
      </body>
    </html>
  )
}
