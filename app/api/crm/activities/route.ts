import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

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

    // Today's cross-table items (work orders, quotes, leads created today)
    const todayISO = new Date()
    todayISO.setHours(0, 0, 0, 0)
    const todayStr = todayISO.toISOString()

    const [woResult, quotesResult, leadsResult] = await Promise.allSettled([
      supabase
        .from('work_orders')
        .select('id, title, status, created_at')
        .gte('created_at', todayStr)
        .limit(5),
      supabase
        .from('quotes')
        .select('id, title, status, updated_at')
        .gte('updated_at', todayStr)
        .in('status', ['sent', 'approved'])
        .limit(5),
      supabase
        .from('show_leads')
        .select('id, name, property_name, created_at')
        .gte('created_at', todayStr)
        .limit(5),
    ])

    const woItems = woResult.status === 'fulfilled' && !woResult.value.error
      ? (woResult.value.data ?? []).map((r: any) => ({
          id: `wo_${r.id}`,
          type: 'work_order' as const,
          subject: r.title ?? `Work Order #${r.id}`,
          created_at: r.created_at,
          due_at: r.created_at,
          completed_at: null,
          opportunity_id: null,
          opportunity_name: null,
        }))
      : []

    const quoteItems = quotesResult.status === 'fulfilled' && !quotesResult.value.error
      ? (quotesResult.value.data ?? []).map((r: any) => ({
          id: `quote_${r.id}`,
          type: 'quote' as const,
          subject: r.title ? `Quote ${r.status}: ${r.title}` : `Quote ${r.status}`,
          created_at: r.updated_at,
          due_at: r.updated_at,
          completed_at: null,
          opportunity_id: null,
          opportunity_name: null,
        }))
      : []

    const leadItems = leadsResult.status === 'fulfilled' && !leadsResult.value.error
      ? (leadsResult.value.data ?? []).map((r: any) => ({
          id: `lead_${r.id}`,
          type: 'lead' as const,
          subject: `New lead: ${r.name}${r.property_name ? ` — ${r.property_name}` : ''}`,
          created_at: r.created_at,
          due_at: r.created_at,
          completed_at: null,
          opportunity_id: null,
          opportunity_name: null,
        }))
      : []

    const merged = [...activities, ...woItems, ...quoteItems, ...leadItems]
    return NextResponse.json(merged)
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

    const user = await getCurrentUser()

    const { data, error } = await supabase
      .from('crm_activities')
      .insert({
        type,
        subject,
        body: activityBody ?? null,
        due_at: due_at ?? null,
        opportunity_id: opportunity_id ?? null,
        created_by_name: user.name,
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
