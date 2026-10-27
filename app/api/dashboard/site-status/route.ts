/**
 * GET /api/dashboard/site-status
 *
 * Role-scoped site overview for the My Day "Site Status" module.
 * - Corporate: all sites; may narrow to one dealer with ?dealer=<org_id>.
 * - Dealer:    only their sites (applyOrgScope 3-FK), no dealer filter.
 *
 * Counts + a short list come from the `sites` table (cheap, always available).
 * LIVE camera/gate uptime is NOT computed here — that needs a cached per-site
 * health layer (follow-up) so the dashboard never fires 42× Eagle Eye/Brivo calls
 * on load. `health` here is derived from site.status so the ring is meaningful today.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// Site.status → health bucket for the ring.
function bucket(status: string | null): 'ok' | 'watch' | 'down' {
  const s = String(status ?? '').toLowerCase()
  if (s === 'active') return 'ok'
  if (s === 'prospect' || s === 'inactive') return 'watch'
  return 'down' // churned / unknown
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    const scope = await resolveOrgScope(user)
    const dealerParam = new URL(req.url).searchParams.get('dealer')

    let q = supabase
      .from('sites')
      .select('id, name, city, state, status, units, master_dealer_id, install_dealer_id, service_dealer_id')
      .order('name', { ascending: true })

    // Scope: corporate sees all; everyone else is limited to sites where any of
    // the three dealer FKs is in their org scope.
    if (!scope.all) {
      const ids = scope.ids.length ? scope.ids : ['00000000-0000-0000-0000-000000000000']
      const list = ids.join(',')
      q = q.or(`master_dealer_id.in.(${list}),install_dealer_id.in.(${list}),service_dealer_id.in.(${list})`)
    }

    // Corporate dealer filter (one dealer org across any of the 3 FKs).
    if (scope.all && dealerParam) {
      q = q.or(`master_dealer_id.eq.${dealerParam},install_dealer_id.eq.${dealerParam},service_dealer_id.eq.${dealerParam}`)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows, error } = await (q as any)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sites: any[] = Array.isArray(rows) ? rows : []

    // Org-name lookup for the dealer column + corporate dealer dropdown.
    const orgIds = new Set<string>()
    for (const s of sites) {
      for (const k of ['master_dealer_id', 'install_dealer_id', 'service_dealer_id']) {
        if (s[k]) orgIds.add(s[k])
      }
    }
    const orgNames: Record<string, string> = {}
    if (orgIds.size) {
      const { data: orgs } = await supabase.from('organizations').select('id, name').in('id', Array.from(orgIds))
      for (const o of orgs ?? []) orgNames[o.id] = o.name
    }

    const counts = { ok: 0, watch: 0, down: 0 }
    const byStatus: Record<string, number> = {}
    let units = 0
    for (const s of sites) {
      counts[bucket(s.status)]++
      byStatus[String(s.status ?? 'unknown')] = (byStatus[String(s.status ?? 'unknown')] ?? 0) + 1
      units += Number(s.units || 0)
    }

    const dealerOf = (s: Record<string, unknown>) =>
      orgNames[String(s.master_dealer_id ?? s.install_dealer_id ?? s.service_dealer_id ?? '')] ?? null

    // Needs-attention first: non-active before active.
    const rank = (s: Record<string, unknown>) => (bucket(s.status as string) === 'down' ? 0 : bucket(s.status as string) === 'watch' ? 1 : 2)
    const list = [...sites].sort((a, b) => rank(a) - rank(b)).slice(0, 25).map(s => ({
      id: s.id,
      name: s.name,
      dealer: dealerOf(s),
      location: [s.city, s.state].filter(Boolean).join(', '),
      status: s.status,
      health: bucket(s.status),
      units: s.units ?? null,
    }))

    // Dealer dropdown options (corporate only).
    const dealers = scope.all
      ? Object.entries(orgNames).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
      : []

    return NextResponse.json({
      success: true,
      canPickDealer: scope.all,
      dealers,
      total: sites.length,
      counts,
      byStatus,
      units,
      active: byStatus['active'] ?? 0,
      prospects: byStatus['prospect'] ?? 0,
      sites: list,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to load site status' }, { status: 500 })
  }
}
