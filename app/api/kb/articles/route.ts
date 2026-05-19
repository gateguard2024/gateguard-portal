/**
 * GET  /api/kb/articles — List KB articles with optional filters
 * POST /api/kb/articles — Create a new KB article
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q          = searchParams.get('q')?.trim()
  const category   = searchParams.get('category')?.trim()
  const product_id = searchParams.get('product_id')?.trim()
  const difficulty = searchParams.get('difficulty')?.trim()

  const supabase = serviceDb()

  // ── Fetch articles ─────────────────────────────────────────────────────────
  let query = supabase
    .from('kb_articles')
    .select(`
      id,
      title,
      description,
      category,
      difficulty,
      helpful_count,
      author,
      product_id,
      created_at,
      updated_at,
      products ( id, name, sku )
    `)
    .eq('active', true)

  if (q) {
    // Text search across title, description, category — ilike, no vector
    query = query.or(
      `title.ilike.%${q}%,description.ilike.%${q}%,category.ilike.%${q}%`
    )
  }
  if (category) {
    query = query.eq('category', category)
  }
  if (product_id) {
    query = query.eq('product_id', product_id)
  }
  if (difficulty) {
    query = query.eq('difficulty', difficulty)
  }

  query = query.order('helpful_count', { ascending: false }).order('created_at', { ascending: false })

  const { data: articles, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── Fetch category counts (always the full active set, unfiltered by q/cat) ─
  const { data: catRows, error: catError } = await supabase
    .from('kb_articles')
    .select('category')
    .eq('active', true)

  if (catError) return NextResponse.json({ error: catError.message }, { status: 500 })

  // Aggregate counts
  const countMap: Record<string, number> = {}
  for (const row of catRows ?? []) {
    if (row.category) {
      countMap[row.category] = (countMap[row.category] ?? 0) + 1
    }
  }
  const categories = Object.entries(countMap).map(([category, count]) => ({ category, count }))

  return NextResponse.json({
    articles: articles ?? [],
    categories,
    total: articles?.length ?? 0,
  })
}

export async function POST(req: NextRequest) {
  let body: {
    title: string
    description: string
    content: string
    category: string
    difficulty: string
    product_id?: string
    author?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { title, description, content, category, difficulty, product_id, author } = body

  if (!title || !description || !content || !category || !difficulty) {
    return NextResponse.json(
      { error: 'Missing required fields: title, description, content, category, difficulty' },
      { status: 400 }
    )
  }

  const supabase = serviceDb()

  const insertRow: Record<string, unknown> = {
    title,
    description,
    content,
    category,
    difficulty,
    helpful_count: 0,
    active: true,
  }
  if (product_id) insertRow.product_id = product_id
  if (author)     insertRow.author     = author

  const { data, error } = await supabase
    .from('kb_articles')
    .insert(insertRow)
    .select(`
      id, title, description, category, difficulty, helpful_count, author,
      product_id, created_at, updated_at,
      products ( id, name, sku )
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ article: data }, { status: 201 })
}
