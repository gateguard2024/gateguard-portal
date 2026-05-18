/**
 * GET  /api/todos  — list todos for current user (mine + assigned to me)
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
    const view   = searchParams.get('view') ?? 'mine'   // mine | assigned | all
    const status = searchParams.get('status')            // open | in_progress | done | null=all

    let query = supabase
      .from('todos')
      .select('*')
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (view === 'mine') {
      // Todos I created OR that are assigned to me
      query = query.or(`created_by.eq.${caller.id},assigned_to.eq.${caller.id}`)
    } else if (view === 'assigned') {
      // Todos I assigned to others (I created, but not assigned to myself)
      query = query
        .eq('created_by', caller.id)
        .not('assigned_to', 'is', null)
        .neq('assigned_to', caller.id)
    } else if (view === 'all' && caller.isCorporate) {
      // Corporate can see org-wide todos
      if (caller.org_id) query = query.eq('org_id', caller.org_id)
    } else {
      query = query.or(`created_by.eq.${caller.id},assigned_to.eq.${caller.id}`)
    }

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ todos: data ?? [] })
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
        due_date:          due_date ?? null,
        org_id:            caller.org_id ?? null,
        created_by:        caller.id,
        created_by_name:   caller.name,
        assigned_to:       assigned_to ?? null,
        assigned_to_name:  assigned_to_name ?? null,
        linked_type:       linked_type ?? null,
        linked_id:         linked_id ?? null,
        linked_label:      linked_label ?? null,
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
