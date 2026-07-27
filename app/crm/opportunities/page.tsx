'use client'

// Retired: the Opportunities pipeline now lives in the Nexus Sales tab → Opportunity Hub.
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function OpportunitiesRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/?tab=opps&hub=opps') }, [router])
  return null
}
