'use client'

/**
 * Global admin launcher — a near-hidden icon in the top-right of every internal
 * page. Visible only to GateGuard staff + dealer admins/supervisors. Opens the
 * Nexus admin hub (Internal surface) via /?view=admin.
 *
 * Hidden on external/customer-facing pages (/document, /sign) — those must never
 * show any admin affordance.
 */
import { useUser } from '@clerk/nextjs'
import { usePathname, useRouter } from 'next/navigation'

export function AdminLauncher() {
  const { user, isLoaded } = useUser()
  const pathname = usePathname()
  const router = useRouter()

  if (!isLoaded || !user) return null

  const meta = (user.publicMetadata ?? {}) as Record<string, unknown>
  const isAdmin =
    meta.org_tier === 'corporate' ||
    meta.org_tier === 'master_dealer' ||
    meta.role === 'admin' ||
    meta.role === 'supervisor'

  // Never show on external customer-facing document pages.
  const externalPage = pathname.startsWith('/document') || pathname.startsWith('/sign')
  if (!isAdmin || externalPage) return null

  return (
    <button
      type="button"
      onClick={() => {
        // Already on the Nexus home → tell it to open admin (no navigation needed).
        if (pathname === '/') window.dispatchEvent(new CustomEvent('nexus:open-admin'))
        else router.push('/?view=admin')
      }}
      title="Admin"
      aria-label="Admin"
      className="fixed right-4 top-4 z-[60] flex h-9 w-9 items-center justify-center rounded-full transition-all hover:-translate-y-0.5"
      style={{
        background: 'rgba(8,18,34,0.72)',
        border: '1px solid rgba(0,200,255,0.30)',
        color: 'rgba(210,245,255,0.85)',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 0 16px rgba(0,124,255,0.2)',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    </button>
  )
}
