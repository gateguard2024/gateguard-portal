import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// GET /api/reviews — list work_order_reviews scoped to org
export async function GET(_req: NextRequest) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  let query = supabase
    .from('work_order_reviews')
    .select(`
      id, work_order_id, org_id, technician_id,
      reviewer_name, reviewer_email, reviewer_phone,
      rating, review_text, sms_sent_at, sms_sid,
      response_at, google_posted, created_at,
      work_orders!work_order_reviews_work_order_id_fkey (wo_number, title, customer_name),
      technicians!work_order_reviews_technician_id_fkey (name)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  query = applyOrgScope(query, scope, 'org_id') as typeof query

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const reviews = (data ?? []).map((r: any) => ({
    ...r,
    wo_number:     r.work_orders?.wo_number  ?? null,
    wo_title:      r.work_orders?.title       ?? null,
    property_name: r.work_orders?.customer_name ?? null,
    tech_name:     r.technicians?.name        ?? null,
    work_orders:   undefined,
    technicians:   undefined,
  }))

  return NextResponse.json({ reviews })
}
