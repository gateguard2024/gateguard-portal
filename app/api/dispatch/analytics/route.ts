/**
 * GET /api/dispatch/analytics?days=30
 * Tech utilization + re-work analytics for the dispatch dashboard.
 *  - per tech: jobs assigned, labor hours logged, utilization % (logged ÷ available)
 *  - org: completed, callbacks, first-time-fix %, total hours
 * Org-scoped like /api/dispatch. Read-only.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const days = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get('days') || '30', 10) || 30, 1), 180)
    const since = new Date(Date.now() - days * 86400000)
    const sinceISO = since.toISOString()

    const user = await getCurrentUser()
    const scope = await resolveOrgScope(user)

    // Work orders in range (scoped). select('*') keeps it drift-safe re: is_callback.
    let woQ = supabase.from('work_orders').select('*').gte('created_at', sinceISO)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    woQ = applyOrgScope(woQ as any, scope, 'org_id') as typeof woQ
    const { data: wos } = await woQ
    const jobs = wos ?? []

    const { data: techRows } = await supabase.from('technicians').select('id, name')
    const techs = techRows ?? []

    const { data: timeRows } = await supabase
      .from('work_order_time_entries')
      .select('technician_id, technician_name, duration_mins, clock_in')
      .gte('clock_in', sinceISO)
    const times = timeRows ?? []

    // Available capacity = weekdays in window × 8h.
    let weekdays = 0
    for (let i = 0; i < days; i++) { const d = new Date(since.getTime() + i * 86400000).getDay(); if (d !== 0 && d !== 6) weekdays++ }
    const availHours = weekdays * 8

    const perTech = techs.map(t => {
      const myJobs = jobs.filter(j => j.assignee_id === t.id)
      const mins = times.filter(e => e.technician_id === t.id || (e.technician_name && e.technician_name === t.name)).reduce((a, e) => a + (e.duration_mins ?? 0), 0)
      const hours = Math.round((mins / 60) * 10) / 10
      return {
        id: t.id, name: t.name,
        jobs: myJobs.length,
        completed: myJobs.filter(j => j.status === 'completed').length,
        hours,
        utilizationPct: availHours ? Math.round((hours / availHours) * 100) : 0,
      }
    }).sort((a, b) => b.hours - a.hours)

    const completed = jobs.filter(j => j.status === 'completed').length
    const callbacks = jobs.filter(j => j.is_callback === true).length
    const totalMins = times.reduce((a, e) => a + (e.duration_mins ?? 0), 0)
    const ftfPct = completed > 0 ? Math.round((1 - callbacks / completed) * 100) : null

    return NextResponse.json({
      days,
      perTech,
      totals: {
        jobs: jobs.length,
        completed,
        callbacks,
        ftfPct,
        hours: Math.round((totalMins / 60) * 10) / 10,
        avgUtilizationPct: perTech.length ? Math.round(perTech.reduce((a, t) => a + t.utilizationPct, 0) / perTech.length) : 0,
      },
      // recent callbacks for the list
      callbackList: jobs.filter(j => j.is_callback === true).slice(0, 20).map(j => ({ id: j.id, wo_number: j.wo_number, title: j.title, customer_name: j.customer_name, assignee_name: j.assignee_name, created_at: j.created_at })),
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'analytics failed', perTech: [], totals: {} }, { status: 200 })
  }
}
