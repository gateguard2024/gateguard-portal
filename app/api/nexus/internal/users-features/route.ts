import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type AdminBucket = 'platform_users' | 'feature_settings' | 'dealer_access' | 'needs_review'

function canViewInternal(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  return user.isCorporate || user.isMasterDealer || user.role === 'admin' || user.role === 'supervisor'
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!canViewInternal(user)) {
      return NextResponse.json({ success: false, message: 'You do not have access to Internal admin tools.' }, { status: 403 })
    }

    // Downward subtree scope (corporate = all). Replaces the old own-org-only filter.
    const scope = await resolveOrgScope(user)

    let profiles = supabase
      .from('profiles')
      .select('id,first_name,last_name,email,role,org_id,last_login_at,created_at')
      .order('created_at', { ascending: false })
      .limit(80)
    if (!scope.all) profiles = profiles.in('org_id', scope.ids.length ? scope.ids : ['00000000-0000-0000-0000-000000000000'])
    const profileRows = await profiles

    let orgs = supabase
      .from('organizations')
      .select('id,name,org_tier,status,primary_email,created_at')
      .order('created_at', { ascending: false })
      .limit(80)
    if (!scope.all) orgs = orgs.in('id', scope.ids.length ? scope.ids : ['00000000-0000-0000-0000-000000000000'])
    const orgRows = await orgs

    let permissions = supabase
      .from('user_permissions')
      .select('id,user_id,permission,enabled,created_at')
      .limit(80)
    const permissionRows = await permissions

    let addOns = supabase
      .from('dealer_add_ons')
      .select('id,dealer_org_id,add_on_key,enabled,created_at')
      .limit(80)
    if (!user.isCorporate && user.org_id) addOns = addOns.eq('dealer_org_id', user.org_id)
    const addOnRows = await addOns

    const items: Array<Record<string, unknown> & { bucket: AdminBucket }> = []

    for (const row of profileRows.data ?? []) {
      const name = [row.first_name, row.last_name].filter(Boolean).join(' ') || row.email || 'User'
      items.push({
        id: `user-${row.id}`,
        bucket: row.last_login_at ? 'platform_users' : 'needs_review',
        title: name,
        subtitle: row.email || 'No email',
        status: row.role || 'user',
        meta: row.last_login_at ? `Last login ${String(row.last_login_at).slice(0, 10)}` : 'No recent login found',
      })
    }

    for (const row of orgRows.data ?? []) {
      items.push({
        id: `org-${row.id}`,
        bucket: String(row.status ?? '').toLowerCase() === 'active' ? 'dealer_access' : 'needs_review',
        title: row.name || 'Organization',
        subtitle: row.primary_email || row.org_tier || 'Dealer / org access',
        status: row.status || 'unknown',
        meta: row.org_tier || null,
      })
    }

    for (const row of permissionRows.data ?? []) {
      items.push({
        id: `permission-${row.id}`,
        bucket: row.enabled === false ? 'needs_review' : 'feature_settings',
        title: row.permission || 'Permission',
        subtitle: `User ${row.user_id}`,
        status: row.enabled === false ? 'off' : 'on',
        meta: 'Permission override',
      })
    }

    for (const row of addOnRows.data ?? []) {
      items.push({
        id: `addon-${row.id}`,
        bucket: row.enabled === false ? 'needs_review' : 'feature_settings',
        title: row.add_on_key || 'Add-on',
        subtitle: `Dealer ${row.dealer_org_id}`,
        status: row.enabled === false ? 'off' : 'on',
        meta: 'Dealer add-on',
      })
    }

    return NextResponse.json({ success: true, items })
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'Could not load users/features.' }, { status: 500 })
  }
}
