import { getCurrentUser } from '@/lib/current-user'
import { redirect } from 'next/navigation'
import { CostSheetBody } from '@/components/admin/CostSheetBody'

/**
 * /admin/costs — direct-URL view of the Gate Guard cost model. CORPORATE ONLY.
 * Server-gated: a non-corporate user is redirected before the page renders, so
 * this is a second lock on top of the corporate-gated /api/admin/costs route.
 * The everyday path is the "Gate Guard Costs" card in the glass Admin hub.
 */
export const dynamic = 'force-dynamic'

export default async function CostsPage() {
  const user = await getCurrentUser()
  if (!user.isCorporate) redirect('/')

  return (
    <div className="min-h-dvh" style={{ background: '#F5F5F7' }}>
      <div className="mx-auto w-full max-w-3xl px-5 py-8">
        <div className="mb-1 text-[10px] uppercase tracking-[0.24em]" style={{ color: '#6E6E73' }}>Internal · Corporate</div>
        <h1 className="mb-5 text-2xl font-semibold" style={{ color: '#1D1D1F' }}>Gate Guard Costs</h1>
        <CostSheetBody />
      </div>
    </div>
  )
}
