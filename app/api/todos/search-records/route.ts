/**
 * GET /api/todos/search-records?q=text&type=lead|opportunity|customer|property|dealer|work_order
 * Powers the linked-record typeahead picker on the todo slide-over.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const caller = await getCurrentUser()
    const { searchParams } = new URL(req.url)
    const q    = searchParams.get('q')?.trim() ?? ''
    const type = searchParams.get('type') ?? 'all'

    if (q.length < 1) return NextResponse.json({ results: [] })

    const results: { id: string; label: string; sublabel?: string; type: string }[] = []

    if (type === 'lead' || type === 'all') {
      const { data } = await supabase
        .from('leads')
        .select('id, contact_name, company_name')
        .is('deleted_at', null)              // hide soft-deleted (in Deleted Items)
        .ilike('contact_name', `%${q}%`)
        .limit(5)
      ;(data ?? []).forEach(r => results.push({
        id: r.id, type: 'lead',
        label: r.contact_name ?? 'Unnamed Lead',
        sublabel: r.company_name ?? undefined,
      }))
    }

    if (type === 'opportunity' || type === 'all') {
      const { data } = await supabase
        .from('opportunities')
        .select('id, name, stage')
        .ilike('name', `%${q}%`)
        .limit(5)
      ;(data ?? []).forEach(r => results.push({
        id: r.id, type: 'opportunity',
        label: r.name ?? 'Unnamed Opportunity',
        sublabel: r.stage ?? undefined,
      }))
    }

    if (type === 'customer' || type === 'all') {
      const { data } = await supabase
        .from('organizations')
        .select('id, name, org_tier')
        .ilike('name', `%${q}%`)
        .in('org_tier', ['client', 'full_dealer', 'service_dealer', 'install_contractor', 'sales_partner'])
        .limit(5)
      ;(data ?? []).forEach(r => results.push({
        id: r.id, type: 'customer',
        label: r.name,
        sublabel: r.org_tier,
      }))
    }

    if (type === 'property' || type === 'all') {
      const { data } = await supabase
        .from('sites')
        .select('id, name, city, state')
        .ilike('name', `%${q}%`)
        .limit(5)
      ;(data ?? []).forEach(r => results.push({
        id: r.id, type: 'property',
        label: r.name,
        sublabel: [r.city, r.state].filter(Boolean).join(', ') || undefined,
      }))
    }

    if (type === 'dealer' || type === 'all') {
      const { data } = await supabase
        .from('organizations')
        .select('id, name, org_tier')
        .ilike('name', `%${q}%`)
        .in('org_tier', ['master_dealer', 'full_dealer'])
        .limit(5)
      ;(data ?? []).forEach(r => results.push({
        id: r.id, type: 'dealer',
        label: r.name,
        sublabel: r.org_tier === 'master_dealer' ? 'MSO' : 'Dealer',
      }))
    }

    if (type === 'work_order' || type === 'all') {
      // Work orders are scoped to the caller's org (corporate sees all).
      let woq = supabase
        .from('work_orders')
        .select('id, wo_number, title, status')
        .or(`title.ilike.%${q.replace(/[%,()]/g, ' ')}%,wo_number.ilike.%${q.replace(/[%,()]/g, ' ')}%`)
        .order('created_at', { ascending: false })
        .limit(5)
      // work_orders.created_by is a profiles UUID, not a Clerk ID — so no-org users get no WO results.
      if (!caller.isCorporate) woq = woq.eq('org_id', caller.org_id ?? '00000000-0000-0000-0000-000000000000')
      const { data } = await woq
      ;(data ?? []).forEach(r => results.push({
        id: r.id, type: 'work_order',
        label: [r.wo_number, r.title].filter(Boolean).join(' · ') || 'Work order',
        sublabel: r.status ?? undefined,
      }))
    }

    return NextResponse.json({ results })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
