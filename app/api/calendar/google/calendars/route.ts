import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Helper: exchange refresh token for access token ───────────────────────────
async function getAccessToken(refreshToken: string): Promise<string | null> {
  const clientId     = process.env.GOOGLE_CALENDAR_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET

  if (!clientId || !clientSecret) return null

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type:    'refresh_token',
      }).toString(),
    })

    if (!res.ok) return null
    const data = await res.json() as { access_token?: string }
    return data.access_token ?? null
  } catch {
    return null
  }
}

interface GCalListEntry {
  id: string
  summary?: string
  backgroundColor?: string
  primary?: boolean
}

// GET /api/calendar/google/calendars
// Returns the user's full calendar list + their saved selected IDs.
export async function GET() {
  try {
    const user = await getCurrentUser()

    const { data: tokenRow } = await supabase
      .from('user_settings')
      .select('value')
      .eq('user_id', user.id)
      .eq('key', 'google_calendar_refresh_token')
      .single()

    if (!tokenRow?.value) {
      return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 400 })
    }

    const accessToken = await getAccessToken(tokenRow.value)
    if (!accessToken) {
      return NextResponse.json({ error: 'Failed to refresh access token' }, { status: 401 })
    }

    // Fetch the calendar list from Google
    const listRes = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!listRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch calendar list from Google' }, { status: 502 })
    }

    const listData = await listRes.json() as { items?: GCalListEntry[] }
    const calendars = (listData.items ?? []).map((c) => ({
      id:              c.id,
      summary:         c.summary ?? c.id,
      backgroundColor: c.backgroundColor ?? '#6B7EFF',
      primary:         c.primary ?? false,
    }))

    // Read saved selected calendar IDs
    const { data: selectedRow } = await supabase
      .from('user_settings')
      .select('value')
      .eq('user_id', user.id)
      .eq('key', 'google_calendar_selected_ids')
      .single()

    let selectedIds: string[] = ['primary']
    if (selectedRow?.value) {
      try {
        selectedIds = JSON.parse(selectedRow.value) as string[]
      } catch {
        selectedIds = ['primary']
      }
    }

    return NextResponse.json({ calendars, selectedIds })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST /api/calendar/google/calendars
// Body: { selectedIds: string[] }
// Saves the user's chosen calendar IDs to sync.
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const body = await req.json() as { selectedIds?: string[] }

    const selectedIds = Array.isArray(body.selectedIds) ? body.selectedIds : ['primary']

    await supabase
      .from('user_settings')
      .upsert(
        {
          user_id: user.id,
          key:     'google_calendar_selected_ids',
          value:   JSON.stringify(selectedIds),
        },
        { onConflict: 'user_id,key' }
      )

    return NextResponse.json({ success: true, selectedIds })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
