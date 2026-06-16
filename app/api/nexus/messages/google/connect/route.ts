import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

// GET /api/nexus/messages/google/connect
// Starts the Google OAuth flow for a Gmail send/read connector. Reuses the same
// Google OAuth client as Calendar; a Gmail-specific redirect URI keeps the
// callbacks separate. Set GMAIL_REDIRECT_URI (or it falls back to the app URL).
export async function GET(req: Request) {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID
  // Derive the callback from the host the user is actually on, so the round-trip
  // stays on that domain (the Vercel beta URL or portal.gateguard.co for prod).
  // The matching URI just needs to be registered in Google Cloud.
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? new URL(req.url).host
  const redirectUri = `${proto}://${host}/api/nexus/messages/google/callback`

  if (!clientId) {
    return NextResponse.json(
      { error: 'Google OAuth is not configured. Set GOOGLE_CALENDAR_CLIENT_ID.' },
      { status: 503 },
    )
  }

  let user
  try {
    user = await getCurrentUser()
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const state = Buffer.from(JSON.stringify({ user_id: user.id, org_id: user.org_id })).toString('base64url')

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    // Send + read-only inbox; openid/email so we can capture the connected address.
    scope: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  })

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
}
