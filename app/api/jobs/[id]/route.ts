/**
 * GET   /api/jobs/[id]  — job detail + its tracker groups + items
 * PATCH /api/jobs/[id]  — update job fields
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: job, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error || !job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Fetch tracker groups for this job
    const { data: groups } = await supabase
      .from('tracker_groups')
      .select('*')
      .eq('entity_type', 'job')
      .eq('entity_id', params.id)
      .order('position', { ascending: true })

    const groupIds = (groups ?? []).map((g: any) => g.id)

    // Fetch all items for those groups
    let items: any[] = []
    if (groupIds.length > 0) {
      const { data: itemData } = await supabase
        .from('tracker_items')
        .select('*')
        .in('group_id', groupIds)
        .is('parent_item_id', null)
        .order('position', { ascending: true })
      items = itemData ?? []
    }

    // Attach items to their groups
    const groupsWithItems = (groups ?? []).map((g: any) => ({
      ...g,
      items: items.filter((i: any) => i.group_id === g.id),
    }))

    return NextResponse.json({ job, groups: groupsWithItems })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const allowed = [
      'title', 'status', 'job_type', 'assigned_tech_id', 'assigned_tech_name',
      'total_value', 'start_date', 'target_completion_date', 'completed_at', 'notes',
      'site_id', 'site_name', 'opportunity_id', 'opportunity_name',
    ]
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const k of allowed) {
      if (k in body) patch[k] = body[k]
    }
    if (body.status === 'completed' && !patch.completed_at) {
      patch.completed_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('jobs')
      .update(patch)
      .eq('id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ job: data })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown' }, { status: 500 })
  }
}
