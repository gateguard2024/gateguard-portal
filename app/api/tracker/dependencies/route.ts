import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const itemId = searchParams.get('item_id')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase.from('tracker_dependencies').select('*')
  if (itemId) {
    query = query.or(`from_item_id.eq.${itemId},to_item_id.eq.${itemId}`)
  }
  const { data, error } = await query
  if (error) return NextResponse.json({ dependencies: [] })
  return NextResponse.json({ dependencies: data ?? [] })
}

interface DependencyBody {
  from_item_id: string
  to_item_id: string
  dep_type?: string
  lag_days?: number
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json() as DependencyBody
  const { data, error } = await supabase.from('tracker_dependencies').insert({
    from_item_id: body.from_item_id,
    to_item_id: body.to_item_id,
    dep_type: body.dep_type ?? 'finish_to_start',
    lag_days: body.lag_days ?? 0,
    org_id: user.org_id,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ dependency: data })
}

interface DeleteBody {
  id: string
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json() as DeleteBody
  await supabase.from('tracker_dependencies').delete().eq('id', id)
  return NextResponse.json({ success: true })
}
