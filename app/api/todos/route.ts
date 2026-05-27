/**
 * GET  /api/todos  — list todos for current user (mine + assigned to me), with attachments
 * POST /api/todos  — create a todo
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const caller = await getCurrentUser()
    const { searchParams } = new URL(req.url)
    const view        = searchParams.get('view') ?? 'mine'
    const status      = searchParams.get('status')
    const unscheduled = searchParams.get('unscheduled') === 'true'
    const limit       = parseInt(searchParams.get('limit') ?? '200', 10)

    let query = supabase
      .from('todos')
      .select(`*, todo_attachments(id, name, url, size_bytes, mime_type, created_at)`)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (view === 'mine') {
      query = query.or(`created_by.eq.${caller.id},assigned_to.eq.${caller.id}`)
    } else if (view === 'assigned') {
      query = query
        .eq('created_by', caller.id)
        .not('assigned_to', 'is', null)
        .neq('assigned_to', caller.id)
    } else {
      query = query.or(`created_by.eq.${caller.id},assigned_to.eq.${caller.id}`)
    }

    if (status) query = query.eq('status', status)

    // unscheduled=true → only todos without a due_date
    if (unscheduled) query = query.is('due_date', null)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Return both keys so callers expecting either shape work
    return NextResponse.json({ todos: data ?? [], records: data ?? [] })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getCurrentUser()
    const body   = await req.json()
    const {
      title,
      body: todoBody,
      priority = 'normal',
      due_date,
      assigned_to,
      assigned_to_name,
      linked_type,
      linked_id,
      linked_label,
      recurrence_type    = 'none',
      recurrence_interval = 1,
      recurrence_ends_at,
    } = body

    if (!title?.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('todos')
      .insert({
        title: title.trim(),
        body:  todoBody ?? null,
        priority,
        status: 'open',
        due_date:           due_date ?? null,
        org_id:             caller.org_id ?? null,
        created_by:         caller.id,
        created_by_name:    caller.name,
        assigned_to:        assigned_to ?? null,
        assigned_to_name:   assigned_to_name ?? null,
        linked_type:        linked_type ?? null,
        linked_id:          linked_id ?? null,
        linked_label:       linked_label ?? null,
        recurrence_type:    recurrence_type,
        recurrence_interval: recurrence_interval,
        recurrence_ends_at: recurrence_ends_at ?? null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
