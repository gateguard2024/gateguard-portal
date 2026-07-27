/**
 * GET /api/esign/agreements — the org's e-signature agreements (Acrobat Sign or
 * built-in), most recent first. Powers the "Out for signature" tracker.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

export const dynamic = 'force-dynamic'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized', agreements: [] }, { status: 401 })
  const scope = await resolveOrgScope(user)
  let q = supabase.from('esign_agreements').select('*').order('created_at', { ascending: false }).limit(200)
  q = applyOrgScope(q, scope, 'org_id')
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message, agreements: [] }, { status: 500 })
  return NextResponse.json({ agreements: data ?? [] })
}
