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
  const board_id = searchParams.get('board_id')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from('tracker_automations')
    .select('*')
    .eq('org_id', user.org_id ?? '00000000-0000-0000-0000-000000000000')
    .order('created_at', { ascending: false })

  if (board_id) query = query.eq('board_id', board_id)

  const { data, error } = await query
  if (error) return NextResponse.json({ automations: [] })
  return NextResponse.json({ automations: data ?? [] })
}

interface AutomationBody {
  name: string
  trigger_type: string
  trigger_config?: Record<string, unknown>
  action_type: string
  action_config?: Record<string, unknown>
  board_id?: string
  enabled?: boolean
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json() as AutomationBody

  if (!body.name || !body.trigger_type || !body.action_type) {
    return NextResponse.json({ error: 'name, trigger_type, action_type required' }, { status: 400 })
  }

  const { data, error } = await supabase.from('tracker_automations').insert({
    org_id: user.org_id,
    board_id: body.board_id ?? null,
    name: body.name,
    trigger_type: body.trigger_type,
    trigger_config: body.trigger_config ?? {},
    action_type: body.action_type,
    action_config: body.action_config ?? {},
    enabled: body.enabled ?? true,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ automation: data }, { status: 201 })
}

interface PatchBody {
  id: string
  enabled?: boolean
  name?: string
  trigger_config?: Record<string, unknown>
  action_config?: Record<string, unknown>
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json() as PatchBody
  const { id, ...patch } = body

  const { data, error } = await supabase.from('tracker_automations')
    .update(patch)
    .eq('id', id)
    .eq('org_id', user.org_id ?? '')
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ automation: data })
}
