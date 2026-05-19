/**
 * GET    /api/kb/articles/[id] — Fetch single article with joined product name
 * PATCH  /api/kb/articles/[id] — Update article fields
 * DELETE /api/kb/articles/[id] — Soft delete (active = false)
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

const SELECT_FIELDS = `
  id, title, description, content, category, difficulty,
  helpful_count, author, product_id, active, created_at, updated_at,
  products ( id, name, sku )
`

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = serviceDb()

  const { data, error } = await supabase
    .from('kb_articles')
    .select(SELECT_FIELDS)
    .eq('id', params.id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ article: data })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Whitelist updatable fields — never allow direct embedding or active manipulation here
  const allowedFields = ['title', 'description', 'content', 'category', 'difficulty', 'product_id', 'author']
  const updates: Record<string, unknown> = {}
  for (const key of allowedFields) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  updates.updated_at = new Date().toISOString()

  const supabase = serviceDb()

  const { data, error } = await supabase
    .from('kb_articles')
    .update(updates)
    .eq('id', params.id)
    .select(SELECT_FIELDS)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ article: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = serviceDb()

  // Soft delete — set active = false
  const { data, error } = await supabase
    .from('kb_articles')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select('id, title')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ deleted: true, id: data.id })
}
