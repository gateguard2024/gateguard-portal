/**
 * /quotes/[id]/approve — legacy route.
 *
 * The two customer-facing proposal pages were unified into ONE module-driven
 * renderer at /quotes/[id]/proposal (Phase 1). Any old link to /approve now
 * redirects there so there is a single source of truth.
 */
import { redirect } from 'next/navigation'

export default function ApproveRedirect({ params }: { params: { id: string } }) {
  redirect(`/quotes/${params.id}/proposal`)
}
