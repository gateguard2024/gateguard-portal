import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

// GET /api/calendar/microsoft/connect — initiates Microsoft 365 OAuth flow
export async function GET() {
  const clientId    = process.env.MICROSOFT_CALENDAR_CLIENT_ID
  const redirectUri = process.env.MICROSOFT_CALENDAR_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'Microsoft 365 Calendar integration is not configured. Set MICROSOFT_CALENDAR_CLIENT_ID and MICROSOFT_CALENDAR_REDIRECT_URI env vars.' },
      { status: 503 }
    )
  }

  let user
  try {
    user = await getCurrentUser()
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const state = Buffer.from(JSON.stringify({ user_id: user.id })).toString('base64url')

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    response_mode: 'query',
    scope:         'https://graph.microsoft.com/Calendars.ReadWrite offline_access',
    state,
  })

  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`
  return NextResponse.redirect(authUrl)
}
