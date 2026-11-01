import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { guardWorkOrder } from '@/lib/ops-scope'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/maintenance/[id]/comments — add a comment (authored by the signed-in user)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await guardWorkOrder(req, params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const { content } = body

  if (!content?.trim()) {
    return NextResponse.json({ error: 'Content required' }, { status: 400 })
  }

  // Author = the signed-in user; only the field tool (no login) may name the tech.
  const user = await getCurrentUser()
  let authorName: string, authorInitials: string
  if (user.id && user.id !== 'anonymous') {
    authorName = user.name || 'Team member'
    authorInitials = user.initials || authorName.split(/\s+/).map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()
  } else {
    authorName = String(body.author_name ?? '').trim().slice(0, 80) || 'Field tech'
    authorInitials = String(body.author_initials ?? '').trim().slice(0, 3) || 'FT'
  }

  const { data, error } = await supabase
    .from('wo_comments')
    .insert({
      work_order_id:   params.id,
      content:         content.trim(),
      author_name:     authorName,
      author_initials: authorInitials || 'TM',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comment: data })
}

// DELETE /api/maintenance/[id]/comments — delete a comment
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await guardWorkOrder(req, params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const { comment_id } = body
  if (!comment_id) return NextResponse.json({ error: 'comment_id required' }, { status: 400 })

  const { error } = await supabase.from('wo_comments').delete().eq('id', comment_id).eq('work_order_id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
