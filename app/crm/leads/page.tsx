'use client'

// Retired: the Leads list now lives in the Nexus Sales tab → Leads Hub.
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LeadsRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/?tab=opps&hub=leads') }, [router])
  return null
}
