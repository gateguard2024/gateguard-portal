import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/tracker/items/[id]/comments
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await supabase
    .from('tracker_comments')
    .select('id, item_id, author_name, author_initials, body, created_at')
    .eq('item_id', params.id)
    .order('created_at', { ascending: true })

  if (error) {
    if (error.code === '42P01') return NextResponse.json([])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data ?? [])
}

/**
 * POST /api/tracker/items/[id]/comments
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    const body = await req.json()
    const { body: commentBody, author_name, author_initials } = body

    if (!commentBody?.trim()) {
      return NextResponse.json({ error: 'body is required' }, { status: 400 })
    }

    const name = author_name || user.name
    const initials = author_initials || user.initials

    const { data, error } = await supabase
      .from('tracker_comments')
      .insert({
        item_id: params.id,
        author_user_id: user.id !== 'system' ? user.id : null,
        author_name: name,
        author_initials: initials,
        body: commentBody.trim(),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('[/api/tracker/items/[id]/comments POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
