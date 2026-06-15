// lib/crm-scope.ts
// Shared org-scope guards for the legacy /api/crm/* by-id routes.
// Corporate (scope.all) always passes; otherwise the record's org must be in
// the caller's downward subtree. Used to fail closed (404) on cross-org access.

import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, isInScope } from '@/lib/org-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// An opportunity is in scope if its dealer_org_id is in the caller's subtree.
export async function opportunityInScope(id: string): Promise<boolean> {
  const user = await getCurrentUser()
  const scope = await resolveOrgScope(user)
  if (scope.all) return true
  const { data } = await supabase.from('opportunities').select('dealer_org_id').eq('id', id).maybeSingle()
  return isInScope(scope, (data as { dealer_org_id?: string | null } | null)?.dealer_org_id)
}

// A lead is in scope:
//  - show_<uuid>  (show_leads): the importer/owner (assigned_to_user_id == caller)
//  - <uuid>       (leads):      org_id in the caller's subtree
export async function leadInScope(rawId: string): Promise<boolean> {
  const user = await getCurrentUser()
  const scope = await resolveOrgScope(user)
  if (scope.all) return true
  if (rawId.startsWith('show_')) {
    const uuid = rawId.replace('show_', '')
    const { data } = await supabase.from('show_leads').select('assigned_to_user_id').eq('id', uuid).maybeSingle()
    return (data as { assigned_to_user_id?: string | null } | null)?.assigned_to_user_id === user.id
  }
  const { data } = await supabase.from('leads').select('org_id').eq('id', rawId).maybeSingle()
  return isInScope(scope, (data as { org_id?: string | null } | null)?.org_id)
}
