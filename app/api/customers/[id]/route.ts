import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params

  const [orgRes, sitesRes, childrenRes] = await Promise.all([
    supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single(),
    supabase
      .from('sites')
      .select('id, name, address, city, state, status, created_at')
      .eq('org_id', id)
      .order('name', { ascending: true })
      .limit(20),
    supabase
      .from('organizations')
      .select('id, name, org_tier, is_active, primary_contact_name')
      .eq('parent_org_id', id)
      .eq('is_active', true)
      .order('name', { ascending: true }),
  ])

  if (orgRes.error || !orgRes.data) {
    return NextResponse.json({ error: orgRes.error?.message ?? 'Not found' }, { status: 404 })
  }

  // Fetch parent name if exists
  const org = orgRes.data as Record<string, unknown>
  let parentName: string | null = null
  const parentId = (org.parent_org_id ?? org.master_dealer_id ?? org.master_agent_id) as string | null
  if (parentId) {
    const { data: parent } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', parentId)
      .single()
    parentName = parent?.name ?? null
  }

  // Fetch work orders for this org's sites
  const siteIds = (sitesRes.data ?? []).map((s: { id: string }) => s.id)
  let recentWOs: unknown[] = []
  if (siteIds.length > 0) {
    const { data: wos } = await supabase
      .from('work_orders')
      .select('id, title, status, scheduled_date, priority, site_id')
      .in('site_id', siteIds)
      .order('scheduled_date', { ascending: false })
      .limit(5)
    recentWOs = wos ?? []
  }

  // Camera/door stats from sites
  const { data: assetStats } = await supabase
    .from('site_assets')
    .select('type, site_id')
    .in('site_id', siteIds.length > 0 ? siteIds : ['00000000-0000-0000-0000-000000000000'])

  const cameras = (assetStats ?? []).filter((a: { type: string }) => a.type === 'camera').length
  const doors   = (assetStats ?? []).filter((a: { type: string }) => a.type === 'door').length

  return NextResponse.json({
    ...org,
    parent_name:   parentName,
    sites:         sitesRes.data ?? [],
    children:      childrenRes.data ?? [],
    recent_work_orders: recentWOs,
    stats: {
      sites:   (sitesRes.data ?? []).length,
      cameras,
      doors,
      children: (childrenRes.data ?? []).length,
    },
  })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { data, error } = await supabase
    .from('organizations')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
