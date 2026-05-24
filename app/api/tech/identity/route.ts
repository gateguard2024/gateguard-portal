/**
 * GET  /api/tech/identity — list technicians for identity picker
 * POST /api/tech/identity — match tech by name
 *
 * Auth: x-tech-code header matching TECH_ACCESS_CODE env var (same as /api/kb/products)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function isTechAuthed(req: NextRequest): boolean {
  const code      = req.headers.get('x-tech-code')
  const validCode = process.env.TECH_ACCESS_CODE
  return !!(validCode && code && code === validCode)
}

export async function GET(req: NextRequest) {
  if (!isTechAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await serviceDb()
    .from('technicians')
    .select('id, name, initials, status')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ technicians: data ?? [] })
}

export async function POST(req: NextRequest) {
  if (!isTechAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { name } = body as { name?: string }

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const { data, error } = await serviceDb()
    .from('technicians')
    .select('id, name, initials')
    .ilike('name', `%${name}%`)
    .limit(1)
    .single()

  if (error || !data) return NextResponse.json({ error: 'not found' }, { status: 404 })

  return NextResponse.json({ technician: data })
}
