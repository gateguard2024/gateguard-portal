import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/calendar/today-count
// Returns { count: number } — to-dos due today + WOs scheduled today
export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0]

    const [todosRes, wosRes] = await Promise.all([
      supabase
        .from('todos')
        .select('id', { count: 'exact', head: true })
        .eq('due_date', today)
        .in('status', ['open', 'in_progress']),
      supabase
        .from('work_orders')
        .select('id', { count: 'exact', head: true })
        .eq('scheduled_date', today)
        .in('status', ['open', 'assigned', 'in_progress']),
    ])

    const count = (todosRes.count ?? 0) + (wosRes.count ?? 0)
    return NextResponse.json({ count })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}
