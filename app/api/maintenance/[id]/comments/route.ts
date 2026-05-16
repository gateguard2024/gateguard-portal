import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/maintenance/[id]/comments — add a comment
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { content, author_name, author_initials } = body

  if (!content?.trim()) {
    return NextResponse.json({ error: 'Content required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('wo_comments')
    .insert({
      work_order_id:   params.id,
      content:         content.trim(),
      author_name:     author_name     ?? 'Russel Feldman',
      author_initials: author_initials ?? 'RF',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comment: data })
}

// DELETE /api/maintenance/[id]/comments — delete a comment
export async function DELETE(req: NextRequest, _ctx: { params: { id: string } }) {
  const body = await req.json()
  const { comment_id } = body
  if (!comment_id) return NextResponse.json({ error: 'comment_id required' }, { status: 400 })

  const { error } = await supabase.from('wo_comments').delete().eq('id', comment_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
