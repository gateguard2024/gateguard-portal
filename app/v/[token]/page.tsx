// Vendor job page — public, the link secret is the access (migration 239).
import type { Metadata } from 'next'
import VendorJobPage from '@/components/vendor/VendorJobPage'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Gate Guard job', robots: { index: false, follow: false }, referrer: 'no-referrer' }

export default function Page({ params }: { params: { token: string } }) {
  return <VendorJobPage token={params.token} />
}
