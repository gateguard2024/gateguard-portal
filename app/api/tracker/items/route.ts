import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/tracker/items
 * Returns tracker items for the caller's org.
 * Optional query params:
 *   group_id        — filter by a single group UUID
 *   group_ids       — comma-separated list of group UUIDs (takes precedence over group_id)
 *   status          — filter by status
 *   type            — filter by type (bug/enhancement/question/task)
 *   include_subitems — "true" to include child items; default excludes them
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const { searchParams } = new URL(req.url)
    const group_id         = searchParams.get('group_id')
    const group_ids        = searchParams.get('group_ids')
    const status           = searchParams.get('status')
    const type             = searchParams.get('type')
    const include_subitems = searchParams.get('include_subitems') === 'true'

    let query = supabase
      .from('tracker_items')
      .select(`
        id, group_id, title, type, module, severity, priority, status,
        owner_name, reporter_name, date_reported, target_release,
        affected_site_id, notes, position, parent_item_id,
        created_at, updated_at
      `)
      .eq('org_id', user.org_id ?? '00000000-0000-0000-0000-000000000000')
      .order('position', { ascending: true })
      .order('created_at', { ascending: false })

    // Exclude sub-items by default
    if (!include_subitems) {
      query = query.is('parent_item_id', null)
    }

    // group_ids takes precedence over group_id
    if (group_ids) {
      const ids = group_ids.split(',').map(s => s.trim()).filter(Boolean)
      if (ids.length > 0) query = query.in('group_id', ids)
    } else if (group_id) {
      query = query.eq('group_id', group_id)
    }

    if (status) query = query.eq('status', status)
    if (type)   query = query.eq('type', type)

    const { data, error } = await query

    if (error) {
      if (error.code === '42P01') return NextResponse.json([])
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('[/api/tracker/items GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/tracker/items
 * Creates a new tracker item.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const body = await req.json()

    const {
      group_id, title, type = 'bug', module, severity, priority,
      status = 'new', owner_name, reporter_name, date_reported,
      target_release, notes, position = 0, parent_item_id,
    } = body

    if (!group_id) return NextResponse.json({ error: 'group_id is required' }, { status: 400 })
    if (!title)    return NextResponse.json({ error: 'title is required' }, { status: 400 })

    const { data, error } = await supabase
      .from('tracker_items')
      .insert({
        group_id, title, type, module: module || null,
        severity: severity || null, priority: priority || null,
        status, owner_name: owner_name || null,
        reporter_user_id: user.id !== 'system' ? user.id : null,
        reporter_name: reporter_name || user.name,
        date_reported: date_reported || new Date().toISOString().split('T')[0],
        target_release: target_release || null,
        notes: notes || null,
        position, parent_item_id: parent_item_id || null,
        org_id: user.org_id,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('[/api/tracker/items POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
