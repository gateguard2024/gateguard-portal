'use client'

// Corporate Pricing Console — standalone portal page.
// The full working surface lives in components/admin/PricingConsoleBody.tsx,
// shared with the "Pricing Console" glass shell on the Nexus admin surface.

import { useUser } from '@clerk/nextjs'
import { TopBar } from '@/components/layout/TopBar'
import { PricingConsoleBody } from '@/components/admin/PricingConsoleBody'

export default function PricingConsolePage() {
  // Gate Guard's internal cost/margin model is corporate-only — dealers must never
  // see it. (The PricingCalculator already bands by tier; this guards the raw console.)
  const { user, isLoaded } = useUser()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isCorporate = ((user?.publicMetadata as any)?.org_tier) === 'corporate'

  return (
    <div className="flex min-h-full flex-col">
      <TopBar title="Pricing Console" />
      <div className="mx-auto w-full max-w-6xl px-6 py-5">
        {!isLoaded ? null : !isCorporate ? (
          <div className="rounded-2xl border border-[#33465b] bg-[#1e2a3a] p-8 text-center text-sm" style={{ color: '#c3d3e2' }}>
            This page is restricted to Gate Guard corporate.
          </div>
        ) : (
          <PricingConsoleBody />
        )}
      </div>
    </div>
  )
}
