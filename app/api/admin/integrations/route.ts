/**
 * GET /api/admin/integrations?q=&filter=all|unconnected
 * Corporate console: every site + its per-vendor connection status. Corporate
 * only — this is the behind-the-scenes setup surface for dealer sites.
 * Returns status only (never secrets).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { SITE_VENDORS } from '@/lib/site-integrations'

export const dynamic = 'force-dynamic'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user.isCorporate) return NextResponse.json({ error: 'Corporate only' }, { status: 403 })

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  const filter = req.nextUrl.searchParams.get('filter') ?? 'all'

  let siteQuery = supabase.from('sites').select('id, name, city, state, org_id').order('name').limit(500)
  if (q) siteQuery = siteQuery.or(`name.ilike.%${q}%,city.ilike.%${q}%`)
  const { data: sites, error } = await siteQuery
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const siteIds = (sites ?? []).map(s => s.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bySite = new Map<string, Record<string, any>>()
  if (siteIds.length) {
    const { data: rows } = await supabase.from('site_integrations').select('site_id, vendor, credentials_enc, status').in('site_id', siteIds)
    ;(rows ?? []).forEach((r: Record<string, unknown>) => {
      const k = String(r.site_id)
      if (!bySite.has(k)) bySite.set(k, {})
      bySite.get(k)![String(r.vendor)] = { configured: !!r.credentials_enc, status: r.status ?? null }
    })
  }

  let out = (sites ?? []).map(s => {
    const vmap = bySite.get(s.id) ?? {}
    const vendors = Object.fromEntries(SITE_VENDORS.map(v => [v, vmap[v] ?? { configured: false, status: null }]))
    const connected = SITE_VENDORS.filter(v => vendors[v].configured).length
    return { id: s.id, name: s.name, city: s.city, state: s.state, vendors, connected, total: SITE_VENDORS.length }
  })
  if (filter === 'unconnected') out = out.filter(s => s.connected === 0)

  return NextResponse.json({ sites: out, vendors: SITE_VENDORS })
}
