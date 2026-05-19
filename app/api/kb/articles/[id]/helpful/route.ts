/**
 * POST /api/kb/articles/[id]/helpful — Increment helpful_count by 1
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = serviceDb()

  // Fetch current count first
  const { data: current, error: fetchError } = await supabase
    .from('kb_articles')
    .select('id, helpful_count')
    .eq('id', params.id)
    .eq('active', true)
    .single()

  if (fetchError) {
    if (fetchError.code === 'PGRST116') {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  const newCount = (current.helpful_count ?? 0) + 1

  const { data, error } = await supabase
    .from('kb_articles')
    .update({ helpful_count: newCount, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select('id, title, helpful_count')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ article: data })
}
