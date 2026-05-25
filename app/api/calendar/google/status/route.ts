import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/calendar/google/status
export async function GET() {
  try {
    const user = await getCurrentUser()

    // Read from dedicated columns (migration 053 schema)
    const { data: row } = await supabase
      .from('user_settings')
      .select('gcal_refresh_token, gcal_last_synced_at, gcal_connected_at')
      .eq('user_id', user.id)
      .single()

    const connected   = !!(row?.gcal_refresh_token)
    const last_synced = row?.gcal_last_synced_at ?? null

    return NextResponse.json({ connected, last_synced })
  } catch {
    return NextResponse.json({ connected: false, last_synced: null })
  }
}
