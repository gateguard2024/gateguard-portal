/**
 * Quick Log — attach search.
 * GET /api/capture/search?q=...  → matching leads + opportunities + work orders
 * Used by the "Attach to…" picker. Org-scoped.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const esc = (s: string) => s.replace(/[%,()]/g, ' ').trim()

export async function GET(req: NextRequest) {
  try {
    const caller = await getCurrentUser()
    const q = esc(new URL(req.url).searchParams.get('q') ?? '')
    if (q.length < 2) return NextResponse.json({ results: [] })
    const scope = await resolveOrgScope(caller)
    const like = `%${q}%`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const run = async (table: string, cols: string, filter: string, orgCol: string, map: (r: any) => any) => {
      let query = supabase.from(table).select(cols).or(filter).limit(6)
      query = applyOrgScope(query as any, scope, orgCol) as typeof query // eslint-disable-line @typescript-eslint/no-explicit-any
      const { data } = await query
      return (data ?? []).map(map)
    }

    const [leads, opps, wos] = await Promise.all([
      run('leads', 'id, company_name, contact_name, location', `company_name.ilike.${like},contact_name.ilike.${like},location.ilike.${like}`, 'org_id',
        (r) => ({ type: 'lead', id: r.id, label: r.company_name || r.contact_name || 'Lead', sub: r.location || r.contact_name || '' })),
      run('opportunities', 'id, name, account_name, property_address', `name.ilike.${like},account_name.ilike.${like}`, 'dealer_org_id',
        (r) => ({ type: 'opportunity', id: r.id, label: r.name || r.account_name || 'Opportunity', sub: r.account_name || r.property_address || '' })),
      run('work_orders', 'id, wo_number, title, customer_name', `customer_name.ilike.${like},title.ilike.${like},wo_number.ilike.${like}`, 'org_id',
        (r) => ({ type: 'work_order', id: r.id, label: r.customer_name || r.title || r.wo_number || 'Job', sub: [r.wo_number, r.title].filter(Boolean).join(' · ') })),
    ])

    return NextResponse.json({ results: [...leads, ...opps, ...wos] })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Search failed', results: [] }, { status: 200 })
  }
}
