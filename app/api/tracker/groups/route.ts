import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DEFAULT_GROUPS = [
  { name: 'Bugs',         color: '#ef4444', position: 0 },
  { name: 'Enhancements', color: '#8b5cf6', position: 1 },
  { name: 'Questions',    color: '#db2777', position: 2 },
]

/**
 * GET /api/tracker/groups
 * Returns all groups for the caller's org.
 * Auto-seeds the 3 default groups (Bugs/Enhancements/Questions) on first call.
 */
export async function GET() {
  try {
    const user = await getCurrentUser()

    const { data, error } = await supabase
      .from('tracker_groups')
      .select('*')
      .eq('org_id', user.org_id ?? '00000000-0000-0000-0000-000000000000')
      .order('position', { ascending: true })

    if (error) {
      if (error.code === '42P01') return NextResponse.json([])
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Auto-seed defaults on first use
    if (!data || data.length === 0) {
      const seeds = DEFAULT_GROUPS.map(g => ({ ...g, org_id: user.org_id }))
      const { data: seeded, error: seedErr } = await supabase
        .from('tracker_groups')
        .insert(seeds)
        .select()
      if (seedErr) return NextResponse.json({ error: seedErr.message }, { status: 500 })
      return NextResponse.json(seeded ?? [])
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[/api/tracker/groups GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/tracker/groups
 * Creates a new group.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const body = await req.json()
    const { name, color = '#6B7EFF', position = 99 } = body

    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

    const { data, error } = await supabase
      .from('tracker_groups')
      .insert({ name, color, position, org_id: user.org_id })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('[/api/tracker/groups POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
