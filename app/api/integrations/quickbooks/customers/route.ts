import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { getQboAuth, qboQuery } from '@/lib/qbo'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

type QBCustomer = { Id: string; DisplayName: string; PrimaryEmailAddr?: { Address?: string }; Active?: boolean }

const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

// GET — list QBO customers + this portal's client orgs and their current mapping.
// Powers the "link each site to its QuickBooks customer" screen.
export async function GET() {
  const user = await getCurrentUser()
  if (!user.isCorporate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const auth = await getQboAuth()
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 400 })

  const q = await qboQuery<QBCustomer>(auth, 'select Id, DisplayName, PrimaryEmailAddr, Active from Customer maxresults 1000')
  if (!q.ok) return NextResponse.json({ error: q.error }, { status: 502 })

  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, name, qbo_customer_id')
    .eq('org_tier', 'client')
    .order('name')

  return NextResponse.json({
    customers: q.rows.map(c => ({
      id: c.Id, name: c.DisplayName, email: c.PrimaryEmailAddr?.Address ?? null, active: c.Active !== false,
    })),
    organizations: orgs ?? [],
  })
}

// POST — set mappings. Two modes:
//   { action: 'auto' }                          → name-match every unmapped client org
//   { mappings: [{ org_id, qbo_customer_id }] } → explicit links (qbo_customer_id null clears)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user.isCorporate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))

  if (Array.isArray(body.mappings)) {
    let updated = 0
    for (const m of body.mappings) {
      if (!m.org_id) continue
      const { error } = await supabase
        .from('organizations')
        .update({ qbo_customer_id: m.qbo_customer_id ?? null })
        .eq('id', m.org_id)
      if (!error) updated++
    }
    return NextResponse.json({ ok: true, updated })
  }

  if (body.action === 'auto') {
    const auth = await getQboAuth()
    if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 400 })

    const q = await qboQuery<QBCustomer>(auth, 'select Id, DisplayName from Customer maxresults 1000')
    if (!q.ok) return NextResponse.json({ error: q.error }, { status: 502 })

    const byName = new Map<string, string>()
    for (const c of q.rows) byName.set(norm(c.DisplayName), c.Id)

    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name, qbo_customer_id')
      .eq('org_tier', 'client')

    let matched = 0, alreadySet = 0
    const unmatched: string[] = []
    for (const o of orgs ?? []) {
      if (o.qbo_customer_id) { alreadySet++; continue }
      const id = byName.get(norm(o.name))
      if (id) {
        const { error } = await supabase.from('organizations').update({ qbo_customer_id: id }).eq('id', o.id)
        if (!error) matched++
      } else {
        unmatched.push(o.name)
      }
    }
    return NextResponse.json({ ok: true, matched, alreadySet, unmatched })
  }

  return NextResponse.json({ error: 'Provide { action: "auto" } or { mappings: [...] }' }, { status: 400 })
}
