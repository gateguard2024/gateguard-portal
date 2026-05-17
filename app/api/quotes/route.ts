import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const caller = await getCurrentUser()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  let query = supabase
    .from('quotes')
    .select(`
      id, quote_number, title, status,
      total_one_time, total_mrr,
      valid_until, accepted_at, created_at, updated_at,
      org_id, client_org_id,
      client_org:organizations!quotes_client_org_id_fkey(id, name)
    `)
    .order('created_at', { ascending: false })

  if (!caller.isCorporate && caller.org_id) {
    query = query.eq('org_id', caller.org_id)
  }
  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ quotes: data ?? [] })
}

export async function POST(req: NextRequest) {
  const caller = await getCurrentUser()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { title, client_org_id, total_one_time, total_mrr, valid_until, notes } = body as Record<string, unknown>

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const org_id = (body.org_id as string | null) ?? caller.org_id
  if (!org_id) {
    return NextResponse.json({ error: 'org_id is required' }, { status: 400 })
  }

  // Auto-generate quote_number GQ-YYYY-NNN
  const year = new Date().getFullYear()
  const { count } = await supabase
    .from('quotes')
    .select('*', { count: 'exact', head: true })
  const seq = String((count ?? 0) + 1).padStart(4, '0')
  const quote_number = `GQ-${year}-${seq}`

  const { data, error } = await supabase
    .from('quotes')
    .insert({
      org_id,
      client_org_id: client_org_id ?? null,
      quote_number,
      title,
      status: 'draft',
      total_one_time: total_one_time ?? 0,
      total_mrr: total_mrr ?? 0,
      valid_until: valid_until ?? null,
      notes: notes ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ quote: data }, { status: 201 })
}
