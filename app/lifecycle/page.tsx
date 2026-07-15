import { OpportunityLifecycle } from '@/components/nexus/OpportunityLifecycle'
import { NexusBackdrop } from '@/components/nexus/NexusBackdrop'

// /lifecycle?id=<opportunityId>
//
// Without an id this page rendered an unbound life cycle: no opportunity loaded,
// so "Mark Lost" (guarded on `opportunityId`) never appeared and nothing saved.
// The same screen reached from Sales DID pass an id and DID show the button —
// which is exactly the "it doesn't appear consistently" report.
//
// OpportunityLifecycle is transparent by design (it inherits the backdrop of
// whatever shell it opens inside). Standalone, there is no shell, so this route
// supplies one.
export default function LifecyclePage({
  searchParams,
}: {
  searchParams?: { id?: string }
}) {
  return (
    <NexusBackdrop variant="page">
      <OpportunityLifecycle opportunityId={searchParams?.id} />
    </NexusBackdrop>
  )
}
