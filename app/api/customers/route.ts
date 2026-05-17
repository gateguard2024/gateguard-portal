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
  const q = searchParams.get('q')

  let query = supabase
    .from('organizations')
    .select('id, name, tier, tier_label, parent_id, is_active, created_at')
    .eq('tier', 'client')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (!caller.isCorporate && caller.org_id) {
    query = query.eq('parent_id', caller.org_id)
  }
  if (q) {
    query = query.ilike('name', `%${q}%`)
  }

  const { data: orgs, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const customers = orgs ?? []

  // Enrich with site counts
  if (customers.length > 0) {
    const orgIds = customers.map(o => o.id)
    const { data: siteCounts } = await supabase
      .from('sites')
      .select('org_id')
      .in('org_id', orgIds)

    const siteCountMap: Record<string, number> = {}
    for (const row of siteCounts ?? []) {
      siteCountMap[row.org_id] = (siteCountMap[row.org_id] ?? 0) + 1
    }

    return NextResponse.json({
      customers: customers.map(c => ({
        ...c,
        site_count: siteCountMap[c.id] ?? 0,
      })),
    })
  }

  return NextResponse.json({ customers })
}

export async function POST(req: NextRequest) {
  const caller = await getCurrentUser()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { name, tier_label, parent_id } = body as Record<string, unknown>

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const parentId = (parent_id as string | null) ?? caller.org_id

  const { data, error } = await supabase
    .from('organizations')
    .insert({
      name,
      tier: 'client',
      tier_label: tier_label ?? 'Client',
      parent_id: parentId ?? null,
      is_active: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ customer: data }, { status: 201 })
}
