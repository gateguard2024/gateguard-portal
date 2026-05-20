import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

// GET /api/calendar/google/connect
// Initiates Google OAuth 2.0 flow for Calendar access
export async function GET() {
  const clientId    = process.env.GOOGLE_CALENDAR_CLIENT_ID
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'Google Calendar integration is not configured. Set GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_REDIRECT_URI env vars.' },
      { status: 503 }
    )
  }

  let user
  try {
    user = await getCurrentUser()
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Encode user ID in state for callback matching
  const state = Buffer.from(JSON.stringify({ user_id: user.id })).toString('base64url')

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         'https://www.googleapis.com/auth/calendar',
    access_type:   'offline',
    prompt:        'consent',
    state,
  })

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  return NextResponse.redirect(authUrl)
}
