import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, isInScope } from '@/lib/org-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Reassigning/redistributing a lead is an admin action (corporate, or an
    // admin/supervisor over the target org).
    const user = await getCurrentUser()
    const isManager = user.isCorporate || ['admin', 'supervisor'].includes(user.role)
    if (!isManager) {
      return NextResponse.json({ error: 'Only admins can reassign leads.' }, { status: 403 })
    }

    const rawId = params.id
    const body = await req.json()
    const { dealer } = body

    if (!dealer) {
      return NextResponse.json({ error: 'dealer is required' }, { status: 400 })
    }

    // The target dealer org must be within the caller's downward subtree.
    const scope = await resolveOrgScope(user)
    if (!isInScope(scope, dealer)) {
      return NextResponse.json({ error: 'Target org is outside your access.' }, { status: 403 })
    }

    // Tolerant strip of any legacy show_ prefix — leads use plain UUIDs now
    const uuid = rawId.replace(/^show_/, '')

    const { error } = await supabase
      .from('leads')
      .update({ assigned_dealer: dealer })
      .eq('id', uuid)

    if (error) {
      console.error('[/api/crm/leads/[id]/assign] Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/crm/leads/[id]/assign] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
