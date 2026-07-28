import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getCurrentUser } from '@/lib/current-user'
import { qboAuthorizeUrl, qboRedirectUri } from '@/lib/qbo'

export const dynamic = 'force-dynamic'

// GET /api/integrations/quickbooks/connect
// Corporate-only. Kicks off Intuit OAuth2: redirects the browser to QuickBooks'
// consent screen. On approval Intuit redirects back to /callback with a code.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user.isCorporate) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!process.env.QBO_CLIENT_ID) {
    return NextResponse.json({ error: 'QBO_CLIENT_ID is not set' }, { status: 500 })
  }

  const origin = new URL(req.url).origin
  const redirectUri = qboRedirectUri(origin)
  if (!redirectUri) {
    return NextResponse.json({ error: 'QBO redirect URI could not be resolved' }, { status: 500 })
  }

  const state = crypto.randomUUID()
  const res = NextResponse.redirect(qboAuthorizeUrl(redirectUri, state))
  // CSRF guard — validated in the callback.
  res.cookies.set('qbo_oauth_state', state, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 600,
  })
  return res
}
