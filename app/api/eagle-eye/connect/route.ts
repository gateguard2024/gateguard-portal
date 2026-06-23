/**
 * GET /api/eagle-eye/connect?site_id=<site>
 * Corporate-only. Starts the Eagle Eye v3 OAuth flow: reads the site's stored
 * client_id and redirects to Eagle Eye's authorize page. The callback finishes
 * it. redirect_uri = <origin>/api/eagle-eye/callback (register this in the EEN app).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { getSiteVendorCreds } from '@/lib/site-integrations'
import { eagleEyeAuthorizeUrl, eagleEyeRedirectUri } from '@/lib/eagle-eye'
import { signState } from '@/lib/crypto-creds'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user.isCorporate) return NextResponse.json({ error: 'Corporate only' }, { status: 403 })
  const siteId = req.nextUrl.searchParams.get('site_id') ?? ''
  if (!siteId) return NextResponse.json({ error: 'site_id required' }, { status: 400 })

  const creds = await getSiteVendorCreds(siteId, 'eagle_eye')
  if (!creds?.client_id) return NextResponse.json({ error: 'Save the Eagle Eye client ID + secret first.' }, { status: 400 })

  const redirectUri = eagleEyeRedirectUri(req.nextUrl.origin)
  const url = eagleEyeAuthorizeUrl(creds.client_id, redirectUri, signState(siteId))

  // ?debug=1 → show exactly what we're sending so you can register the EXACT
  // redirect_uri in the Eagle Eye application (this value must match character-for-character).
  if (req.nextUrl.searchParams.get('debug') === '1') {
    return NextResponse.json({
      redirect_uri: redirectUri,
      register_this_in_eagle_eye: redirectUri,
      base_source: process.env.EEN_REDIRECT_BASE ? 'EEN_REDIRECT_BASE' : process.env.NEXT_PUBLIC_APP_URL ? 'NEXT_PUBLIC_APP_URL' : 'request_origin (NOT STABLE — set EEN_REDIRECT_BASE)',
      request_origin: req.nextUrl.origin,
      authorize_url: url,
      client_id_present: !!creds.client_id,
    })
  }
  return NextResponse.redirect(url)
}
