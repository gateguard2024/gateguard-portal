/**
 * GET /api/todos/people?q=text — people for the Tasks owner / watcher / @mention pickers.
 * Corporate sees everyone; everyone else sees their own org and its direct child orgs.
 * Returns Clerk user IDs (todos.assigned_to and watcher_ids store those).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { supabaseAdmin as supabase } from '@/lib/todo-activity'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const caller = await getCurrentUser()
    if (!caller.id || caller.id === 'anonymous') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''

    let query = supabase
      .from('profiles')
      .select('clerk_user_id, first_name, last_name, email, role, org_id')
      .not('clerk_user_id', 'is', null)
      .order('first_name')
      .limit(q ? 25 : 200)

    if (!caller.isCorporate) {
      if (!caller.org_id) {
        query = query.eq('clerk_user_id', caller.id)
      } else {
        const { data: children } = await supabase.from('organizations').select('id').eq('parent_org_id', caller.org_id)
        query = query.in('org_id', [caller.org_id, ...(children ?? []).map(c => c.id)])
      }
    }
    if (q) {
      const safe = q.replace(/[%,()]/g, ' ')
      query = query.or(`first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,email.ilike.%${safe}%`)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const people = (data ?? []).map(p => {
      const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || 'Unnamed'
      return { id: p.clerk_user_id as string, name, email: p.email, role: p.role, initials: name.split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() }
    })
    return NextResponse.json({ people, me: caller.id })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
