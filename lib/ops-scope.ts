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
import { resolveOrgScope, isInScope } from '@/lib/org-scope'
import { isTechAuthed } from '@/lib/tech-auth'

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
