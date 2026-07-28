import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { exchangeCodeAndSave, qboRedirectUri } from '@/lib/qbo'

export const dynamic = 'force-dynamic'

// GET /api/integrations/quickbooks/callback
// Intuit redirects here after consent with ?code, ?realmId, ?state.
// Exchanges the code for tokens, stores the connection, returns to /billing.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user.isCorporate) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const u = new URL(req.url)
  const back = `${u.origin}/billing`
  const code = u.searchParams.get('code')
  const realmId = u.searchParams.get('realmId')
  const state = u.searchParams.get('state')
  const oauthError = u.searchParams.get('error')
  const cookieState = req.cookies.get('qbo_oauth_state')?.value

  if (oauthError) return NextResponse.redirect(`${back}?qbo=error&reason=${encodeURIComponent(oauthError)}`)
  if (!code || !realmId) return NextResponse.redirect(`${back}?qbo=error&reason=missing_params`)
  if (!state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(`${back}?qbo=error&reason=state_mismatch`)
  }

  const result = await exchangeCodeAndSave(code, realmId, qboRedirectUri(u.origin), user.id)
  if (!result.ok) {
    return NextResponse.redirect(`${back}?qbo=error&reason=${encodeURIComponent(result.error)}`)
  }

  const res = NextResponse.redirect(`${back}?qbo=connected`)
  res.cookies.set('qbo_oauth_state', '', { path: '/', maxAge: 0 })
  return res
}
