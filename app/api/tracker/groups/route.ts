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

const ENTITY_SEEDS: Record<string, { name: string; color: string; position: number }[]> = {
  work_order: [
    { name: 'Phases',       color: '#6B7EFF', position: 0 },
    { name: 'Issues',       color: '#ef4444', position: 1 },
    { name: 'Parts Needed', color: '#f59e0b', position: 2 },
  ],
  opportunity: [
    { name: 'Deal Steps',   color: '#10b981', position: 0 },
    { name: 'Action Items', color: '#6B7EFF', position: 1 },
    { name: 'Blockers',     color: '#ef4444', position: 2 },
  ],
  site: [
    { name: 'Open Tasks',  color: '#6B7EFF', position: 0 },
    { name: 'In Progress', color: '#f59e0b', position: 1 },
    { name: 'Completed',   color: '#10b981', position: 2 },
  ],
  lead: [
    { name: 'Research',   color: '#8b5cf6', position: 0 },
    { name: 'Outreach',   color: '#6B7EFF', position: 1 },
    { name: 'Follow-Up',  color: '#f59e0b', position: 2 },
  ],
  dealer: [
    { name: 'Setup Tasks', color: '#6B7EFF', position: 0 },
    { name: 'Documents',   color: '#8b5cf6', position: 1 },
    { name: 'Training',    color: '#10b981', position: 2 },
  ],
  quote: [
    { name: 'Approval Steps', color: '#10b981', position: 0 },
    { name: 'Procurement',    color: '#f59e0b', position: 1 },
    { name: 'Install Prep',   color: '#6B7EFF', position: 2 },
  ],
}

/**
 * GET /api/tracker/groups
 * Returns groups for the caller's org or a specific entity.
 * Query params:
 *   entity_type — e.g. "opportunity", "work_order", "site", "lead", "dealer", "quote"
 *   entity_id   — UUID of the entity
 * When entity params present: returns groups linked to that entity (auto-seeds on first call).
 * When absent: returns org-level groups (standalone board), excludes entity-linked groups.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const { searchParams } = new URL(req.url)
    const entity_type = searchParams.get('entity_type')
    const entity_id   = searchParams.get('entity_id')

    const isEntityBoard = !!(entity_type && entity_id)

    let query = supabase
      .from('tracker_groups')
      .select('*')
      .order('position', { ascending: true })

    if (isEntityBoard) {
      query = query
        .eq('entity_type', entity_type)
        .eq('entity_id', entity_id)
    } else {
      query = query
        .eq('org_id', user.org_id ?? '00000000-0000-0000-0000-000000000000')
        .is('entity_type', null)
    }

    const { data, error } = await query

    if (error) {
      if (error.code === '42P01') return NextResponse.json([])
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Auto-seed defaults on first use
    if (!data || data.length === 0) {
      const seeds = isEntityBoard
        ? (ENTITY_SEEDS[entity_type!] ?? DEFAULT_GROUPS).map(g => ({
            ...g,
            entity_type,
            entity_id,
            org_id: null,
          }))
        : DEFAULT_GROUPS.map(g => ({ ...g, org_id: user.org_id }))

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
 * Body params:
 *   name, color, position
 *   entity_type, entity_id — optional; when provided, links to entity (org_id set to null)
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const body = await req.json()
    const { name, color = '#6B7EFF', position = 99, entity_type, entity_id } = body

    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

    const isEntityBoard = !!(entity_type && entity_id)

    const { data, error } = await supabase
      .from('tracker_groups')
      .insert({
        name,
        color,
        position,
        org_id:      isEntityBoard ? null : user.org_id,
        entity_type: entity_type ?? null,
        entity_id:   entity_id   ?? null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('[/api/tracker/groups POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
