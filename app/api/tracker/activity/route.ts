import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ activity: [] })

  const { searchParams } = new URL(req.url)
  const item_id = searchParams.get('item_id')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from('tracker_activity')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (item_id) query = query.eq('item_id', item_id)

  const { data, error } = await query
  if (error) return NextResponse.json({ activity: [] })
  return NextResponse.json({ activity: data ?? [] })
}

interface ActivityBody {
  item_id: string
  action: string
  field_name?: string
  old_value?: string
  new_value?: string
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as ActivityBody

  const { data, error } = await supabase.from('tracker_activity').insert({
    item_id:    body.item_id,
    org_id:     user.org_id,
    user_id:    user.id,
    user_name:  user.name,
    action:     body.action,
    field_name: body.field_name ?? null,
    old_value:  body.old_value ?? null,
    new_value:  body.new_value ?? null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ activity: data }, { status: 201 })
}
