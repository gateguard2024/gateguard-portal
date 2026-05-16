import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// GET /api/cron/pm-schedules — called by Vercel cron at 06:00 daily
// Finds overdue PM schedules, creates work orders, advances next_due_at
export async function GET(req: NextRequest) {
  // Verify CRON_SECRET
  const authHeader = req.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date().toISOString()

  // 1. Find all active schedules that are due
  const { data: schedules, error: fetchError } = await supabase
    .from('pm_schedules')
    .select('id, org_id, site_id, title, description, interval_days, next_due_at')
    .eq('is_active', true)
    .lte('next_due_at', now)

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!schedules || schedules.length === 0) {
    return NextResponse.json({ generated: 0 })
  }

  let generated = 0

  for (const schedule of schedules) {
    // 2. Fetch site name for the work order customer_name field
    let siteName = schedule.site_id
    try {
      const { data: site } = await supabase
        .from('sites')
        .select('name')
        .eq('id', schedule.site_id)
        .single()
      if (site?.name) siteName = site.name
    } catch (_) { /* non-blocking — fall back to site_id */ }

    // 3. Create a work order
    const woNumber = 'PM-' + Date.now().toString(36).toUpperCase()
    const scheduledDate = schedule.next_due_at
      ? schedule.next_due_at.slice(0, 10) // date part only
      : new Date().toISOString().slice(0, 10)

    const { error: woError } = await supabase
      .from('work_orders')
      .insert({
        wo_number:      woNumber,
        title:          schedule.title,
        customer_name:  siteName,
        job_type:       'PM',
        priority:       'medium',
        status:         'open',
        scheduled_date: scheduledDate,
        notes:          `Auto-generated from PM schedule: ${schedule.description ?? ''}`.trim(),
        site_id:        schedule.site_id,
        org_id:         schedule.org_id,
      })

    if (woError) {
      // Log but continue processing other schedules
      console.error(`[cron/pm-schedules] Failed to create WO for schedule ${schedule.id}:`, woError.message)
      continue
    }

    // 4. Advance the schedule
    const nextDue = new Date(schedule.next_due_at)
    nextDue.setDate(nextDue.getDate() + schedule.interval_days)

    void (async () => {
      try {
        await supabase
          .from('pm_schedules')
          .update({
            last_generated_at: now,
            next_due_at:       nextDue.toISOString(),
            updated_at:        now,
          })
          .eq('id', schedule.id)
      } catch (_) { /* non-blocking */ }
    })()

    generated++
  }

  return NextResponse.json({ generated })
}
