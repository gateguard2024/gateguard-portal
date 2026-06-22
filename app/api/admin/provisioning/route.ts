/**
 * /api/admin/provisioning — corporate "Sites to provision" queue.
 * Lists the controller rows auto-created when deals are won (source='kickoff',
 * status='requested') so corporate can program each one in Brivo. Corporate-only.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

export async function GET() {
  const user = await getCurrentUser()
  if (!user.isCorporate) return NextResponse.json({ error: 'Corporate only.' }, { status: 403 })

  const { data: panels, error } = await supabase
    .from('site_panels')
    .select('*')
    .eq('source', 'kickoff')
    .eq('status', 'requested')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (panels ?? []) as Row[]
  const siteIds = Array.from(new Set(rows.map(r => r.site_id).filter(Boolean)))
  const siteMap: Record<string, Row> = {}
  const orgMap: Record<string, string> = {}
  if (siteIds.length) {
    const { data: sites } = await supabase.from('sites').select('id, name, address, city, state, org_id, master_dealer_id').in('id', siteIds)
    ;(sites ?? []).forEach((s: Row) => { siteMap[s.id] = s })
    const orgIds = Array.from(new Set((sites ?? []).map((s: Row) => s.org_id ?? s.master_dealer_id).filter(Boolean)))
    if (orgIds.length) {
      const { data: orgs } = await supabase.from('organizations').select('id, name').in('id', orgIds)
      ;(orgs ?? []).forEach((o: Row) => { orgMap[o.id] = o.name })
    }
  }

  const queue = rows.map(r => {
    const s = siteMap[r.site_id] ?? {}
    const doors = (Array.isArray(r.doors) ? r.doors : []).map((d: { name?: string } | string) => typeof d === 'string' ? d : d?.name).filter(Boolean)
    return {
      panel_id: r.id,
      site_id: r.site_id,
      site_name: s.name ?? 'Site',
      location: [s.city, s.state].filter(Boolean).join(', ') || s.address || null,
      dealer_name: orgMap[s.org_id ?? s.master_dealer_id] ?? null,
      doors,
      dealer_confirmed: !!r.dealer_confirmed,
      created_at: r.created_at,
    }
  })

  return NextResponse.json({ queue, count: queue.length })
}
