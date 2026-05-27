import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/calendar/google/status
// Returns { connected: boolean, last_synced: string | null }
export async function GET() {
  try {
    const user = await getCurrentUser()

    // user_settings is a structured table (one row per user, not key-value).
    // Columns: gcal_refresh_token, gcal_last_synced_at
    const { data: settingsRow } = await supabase
      .from('user_settings')
      .select('gcal_refresh_token, gcal_last_synced_at')
      .eq('user_id', user.id)
      .maybeSingle()

    const connected = !!(settingsRow?.gcal_refresh_token)
    const last_synced = settingsRow?.gcal_last_synced_at ?? null

    return NextResponse.json({ connected, last_synced })
  } catch {
    return NextResponse.json({ connected: false, last_synced: null })
  }
}
