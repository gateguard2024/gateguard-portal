import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { syncUserCalendar } from '@/lib/gcal-sync'

export const dynamic = 'force-dynamic'

// POST /api/calendar/google/sync — bidirectional sync for the current user.
// PULL Google events → gcal_events; PUSH todos + work orders + calendar_events → Google.
export async function POST() {
  try {
    const user = await getCurrentUser()
    const r = await syncUserCalendar(user.id)
    if (!r.ok) {
      const status = r.error === 'not connected' ? 400 : 401
      return NextResponse.json({ error: r.error ?? 'sync failed', diagnostics: r.diagnostics }, { status })
    }
    return NextResponse.json({
      success: true, pulled: r.pulled, pull_errors: r.pull_errors,
      pushed: r.pushed, push_errors: r.push_errors, synced_at: new Date().toISOString(), diagnostics: r.diagnostics,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
