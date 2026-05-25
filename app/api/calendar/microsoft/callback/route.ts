import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/calendar/microsoft/callback — handles Microsoft OAuth callback
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code       = searchParams.get('code')
  const state      = searchParams.get('state')
  const errorParam = searchParams.get('error')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.gateguard.co'

  if (errorParam) return NextResponse.redirect(`${appUrl}/calendar?error=ms_denied`)
  if (!code || !state) return NextResponse.redirect(`${appUrl}/calendar?error=ms_missing_params`)

  const clientId     = process.env.MICROSOFT_CALENDAR_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CALENDAR_CLIENT_SECRET
  const redirectUri  = process.env.MICROSOFT_CALENDAR_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(`${appUrl}/calendar?error=ms_not_configured`)
  }

  let userId: string
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString())
    userId = decoded.user_id
    if (!userId) throw new Error('No user_id')
  } catch {
    return NextResponse.redirect(`${appUrl}/calendar?error=ms_invalid_state`)
  }

  // Exchange code for tokens
  let refreshToken: string
  try {
    const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code',
        scope:         'https://graph.microsoft.com/Calendars.ReadWrite offline_access',
      }).toString(),
    })

    if (!tokenRes.ok) {
      console.error('MS token exchange failed:', await tokenRes.text())
      return NextResponse.redirect(`${appUrl}/calendar?error=ms_token_exchange_failed`)
    }

    const tokenData = await tokenRes.json() as { refresh_token?: string }
    refreshToken = tokenData.refresh_token ?? ''
    if (!refreshToken) return NextResponse.redirect(`${appUrl}/calendar?error=ms_no_refresh_token`)
  } catch (err) {
    console.error('MS OAuth callback error:', err)
    return NextResponse.redirect(`${appUrl}/calendar?error=ms_exception`)
  }

  const now = new Date().toISOString()
  const { error: upsertError } = await supabase
    .from('user_settings')
    .upsert(
      { user_id: userId, ms_refresh_token: refreshToken, ms_connected_at: now, ms_last_synced_at: now },
      { onConflict: 'user_id' }
    )

  if (upsertError) {
    console.error('Failed to store MS refresh token:', upsertError)
    return NextResponse.redirect(`${appUrl}/calendar?error=ms_storage_failed`)
  }

  return NextResponse.redirect(`${appUrl}/calendar?ms_connected=true`)
}
