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

    const { data: tokenRow } = await supabase
      .from('user_settings')
      .select('value')
      .eq('user_id', user.id)
      .eq('key', 'google_calendar_refresh_token')
      .single()

    const connected = !!(tokenRow?.value)

    let last_synced: string | null = null
    if (connected) {
      const { data: syncRow } = await supabase
        .from('user_settings')
        .select('value')
        .eq('user_id', user.id)
        .eq('key', 'google_calendar_last_synced')
        .single()
      last_synced = syncRow?.value ?? null
    }

    return NextResponse.json({ connected, last_synced })
  } catch {
    return NextResponse.json({ connected: false, last_synced: null })
  }
}
