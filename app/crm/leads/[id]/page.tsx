'use client'

// Retired: a lead now opens as a full page inside Nexus Sales (Leads → lead page).
// Old links (emails, bookmarks, Lexi) land here and are sent on.
import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function LeadRedirect() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  useEffect(() => { router.replace(id ? `/?tab=opps&lead=${encodeURIComponent(String(id))}` : '/?tab=opps&hub=leads') }, [router, id])
  return null
}
