// lib/ops-scope.ts
// Ownership guard for work-order-scoped routes (the WO detail + all its child
// routes: parts, crew, phases, equipment, checklist, calls, photos, costs...).
//
// These routes use the service-role key (bypasses RLS) and previously filtered
// only by the work_order_id in the URL — so any caller could read/mutate another
// org's job by supplying its id. This guard closes that hole WITHOUT breaking the
// field tool, which authenticates by tech code (x-tech-code), not a Clerk login.
//
// Allowed:
//   1. Field tool with a valid tech code (device-level trust — existing behavior)
//   2. Corporate user (sees everything)
//   3. Portal user whose org owns the work order (org_id in their subtree)
// Anything else → false → the route should 404.

import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, isInScope, getMemberSiteIds } from '@/lib/org-scope'
import { isTechAuthed } from '@/lib/tech-auth'
import { leadInScope, opportunityInScope } from '@/lib/crm-scope'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/** True if the caller may access this work order. */
export async function guardWorkOrder(req: NextRequest, woId: string): Promise<boolean> {
  if (!woId) return false
  // Field tool authenticates by tech code, not org — let it through as before.
  if (await isTechAuthed(req)) return true

  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)
  if (scope.all) return true

  const { data } = await db()
    .from('work_orders')
    .select('org_id')
    .eq('id', woId)
    .maybeSingle()
  if (!data) return false
  return isInScope(scope, (data as { org_id?: string | null }).org_id)
}

/** Guard by a field-ticket id: resolves its parent work order, then checks scope. */
export async function guardFieldTicket(req: NextRequest, ticketId: string): Promise<boolean> {
  if (!ticketId) return false
  if (await isTechAuthed(req)) return true
  const { data } = await db()
    .from('field_tickets')
    .select('work_order_id')
    .eq('id', ticketId)
    .maybeSingle()
  const woId = (data as { work_order_id?: string | null } | null)?.work_order_id
  if (!woId) return false
  return guardWorkOrder(req, woId)
}

/** True if the caller may access this site (dealer 3-FK, corporate, property member, or tech). */
export async function guardSite(req: NextRequest, siteId: string): Promise<boolean> {
  if (!siteId) return false
  if (await isTechAuthed(req)) return true
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)
  if (scope.all) return true
  const { data } = await db()
    .from('sites')
    .select('master_dealer_id, install_dealer_id, service_dealer_id, org_id')
    .eq('id', siteId)
    .maybeSingle()
  if (!data) return false
  const s = data as Record<string, string | null>
  if (
    isInScope(scope, s.master_dealer_id) ||
    isInScope(scope, s.install_dealer_id) ||
    isInScope(scope, s.service_dealer_id) ||
    isInScope(scope, s.org_id)
  ) return true
  // Property owners / site managers reach their own sites via membership.
  const memberIds = await getMemberSiteIds(user.id)
  return memberIds.includes(siteId)
}

/** True if the caller may access an org (customer/dealer) by its org id. */
export async function guardOrg(orgId: string): Promise<boolean> {
  if (!orgId) return false
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)
  return scope.all || isInScope(scope, orgId)
}

/**
 * Polymorphic scope check for contact_links (entity_type ∈ job | lead | opportunity | site | org).
 * Unknown types fail closed (corporate-only) so a new type can't silently leak.
 */
export async function entityInScope(req: NextRequest, entityType: string, entityId: string): Promise<boolean> {
  if (!entityType || !entityId) return false
  switch (entityType) {
    case 'lead':                        return leadInScope(entityId)
    case 'opportunity': case 'opp':     return opportunityInScope(entityId)
    case 'job': case 'work_order':      return guardWorkOrderByOrg(entityId)
    case 'site': case 'property':       return guardSite(req, entityId)
    case 'org': case 'organization':
    case 'customer': case 'dealer':     return guardOrg(entityId)
    default: {
      const user  = await getCurrentUser()
      const scope = await resolveOrgScope(user)
      return scope.all
    }
  }
}

// 'job' in contact_links points at the `jobs` table (distinct from work_orders),
// so check its own org_id rather than the WO guard.
async function guardWorkOrderByOrg(jobId: string): Promise<boolean> {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)
  if (scope.all) return true
  const { data } = await db().from('jobs').select('org_id').eq('id', jobId).maybeSingle()
  if (!data) return false
  return isInScope(scope, (data as { org_id?: string | null }).org_id)
}
