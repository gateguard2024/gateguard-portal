import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/maintenance — list work orders
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status   = searchParams.get('status')
  const priority = searchParams.get('priority')
  const assignee = searchParams.get('assignee_id')
  const q        = searchParams.get('q')

  let query = supabase
    .from('work_orders')
    .select(`
      id, wo_number, title, description, customer_name,
      assignee_id, assignee_name, priority, status, job_type,
      scheduled_date, due_date, completed_at, notes,
      created_at, updated_at
    `)
    .order('created_at', { ascending: false })

  if (status)   query = query.eq('status', status)
  if (priority) query = query.eq('priority', priority)
  if (assignee) query = query.eq('assignee_id', assignee)
  if (q)        query = query.or(`title.ilike.%${q}%,customer_name.ilike.%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ work_orders: data ?? [] })
}

// POST /api/maintenance — create work order
export async function POST(req: NextRequest) {
  const body = await req.json()

  const {
    title, description, customer_name, assignee_id, assignee_name,
    priority = 'medium', status = 'open', job_type = 'Repair',
    scheduled_date, due_date, notes,
  } = body

  if (!title || !customer_name) {
    return NextResponse.json({ error: 'title and customer_name are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('work_orders')
    .insert({
      title, description, customer_name,
      assignee_id: assignee_id || null,
      assignee_name: assignee_name || null,
      priority, status, job_type,
      scheduled_date: scheduled_date || null,
      due_date: due_date || null,
      notes: notes || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ work_order: data }, { status: 201 })
}
