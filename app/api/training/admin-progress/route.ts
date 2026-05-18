/**
 * GET /api/training/admin-progress — corporate/dealer view of all reps' progress
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function GET() {
  const caller = await getCurrentUser()
  if (!caller.canViewSensitive && !caller.isCorporate) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let query = supabase
    .from('training_progress')
    .select('user_id, user_name, user_email, org_id, course_id, chapter_id, completed_at')
    .order('completed_at', { ascending: false })

  if (!caller.isCorporate && caller.org_id) {
    query = query.eq('org_id', caller.org_id)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Group by user
  const byUser: Record<string, {
    user_id: string; user_name: string | null; user_email: string | null;
    org_id: string | null;
    completions: Array<{ course_id: string; chapter_id: string; completed_at: string }>
  }> = {}

  for (const row of data ?? []) {
    if (!byUser[row.user_id]) {
      byUser[row.user_id] = {
        user_id:    row.user_id,
        user_name:  row.user_name,
        user_email: row.user_email,
        org_id:     row.org_id,
        completions: [],
      }
    }
    byUser[row.user_id].completions.push({
      course_id:    row.course_id,
      chapter_id:   row.chapter_id,
      completed_at: row.completed_at,
    })
  }

  return NextResponse.json({ users: Object.values(byUser) })
}
