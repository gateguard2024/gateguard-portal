import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type PermissionRow = Record<string, unknown> & {
  email?: string | null
  profile_id?: string | null
  user_id?: string | null
}

function clean(value: string | null): string {
  return (value ?? '').trim()
}

function cleanUnknown(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function escapeLike(value: string): string {
  return value.replace(/[%_]/g, match => `\\${match}`)
}

async function safe<T>(
  promise: PromiseLike<{ data: T | null; error: unknown }>,
  fallback: T
): Promise<T> {
  try {
    const { data, error } = await promise
    if (error || !data) return fallback
    return data
  } catch {
    return fallback
  }
}

/**
 * Resolve the internal profiles.id UUID from a Clerk user ID.
 *
 * leads.assigned_to stores profiles.id, not the Clerk user_xxx string.
 *
 * Stable path:
 * 1. Try profiles.clerk_user_id.
 * 2. Try user_permissions.clerk_user_id.
 * 3. Use user_permissions.email or Clerk email to find profiles.email.
 */
async function resolveProfileId(clerkUserId: string, email?: string): Promise<string | null> {
  if (!clerkUserId || clerkUserId === 'system') return null

  try {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('clerk_user_id', clerkUserId)
      .maybeSingle()

    const profileId = (data as { id: string } | null)?.id
    if (profileId) return profileId
  } catch {
    // Some live schemas/data do not have profiles.clerk_user_id filled.
  }

  let permissionEmail = cleanUnknown(email)

  try {
    const { data } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('clerk_user_id', clerkUserId)
      .maybeSingle()

    const permission = data as PermissionRow | null

    const directProfileId = cleanUnknown(permission?.profile_id ?? permission?.user_id)
    if (directProfileId) return directProfileId

    permissionEmail = cleanUnknown(permission?.email) || permissionEmail
  } catch {
    // Fall through to email lookup.
  }

  if (permissionEmail) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', permissionEmail)
        .maybeSingle()

      const profileId = (data as { id: string } | null)?.id
      if (profileId) return profileId
    } catch {
      return null
    }
  }

  return null
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()

  if (!user.canViewCRM) {
    return NextResponse.json(
      { success: false, message: 'CRM access denied.' },
      { status: 403 }
    )
  }

  const [scope, profileId] = await Promise.all([
    resolveOrgScope(user),
    resolveProfileId(user.id, user.email),
  ])

  const { searchParams } = new URL(req.url)
  const q = clean(searchParams.get('q'))

  if (q) {
    const term = escapeLike(q)

    let leadsQ = supabase
      .from('leads')
      .select('id, contact_name, company_name, stage, source, notes, created_at, updated_at, email, phone, location, opportunity_id')

    leadsQ = applyOrgScope(leadsQ, scope)

    const leads = await safe(
      leadsQ
        .or(`contact_name.ilike.%${term}%,company_name.ilike.%${term}%,location.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,notes.ilike.%${term}%`)
        .order('updated_at', { ascending: false })
        .limit(10),
      []
    )

    let oppsQ = supabase
      .from('opportunities')
      .select('id, name, account_name, management_co, stage, amount, est_mrr, next_step, notes, created_at, updated_at')

    oppsQ = applyOrgScope(oppsQ, scope, 'dealer_org_id')

    const opportunities = await safe(
      oppsQ
        .or(`name.ilike.%${term}%,account_name.ilike.%${term}%,management_co.ilike.%${term}%,property_address.ilike.%${term}%,notes.ilike.%${term}%`)
        .order('updated_at', { ascending: false })
        .limit(10),
      []
    )

    return NextResponse.json({ success: true, q, leads, opportunities })
  }

  let myLeadsQ = supabase
    .from('leads')
    .select('id, contact_name, company_name, stage, source, notes, created_at, updated_at, email, phone, location, opportunity_id')

  myLeadsQ = applyOrgScope(myLeadsQ, scope)

  const myLeads = profileId
    ? await safe(
        myLeadsQ
          .eq('assigned_to', profileId)
          .is('lost_at', null)
          .order('updated_at', { ascending: false })
          .limit(20),
        []
      )
    : []

  let openLeadsQ = supabase
    .from('leads')
    .select('id, contact_name, company_name, stage, source, notes, created_at, updated_at, email, phone, location, opportunity_id')

  openLeadsQ = applyOrgScope(openLeadsQ, scope)

  const openLeads = await safe(
    openLeadsQ
      .is('lost_at', null)
      .order('updated_at', { ascending: false })
      .limit(20),
    []
  )

  let needsQ = supabase
    .from('leads')
    .select('id, contact_name, company_name, stage, source, notes, created_at, updated_at, email, phone, location, opportunity_id')

  needsQ = applyOrgScope(needsQ, scope)

  const needsAttention = await safe(
    needsQ
      .is('lost_at', null)
      .order('updated_at', { ascending: true })
      .limit(10),
    []
  )

  let openOppsQ = supabase
    .from('opportunities')
    .select('id, name, account_name, management_co, stage, amount, est_mrr, next_step, notes, created_at, updated_at')

  openOppsQ = applyOrgScope(openOppsQ, scope, 'dealer_org_id')

  const openOpportunities = await safe(
    openOppsQ
      .is('won_at', null)
      .is('lost_at', null)
      .order('updated_at', { ascending: false })
      .limit(20),
    []
  )

  let proposalQ = supabase
    .from('opportunities')
    .select('id, name, account_name, management_co, stage, amount, est_mrr, next_step, notes, created_at, updated_at')

  proposalQ = applyOrgScope(proposalQ, scope, 'dealer_org_id')

  const proposalFollowUps = await safe(
    proposalQ
      .or('stage.ilike.%proposal%,stage.ilike.%propose%,stage.ilike.%negotiat%')
      .order('updated_at', { ascending: true })
      .limit(10),
    []
  )

  return NextResponse.json({
    success: true,
    stats: {
      myLeads:           (myLeads           as unknown[]).length,
      openLeads:         (openLeads         as unknown[]).length,
      needsAttention:    (needsAttention    as unknown[]).length,
      openOpportunities: (openOpportunities as unknown[]).length,
      proposalFollowUps: (proposalFollowUps as unknown[]).length,
    },
    myLeads,
    openLeads,
    needsAttention,
    openOpportunities,
    proposalFollowUps,
  })
}
