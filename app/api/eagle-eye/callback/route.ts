/**
 * GET /api/eagle-eye/callback?code=&state=<site_id>
 * Eagle Eye redirects here after authorize. Exchange the code for tokens and
 * store them (encrypted) in the site's vault, then bounce back to the app.
 * Corporate-only (the admin's browser session carries the auth).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { getSiteVendorCreds, mergeSiteVendorCreds, markIntegrationTest } from '@/lib/site-integrations'
import { eagleEyeExchangeCode } from '@/lib/eagle-eye'
import { verifyState } from '@/lib/crypto-creds'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  const back = (ok: boolean, msg: string) => NextResponse.redirect(`${req.nextUrl.origin}/cmms?eagle_eye=${ok ? 'connected' : 'error'}&msg=${encodeURIComponent(msg)}`)
  if (!user.isCorporate) return back(false, 'Corporate only')

  const code = req.nextUrl.searchParams.get('code') ?? ''
  const siteId = verifyState(req.nextUrl.searchParams.get('state') ?? '') ?? ''
  const err = req.nextUrl.searchParams.get('error')
  if (err) return back(false, err)
  if (!code || !siteId) return back(false, 'Missing or invalid state — start the connect again.')

  try {
    const creds = await getSiteVendorCreds(siteId, 'eagle_eye')
    if (!creds?.client_id || !creds?.client_secret) return back(false, 'Eagle Eye client not configured')
    const redirectUri = `${req.nextUrl.origin}/api/eagle-eye/callback`
    const t = await eagleEyeExchangeCode(creds.client_id, creds.client_secret, code, redirectUri)
    await mergeSiteVendorCreds(siteId, 'eagle_eye', {
      access_token: t.access_token,
      refresh_token: t.refresh_token,
      expires_at: new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString(),
      base_host: t.httpsBaseUrl?.hostname ?? '',
    })
    await markIntegrationTest(siteId, 'eagle_eye', true)
    return back(true, 'Eagle Eye connected')
  } catch (e) {
    return back(false, e instanceof Error ? e.message : 'Connect failed')
  }
}
