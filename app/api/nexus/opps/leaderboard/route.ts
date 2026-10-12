import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope, getProfileId } from '@/lib/org-scope'
import { normalizeRole } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>
const r0 = (v: number) => Math.round(v)

/**
 * Sales ranking.
 *   Manager / corporate (role !== 'user') → full leaderboard, one row per rep.
 *   Plain rep (role === 'user')           → only their own standing + team
 *                                            averages + rank. Peers' individual
 *                                            numbers are never returned to a rep.
 * All aggregation is scoped by org (applyOrgScope on dealer_org_id), so corporate
 * sees everyone and a dealer manager sees only their subtree.
 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user.canViewCRM) return NextResponse.json({ view: 'none', reps: [] })

  const scope = await resolveOrgScope(user)
  let q = supabase.from('opportunities').select('rep_id, amount, won_at, lost_at, deleted_at')
  q = applyOrgScope(q, scope, 'dealer_org_id')
  const { data: oppsRaw } = await q.is('deleted_at', null)
  const opps = (oppsRaw ?? []) as Row[]

  type Agg = { pipeline: number; open: number; won: number; lost: number }
  const byRep = new Map<string, Agg>()
  for (const o of opps) {
    const id = o.rep_id as string | null
    if (!id) continue
    const a = byRep.get(id) ?? { pipeline: 0, open: 0, won: 0, lost: 0 }
    const isOpen = !o.won_at && !o.lost_at
    if (isOpen) { a.open += 1; a.pipeline += Number(o.amount) || 0 }
    if (o.won_at) a.won += 1
    if (o.lost_at) a.lost += 1
    byRep.set(id, a)
  }

  const ids = Array.from(byRep.keys())
  const meta = new Map<string, { name: string; initials: string; orgId: string | null }>()
  if (ids.length) {
    const { data: profs } = await supabase.from('profiles').select('id, first_name, last_name, full_name, email, org_id').in('id', ids)
    for (const p of (profs ?? []) as Row[]) {
      const nm = ((p.full_name as string) || [p.first_name, p.last_name].filter(Boolean).join(' ') || (p.email as string) || 'Unknown').trim()
      const initials = nm.split(/\s+/).slice(0, 2).map((s: string) => s[0]?.toUpperCase() || '').join('') || '?'
      meta.set(p.id as string, { name: nm, initials, orgId: (p.org_id as string) ?? null })
    }
  }
  const orgIds = Array.from(new Set(Array.from(meta.values()).map(v => v.orgId).filter(Boolean))) as string[]
  const orgName = new Map<string, string>()
  if (orgIds.length) {
    const { data: orgs } = await supabase.from('organizations').select('id, name').in('id', orgIds)
    for (const o of (orgs ?? []) as Row[]) orgName.set(o.id as string, o.name as string)
  }

  const reps = ids.map(id => {
    const a = byRep.get(id)!
    const m = meta.get(id)
    const winRate = (a.won + a.lost) > 0 ? Math.round((a.won / (a.won + a.lost)) * 100) : 0
    return {
      profileId: id,
      name: m?.name ?? 'Unknown',
      initials: m?.initials ?? '?',
      sub: (m?.orgId && orgName.get(m.orgId)) || 'Rep',
      pipeline: r0(a.pipeline), open: a.open, won: a.won, winRate,
    }
  }).sort((x, y) => y.pipeline - x.pipeline)

  const count = reps.length
  const teamAverage = {
    pipeline: count ? Math.round(reps.reduce((s, r) => s + r.pipeline, 0) / count) : 0,
    winRate: count ? Math.round(reps.reduce((s, r) => s + r.winRate, 0) / count) : 0,
    won: count ? Math.round((reps.reduce((s, r) => s + r.won, 0) / count) * 10) / 10 : 0,
  }

  if (normalizeRole(user.role) !== 'user') {
    return NextResponse.json({ view: 'leaderboard', reps, teamAverage, count })
  }

  // Rep view — surface only the caller's own row + rank + averages.
  const myId = await getProfileId(user.id, user.email)
  const idx = myId ? reps.findIndex(r => r.profileId === myId) : -1
  const you = idx >= 0 ? reps[idx] : { profileId: myId, name: user.name, initials: user.initials, sub: 'Rep', pipeline: 0, open: 0, won: 0, winRate: 0 }
  return NextResponse.json({ view: 'rep', you, rank: idx >= 0 ? idx + 1 : count + 1, total: count, teamAverage })
}
