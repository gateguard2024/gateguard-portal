import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getCurrentUser()
    const orgId = user.org_id ?? '00000000-0000-0000-0000-000000000001'

    // Fetch scorecard metrics with their last 13 weeks of entries
    const { data: metrics, error: metricsError } = await supabase
      .from('eos_scorecard')
      .select('*')
      .eq('org_id', orgId)
      .order('sort_order', { ascending: true })

    if (metricsError) {
      console.error('[/api/eos/scorecard GET] metrics error:', metricsError)
      return NextResponse.json({ error: metricsError.message }, { status: 500 })
    }

    if (!metrics || metrics.length === 0) {
      return NextResponse.json([])
    }

    const metricIds = metrics.map((m: { id: string }) => m.id)

    const { data: entries, error: entriesError } = await supabase
      .from('eos_scorecard_entries')
      .select('*')
      .in('scorecard_id', metricIds)
      .order('week_of', { ascending: false })

    if (entriesError) {
      console.error('[/api/eos/scorecard GET] entries error:', entriesError)
      return NextResponse.json({ error: entriesError.message }, { status: 500 })
    }

    // Group entries by scorecard_id, keep last 13 weeks
    const entriesByMetric: Record<string, { id: string; scorecard_id: string; week_of: string; value: string }[]> = {}
    for (const entry of (entries ?? [])) {
      if (!entriesByMetric[entry.scorecard_id]) {
        entriesByMetric[entry.scorecard_id] = []
      }
      if (entriesByMetric[entry.scorecard_id].length < 13) {
        entriesByMetric[entry.scorecard_id].push(entry)
      }
    }

    const result = metrics.map((m: { id: string; [key: string]: unknown }) => ({
      ...m,
      entries: entriesByMetric[m.id] ?? [],
    }))

    return NextResponse.json(result)
  } catch (err) {
    console.error('[/api/eos/scorecard GET] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const orgId = user.org_id ?? '00000000-0000-0000-0000-000000000001'
    const body = await req.json()

    const { name, owner, goal, unit, sort_order } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('eos_scorecard')
      .insert({
        org_id: orgId,
        name,
        owner: owner ?? '',
        goal: goal ?? '',
        unit: unit ?? '',
        sort_order: sort_order ?? 0,
      })
      .select()
      .single()

    if (error) {
      console.error('[/api/eos/scorecard POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ...data, entries: [] }, { status: 201 })
  } catch (err) {
    console.error('[/api/eos/scorecard POST] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
