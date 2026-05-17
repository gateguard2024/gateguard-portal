import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const caller = await getCurrentUser()
  const { searchParams } = new URL(req.url)
  const statusFilter = searchParams.get('status')
  const bucketFilter = searchParams.get('bucket')

  let query = supabase
    .from('renewals_view')
    .select('*')
    .order('end_date', { ascending: true })

  if (!caller.isCorporate && caller.org_id) {
    query = query.eq('org_id', caller.org_id)
  }
  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('renewal_status', statusFilter)
  }
  if (bucketFilter) {
    query = query.eq('bucket', bucketFilter)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const renewals = data ?? []

  const action_needed_count = renewals.filter(r => r.renewal_status === 'action_needed').length
  const on_track_count = renewals.filter(r => r.renewal_status === 'on_track').length
  const expired_count = renewals.filter(r => r.renewal_status === 'expired').length
  const total_mrr = renewals.reduce((sum: number, r: { mrr: number }) => sum + (r.mrr ?? 0), 0)

  return NextResponse.json({
    renewals,
    summary: {
      action_needed_count,
      on_track_count,
      expired_count,
      total_mrr,
    },
  })
}
