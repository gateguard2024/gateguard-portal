/**
 * GET  /api/training/progress  — get completion progress for current user
 * POST /api/training/progress  — mark chapter complete / incomplete
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function GET() {
  const caller = await getCurrentUser()

  const { data, error } = await supabase
    .from('training_progress')
    .select('course_id, chapter_id, completed_at')
    .eq('user_id', caller.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Return as map: { [course_id]: { [chapter_id]: completed_at } }
  const progress: Record<string, Record<string, string>> = {}
  for (const row of data ?? []) {
    if (!progress[row.course_id]) progress[row.course_id] = {}
    progress[row.course_id][row.chapter_id] = row.completed_at
  }

  return NextResponse.json({ progress })
}

export async function POST(req: NextRequest) {
  const caller = await getCurrentUser()
  const body   = await req.json()
  const { course_id, chapter_id, completed } = body

  if (!course_id || !chapter_id) {
    return NextResponse.json({ error: 'course_id and chapter_id are required' }, { status: 400 })
  }

  if (completed === false) {
    // Remove completion record
    await supabase
      .from('training_progress')
      .delete()
      .eq('user_id', caller.id)
      .eq('course_id', course_id)
      .eq('chapter_id', chapter_id)
    return NextResponse.json({ ok: true, completed: false })
  }

  // Upsert completion
  const { error } = await supabase
    .from('training_progress')
    .upsert({
      user_id:      caller.id,
      org_id:       caller.org_id ?? null,
      course_id,
      chapter_id,
      completed_at: new Date().toISOString(),
    }, { onConflict: 'user_id,course_id,chapter_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, completed: true })
}
