'use client'

// Corporate Pricing Console — standalone portal page.
// The full working surface lives in components/admin/PricingConsoleBody.tsx,
// shared with the "Pricing Console" glass shell on the Nexus admin surface.

import { TopBar } from '@/components/layout/TopBar'
import { PricingConsoleBody } from '@/components/admin/PricingConsoleBody'

export default function PricingConsolePage() {
  return (
    <div className="flex min-h-full flex-col">
      <TopBar title="Pricing Console" />
      <div className="mx-auto w-full max-w-6xl px-6 py-5">
        <PricingConsoleBody />
      </div>
    </div>
  )
}
