import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// GET /api/nexus/messages/google/callback
// Exchanges the OAuth code for tokens and upserts a Gmail connector row in
// message_channels for the authorizing user.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const errorParam = searchParams.get('error')

  // Same-origin as the connect request, so the round-trip works on whatever
  // domain the user is on (Vercel beta URL, prod, or a custom domain).
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? new URL(req.url).host
  const appUrl = `${proto}://${host}`
  const back = (q: string) => NextResponse.redirect(`${appUrl}/?view=messages&${q}`)

  if (errorParam) return back('gmail_error=denied')
  if (!code || !state) return back('gmail_error=missing_params')

  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET
  // MUST exactly match the redirect_uri the connect step sent to Google (derived
  // from the request host). A stale GMAIL_REDIRECT_URI would cause a second
  // redirect_uri_mismatch at token exchange — so always use the same derivation.
  const redirectUri = `${appUrl}/api/nexus/messages/google/callback`
  if (!clientId || !clientSecret) return back('gmail_error=not_configured')

  let userId: string
  let orgId: string | null = null
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString())
    userId = decoded.user_id
    orgId = decoded.org_id ?? null
    if (!userId) throw new Error('no user_id')
  } catch {
    return back('gmail_error=invalid_state')
  }

  // Exchange code → tokens.
  let refreshToken = ''
  let accessToken = ''
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    })
    if (!tokenRes.ok) {
      console.error('Gmail token exchange failed:', await tokenRes.text())
      return back('gmail_error=token_exchange_failed')
    }
    const data = (await tokenRes.json()) as { refresh_token?: string; access_token?: string; scope?: string }
    refreshToken = data.refresh_token ?? ''
    accessToken = data.access_token ?? ''
    if (!refreshToken) return back('gmail_error=no_refresh_token')
  } catch (err) {
    console.error('Gmail OAuth callback error:', err)
    return back('gmail_error=exception')
  }

  // Resolve the connected email address.
  let email = ''
  try {
    const meRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (meRes.ok) email = ((await meRes.json()) as { email?: string }).email ?? ''
  } catch {
    /* non-fatal */
  }

  // One Gmail connector per (user, address): update if it exists, else insert.
  const { data: existing } = await supabase
    .from('message_channels')
    .select('id')
    .eq('user_id', userId)
    .eq('channel_type', 'gmail')
    .eq('display_name', email || 'Gmail')
    .maybeSingle()

  const now = new Date().toISOString()
  const payload = {
    user_id: userId,
    org_id: orgId,
    channel_type: 'gmail' as const,
    display_name: email || 'Gmail',
    is_active: true,
    oauth_refresh_token: refreshToken,
    oauth_access_token: accessToken || null,
    oauth_scope: 'gmail.send gmail.readonly',
    config: { from_address: email },
    last_synced_at: now,
  }

  const { error: upErr } = existing
    ? await supabase.from('message_channels').update(payload).eq('id', existing.id)
    : await supabase.from('message_channels').insert(payload)

  if (upErr) {
    console.error('Failed to store Gmail connector:', upErr)
    return back('gmail_error=storage_failed')
  }

  return back('gmail_connected=true')
}
