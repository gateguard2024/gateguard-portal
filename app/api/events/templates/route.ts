import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const EDITABLE = ['name', 'event_type', 'description', 'default_budget'] as const

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // Corporate starters (org_id NULL) + this org's own templates.
  const { data, error } = await supabase.from('event_templates').select('*')
    .or(`org_id.is.null,org_id.eq.${user.org_id ?? '00000000-0000-0000-0000-000000000000'}`)
    .order('is_starter', { ascending: false }).order('name', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ templates: data ?? [] })
}

// Create an editable template (owned by the caller's org — never a starter).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  if (!String(body.name ?? '').trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  const { data, error } = await supabase.from('event_templates').insert({
    org_id: user.org_id ?? null,
    is_starter: false,
    name: String(body.name).trim(),
    event_type: String(body.event_type ?? 'launch_party'),
    description: body.description ? String(body.description) : null,
    default_budget: body.default_budget != null && body.default_budget !== '' ? Number(body.default_budget) : null,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ template: data })
}

// Edit a template. Org templates: caller's org only. Starters (org_id null): corporate only.
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const id = String(body.id ?? '')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  const { data: tpl } = await supabase.from('event_templates').select('org_id').eq('id', id).maybeSingle()
  const row = tpl as { org_id?: string | null } | null
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const isStarter = row.org_id == null
  if (isStarter ? !user.isCorporate : row.org_id !== user.org_id) {
    return NextResponse.json({ error: isStarter ? 'Starter templates are edited by Gate Guard corporate.' : 'Not your template.' }, { status: 403 })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = {}
  for (const k of EDITABLE) if (k in body) patch[k] = k === 'default_budget' ? (body[k] != null && body[k] !== '' ? Number(body[k]) : null) : body[k]
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'No editable fields' }, { status: 400 })
  const { data, error } = await supabase.from('event_templates').update(patch).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ template: data })
}
