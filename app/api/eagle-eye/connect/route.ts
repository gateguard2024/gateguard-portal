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
  const redirectUri = eagleEyeRedirectUri(req.nextUrl.origin)

  // ?debug=1 → diagnostics, even when creds are missing, so you can see the exact
  // redirect_uri to register in EEN AND whether this site actually has creds saved.
  if (req.nextUrl.searchParams.get('debug') === '1') {
    return NextResponse.json({
      site_id: siteId,
      site_id_looks_like_uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(siteId),
      client_id_present: !!creds?.client_id,
      register_this_in_eagle_eye: redirectUri,
      base_source: process.env.EEN_REDIRECT_BASE ? 'EEN_REDIRECT_BASE' : process.env.NEXT_PUBLIC_APP_URL ? 'NEXT_PUBLIC_APP_URL' : 'request_origin (NOT STABLE — set EEN_REDIRECT_BASE)',
      request_origin: req.nextUrl.origin,
      next_step: !creds?.client_id ? 'No Eagle Eye client_id saved for this site_id. Use the real site UUID and save the client ID/secret on its Setup tab.' : 'Creds OK — register register_this_in_eagle_eye in the EEN app, then connect.',
    })
  }

  if (!creds?.client_id) return NextResponse.json({ error: 'Save the Eagle Eye client ID + secret first.' }, { status: 400 })
  const url = eagleEyeAuthorizeUrl(creds.client_id, redirectUri, signState(siteId))
  return NextResponse.redirect(url)
}
