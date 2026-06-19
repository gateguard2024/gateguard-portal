import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser }  from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/dispatch/technicians — scoped to the caller's org (corporate sees all).
// Legacy techs with NULL org_id remain visible to everyone until reassigned.
export async function GET() {
  let query = supabase.from('technicians').select('*').order('name')
  try {
    const scope = await resolveOrgScope(await getCurrentUser())
    if (!scope.all) {
      const ids = scope.ids.filter(Boolean)
      query = ids.length > 0 ? query.or(`org_id.is.null,org_id.in.(${ids.join(',')})`) : query.is('org_id', null)
    }
  } catch { /* no session — return unscoped (e.g. internal callers) */ }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ technicians: data ?? [] })
}

// POST /api/dispatch/technicians — add a new tech (stamped to caller's org)
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, role = 'Tech', phone, email, employment_type = 'employee', level, skills } = body

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const initials = name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
  let org_id: string | null = null
  try { org_id = (await resolveOrgScope(await getCurrentUser())).own_id ?? null } catch { org_id = null }

  // Drift-resilient insert (level/skills need migration 123)
  let row: Record<string, unknown> = { name, initials, role, phone, email, status: 'offline', employment_type, org_id, level: level ?? null, skills: skills ?? [] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let error: any = null
  for (let i = 0; i < 4; i++) {
    const res = await supabase.from('technicians').insert(row).select().single()
    data = res.data; error = res.error
    if (!error) break
    const m = /Could not find the '(\w+)' column|column "?(\w+)"? .* does not exist/.exec(error.message)
    const bad = m?.[1] || m?.[2]
    if ((error.code === 'PGRST204' || error.code === '42703') && bad && bad in row) { delete row[bad]; continue }
    break
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ technician: data }, { status: 201 })
}
