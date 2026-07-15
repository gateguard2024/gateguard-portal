import { OpportunityLifecycle } from '@/components/nexus/OpportunityLifecycle'

// /lifecycle?id=<opportunityId>
//
// Without an id this page rendered an unbound life cycle: no opportunity loaded,
// so "Mark Lost" (guarded on `opportunityId`) never appeared and nothing saved.
// Same screen reached from Sales DID pass an id and DID show the button — which
// is exactly the "it doesn't appear consistently" report.
export default function LifecyclePage({
  searchParams,
}: {
  searchParams?: { id?: string }
}) {
  return <OpportunityLifecycle opportunityId={searchParams?.id} />
}
