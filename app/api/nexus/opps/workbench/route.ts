import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function clean(value: string | null): string {
  return (value ?? '').trim()
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

// Resolve the internal profiles.id (UUID) from a Clerk user ID.
// leads.assigned_to → profiles.id — NOT the Clerk user ID directly.
async function resolveProfileId(clerkUserId: string): Promise<string | null> {
  if (!clerkUserId || clerkUserId === 'system') return null
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('clerk_user_id', clerkUserId)
      .single()
    if (error || !data) return null
    return (data as { id: string }).id
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  // ── Auth + CRM access gate ──────────────────────────────────────────────────
  // canViewCRM: corporate | master_dealer | full_dealer | sales_partner | service_dealer
  // client | install_contractor → 403
  const user = await getCurrentUser()

  if (!user.canViewCRM) {
    return NextResponse.json(
      { success: false, message: 'CRM access denied.' },
      { status: 403 }
    )
  }

  // ── Resolve org scope + current user's profile ID in parallel ───────────────
  // corporate       → scope.all = true  (no filter, sees everything)
  // master_agent    → subtree via get_org_subtree RPC
  // master_dealer   → subtree via get_org_subtree RPC
  // full_dealer     → self + descendants
  // service_dealer  → self only  (ids = [user.org_id])
  // sales_partner   → self only  (ids = [user.org_id])
  const [scope, profileId] = await Promise.all([
    resolveOrgScope(user),
    resolveProfileId(user.id),  // profiles.id UUID — used for leads.assigned_to
  ])

  const { searchParams } = new URL(req.url)
  const q = clean(searchParams.get('q'))

  // ── Search mode ─────────────────────────────────────────────────────────────
  if (q) {
    const term = escapeLike(q)

    // leads.org_id
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

    // opportunities.dealer_org_id (confirmed: 002_crm_phase1.sql line 105)
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

  // ── Default workbench load ───────────────────────────────────────────────────

  // My Leads: assigned to current user, scoped to their org
  // applyOrgScope first (security), then narrow by assigned_to
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
    openLeadsQ.is('lost_at', null).order('updated_at', { ascending: false }).limit(20),
    []
  )

  let needsQ = supabase
    .from('leads')
    .select('id, contact_name, company_name, stage, source, notes, created_at, updated_at, email, phone, location, opportunity_id')
  needsQ = applyOrgScope(needsQ, scope)
  const needsAttention = await safe(
    needsQ.is('lost_at', null).order('updated_at', { ascending: true }).limit(10),
    []
  )

  let openOppsQ = supabase
    .from('opportunities')
    .select('id, name, account_name, management_co, stage, amount, est_mrr, next_step, notes, created_at, updated_at')
  openOppsQ = applyOrgScope(openOppsQ, scope, 'dealer_org_id')
  const openOpportunities = await safe(
    openOppsQ.is('won_at', null).is('lost_at', null).order('updated_at', { ascending: false }).limit(20),
    []
  )

  let proposalQ = supabase
    .from('opportunities')
    .select('id, name, account_name, management_co, stage, amount, est_mrr, next_step, notes, created_at, updated_at')
  proposalQ = applyOrgScope(proposalQ, scope, 'dealer_org_id')
  const proposalFollowUps = await safe(
    proposalQ.or('stage.ilike.%proposal%,stage.ilike.%propose%,stage.ilike.%negotiat%').order('updated_at', { ascending: true }).limit(10),
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
