import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { exchangeCodeAndSave, getQboAuth, qboJson, qboRedirectUri } from '@/lib/qbo'
import { qdb } from '@/lib/qbo-sync'
import { todayET } from '@/lib/tz'

export const dynamic = 'force-dynamic'

// GET /api/integrations/quickbooks/callback
// Intuit redirects here after consent with ?code, ?realmId, ?state.
// Exchanges the code for tokens, stores the connection, returns to the QuickBooks page.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user.isCorporate) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const u = new URL(req.url)
  const back = `${u.origin}/?view=admin&qb=1`
  const code = u.searchParams.get('code')
  const realmId = u.searchParams.get('realmId')
  const state = u.searchParams.get('state')
  const oauthError = u.searchParams.get('error')
  const cookieState = req.cookies.get('qbo_oauth_state')?.value

  if (oauthError) return NextResponse.redirect(`${back}&qbo=error&qbreason=${encodeURIComponent(oauthError)}`)
  if (!code || !realmId) return NextResponse.redirect(`${back}&qbo=error&qbreason=missing_params`)
  if (!state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(`${back}&qbo=error&qbreason=state_mismatch`)
  }

  const result = await exchangeCodeAndSave(code, realmId, qboRedirectUri(u.origin), user.id)
  if (!result.ok) {
    return NextResponse.redirect(`${back}&qbo=error&qbreason=${encodeURIComponent(result.error)}`)
  }

  // Remember the company name, and default the sync start date to today so no
  // older invoice is ever sent unless someone picks an earlier date on purpose.
  const auth = await getQboAuth()
  if (auth.ok) {
    const info = await qboJson<{ CompanyInfo?: { CompanyName?: string } }>(auth, `/companyinfo/${auth.realmId}`)
    if (info.ok && info.data.CompanyInfo?.CompanyName) {
      const { error } = await qdb().from('qbo_connection').update({ company_name: info.data.CompanyInfo.CompanyName }).eq('realm_id', realmId)
      if (error) console.error('[qbo/callback] company name save failed', error.message)
    }
  }
  const { data: st } = await qdb().from('qbo_settings').select('sync_start_date').eq('id', 1).maybeSingle()
  if (!st?.sync_start_date) {
    const { error } = await qdb().from('qbo_settings').upsert({ id: 1, sync_start_date: todayET() }, { onConflict: 'id' })
    if (error) console.error('[qbo/callback] start date save failed', error.message)
  }

  const res = NextResponse.redirect(`${back}&qbo=connected`)
  res.cookies.set('qbo_oauth_state', '', { path: '/', maxAge: 0 })
  return res
}
