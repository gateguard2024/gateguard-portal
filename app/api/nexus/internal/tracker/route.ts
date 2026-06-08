import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type TrackerBucket = 'today' | 'blocked' | 'bugs' | 'next_up'

type TodoRow = {
  id: string
  title: string
  body?: string | null
  priority?: string | null
  status?: string | null
  due_date?: string | null
  linked_type?: string | null
  linked_label?: string | null
  assigned_to_name?: string | null
  created_by_name?: string | null
  created_at?: string | null
}

function isToday(dateText?: string | null) {
  if (!dateText) return false
  const today = new Date().toISOString().slice(0, 10)
  return dateText.slice(0, 10) === today
}

function bucketFor(row: TodoRow): TrackerBucket {
  const text = `${row.title ?? ''} ${row.body ?? ''} ${row.linked_type ?? ''} ${row.linked_label ?? ''}`.toLowerCase()
  const status = String(row.status ?? '').toLowerCase()
  if (status.includes('block') || text.includes('blocked') || text.includes('stuck')) return 'blocked'
  if (text.includes('bug') || text.includes('pwa') || text.includes('broken') || text.includes('error')) return 'bugs'
  if (isToday(row.due_date)) return 'today'
  return 'next_up'
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    let query = supabase
      .from('todos')
      .select('id,title,body,priority,status,due_date,linked_type,linked_label,assigned_to_name,created_by_name,created_at')
      .neq('status', 'done')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(100)

    if (!user.isCorporate && user.org_id) query = query.eq('org_id', user.org_id)

    const { data, error } = await query
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 })

    const items = ((data ?? []) as TodoRow[]).map(row => {
      const bucket = bucketFor(row)
      return {
        id: row.id,
        title: row.title,
        body: row.body ?? null,
        priority: row.priority || 'normal',
        status: row.status || 'open',
        due_date: row.due_date ?? null,
        linked_type: row.linked_type ?? null,
        linked_label: row.linked_label ?? null,
        assigned_to_name: row.assigned_to_name ?? null,
        created_by_name: row.created_by_name ?? null,
        bucket,
        urgency: bucket === 'blocked' || bucket === 'bugs' ? 'high' : bucket === 'today' ? 'medium' : 'low',
      }
    })

    return NextResponse.json({ success: true, items })
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'Could not load tracker.' }, { status: 500 })
  }
}
