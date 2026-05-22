import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/assistant/alerts — returns counts for badge + briefing
// Fast endpoint — only counts, no full row data
export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0]
    const soonDate = new Date()
    soonDate.setDate(soonDate.getDate() + 7)
    const soon = soonDate.toISOString().split('T')[0]

    const [todosRes, quotesRes, wosRes, scoutOpenedRes] = await Promise.all([
      supabase
        .from('todos')
        .select('id', { count: 'exact', head: true })
        .in('status', ['open', 'in_progress'])
        .lte('due_date', today),
      supabase
        .from('quotes')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'sent')
        .not('valid_until', 'is', null)
        .lte('valid_until', soon),
      supabase
        .from('work_orders')
        .select('id', { count: 'exact', head: true })
        .in('status', ['open', 'in_progress']),
      // SCOUT: leads that opened the ARIA email but rep hasn't engaged yet
      supabase
        .from('show_leads')
        .select('id, property_name, scout_opened_at', { count: 'exact' })
        .eq('scout_status', 'opened')
        .in('stage', ['new', 'contacted'])
        .order('scout_opened_at', { ascending: false })
        .limit(5),
    ])

    const scoutOpened = scoutOpenedRes.data ?? []
    const scoutCount  = scoutOpenedRes.count ?? 0

    return NextResponse.json({
      overdue_todos:      todosRes.count  ?? 0,
      expiring_quotes:    quotesRes.count ?? 0,
      open_wos:           wosRes.count    ?? 0,
      scout_opened:       scoutCount,
      scout_opened_leads: scoutOpened.map((l: any) => ({
        id:            `show_${l.id}`,
        property_name: l.property_name,
        opened_at:     l.scout_opened_at,
      })),
      total: (todosRes.count ?? 0) + (quotesRes.count ?? 0) + (wosRes.count ?? 0) + scoutCount,
    })
  } catch {
    return NextResponse.json({
      overdue_todos: 0, expiring_quotes: 0, open_wos: 0,
      scout_opened: 0, scout_opened_leads: [], total: 0,
    })
  }
}
