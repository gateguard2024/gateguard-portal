import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/calendar/google/callback
// Handles Google OAuth callback, exchanges code for tokens, stores refresh_token
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code    = searchParams.get('code')
  const state   = searchParams.get('state')
  const errorParam = searchParams.get('error')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.gateguard.co'

  if (errorParam) {
    return NextResponse.redirect(`${appUrl}/calendar?error=google_denied`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/calendar?error=missing_params`)
  }

  const clientId     = process.env.GOOGLE_CALENDAR_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET
  const redirectUri  = process.env.GOOGLE_CALENDAR_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(`${appUrl}/calendar?error=not_configured`)
  }

  // Decode state to get user_id
  let userId: string
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString())
    userId = decoded.user_id
    if (!userId) throw new Error('No user_id in state')
  } catch {
    return NextResponse.redirect(`${appUrl}/calendar?error=invalid_state`)
  }

  // Exchange code for tokens
  let refreshToken: string
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code',
      }).toString(),
    })

    if (!tokenRes.ok) {
      const text = await tokenRes.text()
      console.error('Google token exchange failed:', text)
      return NextResponse.redirect(`${appUrl}/calendar?error=token_exchange_failed`)
    }

    const tokenData = await tokenRes.json() as { refresh_token?: string; access_token?: string }
    refreshToken = tokenData.refresh_token ?? ''

    if (!refreshToken) {
      return NextResponse.redirect(`${appUrl}/calendar?error=no_refresh_token`)
    }
  } catch (err) {
    console.error('Google OAuth callback error:', err)
    return NextResponse.redirect(`${appUrl}/calendar?error=exception`)
  }

  // Store refresh_token in user_settings table
  // user_settings: user_id text, key text, value text, PRIMARY KEY (user_id, key)
  const { error: upsertError } = await supabase
    .from('user_settings')
    .upsert(
      { user_id: userId, key: 'google_calendar_refresh_token', value: refreshToken },
      { onConflict: 'user_id,key' }
    )

  if (upsertError) {
    console.error('Failed to store Google refresh token:', upsertError)
    return NextResponse.redirect(`${appUrl}/calendar?error=storage_failed`)
  }

  // Also store last_synced_at
  void (async () => {
    try {
      await supabase
        .from('user_settings')
        .upsert(
          { user_id: userId, key: 'google_calendar_last_synced', value: new Date().toISOString() },
          { onConflict: 'user_id,key' }
        )
    } catch (_) { /* non-blocking */ }
  })()

  return NextResponse.redirect(`${appUrl}/calendar?connected=true`)
}
