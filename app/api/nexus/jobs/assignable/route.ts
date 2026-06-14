/**
 * GET /api/nexus/jobs/assignable
 *
 * Technicians the caller can assign a job to — scoped to their downward org
 * subtree (corporate = all). Used by the job glass "Assign" picker.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

export const dynamic = 'force-dynamic'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  const user = await getCurrentUser()
  if (!user.canViewWOs && !user.isCorporate) {
    return NextResponse.json({ success: false, message: 'Job access denied.', technicians: [] }, { status: 403 })
  }
  const scope = await resolveOrgScope(user)

  let query = supabase
    .from('technicians')
    .select('id, name, initials, role, status, org_id')
    .order('name')
  query = applyOrgScope(query, scope, 'org_id')

  const { data, error } = await query
  if (error) return NextResponse.json({ success: false, message: error.message, technicians: [] }, { status: 500 })
  return NextResponse.json({ success: true, technicians: data ?? [] })
}
