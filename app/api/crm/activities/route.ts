import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/crm/activities
 * Returns upcoming + overdue activities across all opportunities.
 * Used by the CRM home page "Today's Activity" widget.
 *
 * Query params:
 *   limit  — max results (default 20)
 *   status — "open" | "completed" | "all" (default "open")
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') ?? '20', 10)
    const status = searchParams.get('status') ?? 'open'

    let query = supabase
      .from('crm_activities')
      .select(`
        id,
        type,
        subject,
        body,
        due_at,
        completed_at,
        opportunity_id,
        opportunities ( name )
      `)
      .order('due_at', { ascending: true })
      .limit(limit)

    if (status === 'open') {
      query = query.is('completed_at', null)
    } else if (status === 'completed') {
      query = query.not('completed_at', 'is', null)
    }

    const { data, error } = await query

    if (error) {
      console.error('[/api/crm/activities] Supabase error:', error)
      // If the table doesn't exist yet, return empty array gracefully
      if (error.code === '42P01') {
        return NextResponse.json([])
      }
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
    }

    const activities = (data || []).map((row: any) => ({
      id: row.id,
      type: row.type as 'call' | 'email' | 'meeting' | 'task' | 'note',
      subject: row.subject,
      body: row.body,
      due_at: row.due_at,
      completed_at: row.completed_at,
      opportunity_id: row.opportunity_id,
      opportunity_name: row.opportunities?.name ?? null,
    }))

    return NextResponse.json(activities)
  } catch (err) {
    console.error('[/api/crm/activities] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/crm/activities
 * Creates a new activity not tied to a specific opportunity (standalone tasks/reminders).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, subject, body: activityBody, due_at, opportunity_id } = body

    if (!type || !subject) {
      return NextResponse.json({ error: 'type and subject are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('crm_activities')
      .insert({
        type,
        subject,
        body: activityBody ?? null,
        due_at: due_at ?? null,
        opportunity_id: opportunity_id ?? null,
      })
      .select()
      .single()

    if (error) {
      console.error('[/api/crm/activities POST] Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('[/api/crm/activities POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
