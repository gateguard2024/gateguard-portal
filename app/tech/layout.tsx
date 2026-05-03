/**
 * app/tech/layout.tsx
 *
 * Minimal passthrough — the PortalShell in root layout handles
 * stripping the sidebar/portal chrome when pathname starts with /tech.
 * This file must NOT define <html> or <body> tags (App Router rule).
 */
export default function TechLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
