/**
 * GET /api/nexus/internal/users-features
 *
 * Data for the Internal → Users & Features board. Returns three clean groups,
 * all scoped to the caller's downward org subtree (corporate = all):
 *   users  — portal logins (profiles). Clickable → glass user editor.
 *   techs  — technician records (field workers).
 *   orgs   — organizations, split into dealers vs clients.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const NONE = ['00000000-0000-0000-0000-000000000000']

function canViewInternal(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  return user.isCorporate || user.isMasterDealer || user.role === 'admin' || user.role === 'supervisor'
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!canViewInternal(user)) {
      return NextResponse.json({ success: false, message: 'You do not have access to Internal admin tools.' }, { status: 403 })
    }

    const scope = await resolveOrgScope(user)
    const scoped = <T extends { in: (col: string, vals: string[]) => T }>(q: T, col: string): T =>
      scope.all ? q : q.in(col, scope.ids.length ? scope.ids : NONE)

    // Org name lookup for labeling people.
    let orgsQ = supabase.from('organizations').select('id,name,org_tier,status,primary_email').order('name')
    orgsQ = scoped(orgsQ as any, 'id')
    const { data: orgRows } = await orgsQ
    const orgName = new Map((orgRows ?? []).map((o: any) => [o.id, o.name]))

    // Portal logins.
    let profQ = supabase
      .from('profiles')
      .select('id,first_name,last_name,email,role,org_id,last_login_at')
      .order('created_at', { ascending: false })
      .limit(200)
    profQ = scoped(profQ as any, 'org_id')
    const { data: profRows } = await profQ

    // Field techs.
    let techQ = supabase
      .from('technicians')
      .select('id,name,email,org_id,employment_type,can_access_portal,clerk_user_id,tech_code')
      .order('name')
      .limit(200)
    techQ = scoped(techQ as any, 'org_id')
    const { data: techRows } = await techQ

    const users = (profRows ?? []).map((r: any) => ({
      id: r.id,
      name: [r.first_name, r.last_name].filter(Boolean).join(' ') || r.email || 'User',
      email: r.email || null,
      role: r.role || null,
      org_name: orgName.get(r.org_id) ?? null,
      last_login_at: r.last_login_at ?? null,
    }))

    const techs = (techRows ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      email: r.email || null,
      employment_type: r.employment_type || 'employee',
      org_name: orgName.get(r.org_id) ?? null,
      access: r.can_access_portal ? 'portal' : r.tech_code ? 'field_code' : 'none',
      linked: !!r.clerk_user_id,
    }))

    const orgs = (orgRows ?? []).map((o: any) => ({
      id: o.id,
      name: o.name || 'Organization',
      tier: o.org_tier || null,
      status: o.status || 'unknown',
      email: o.primary_email || null,
      kind: o.org_tier === 'client' ? 'client' : 'dealer',
    }))

    return NextResponse.json({
      success: true,
      users,
      techs,
      orgs,
      counts: {
        users: users.length,
        techs: techs.length,
        dealers: orgs.filter(o => o.kind === 'dealer').length,
        clients: orgs.filter(o => o.kind === 'client').length,
      },
    })
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'Could not load users/features.' }, { status: 500 })
  }
}
