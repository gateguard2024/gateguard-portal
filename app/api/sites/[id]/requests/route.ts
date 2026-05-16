import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/sites/[id]/requests — list all requests for a specific site
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await supabase
    .from('wo_requests')
    .select('*')
    .eq('site_id', params.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ requests: data ?? [] })
}

// PATCH /api/sites/[id]/requests — update a request (convert to WO, close, etc.)
export async function PATCH(req: NextRequest, _ctx: { params: { id: string } }) {
  const body = await req.json()
  const { request_id, status, converted_wo_id } = body

  if (!request_id) return NextResponse.json({ error: 'request_id required' }, { status: 400 })

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (status)           update.status           = status
  if (converted_wo_id) update.converted_wo_id  = converted_wo_id

  const { data, error } = await supabase
    .from('wo_requests')
    .update(update)
    .eq('id', request_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ request: data })
}
