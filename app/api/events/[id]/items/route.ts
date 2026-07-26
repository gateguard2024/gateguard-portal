/**
 * /api/events/[id]/items — add / edit / remove an event's child items
 * (checklist, supplies, campaign steps, guests). All scoped to the event's org.
 * body.kind selects the table; fields are whitelisted per kind.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

type Kind = 'checklist' | 'supply' | 'campaign' | 'guest'
const CONFIG: Record<Kind, { table: string; fields: string[]; defaults: Record<string, unknown> }> = {
  checklist: { table: 'event_checklist_items', fields: ['title', 'category', 'due_date', 'status'], defaults: { status: 'open' } },
  supply:    { table: 'event_supplies',        fields: ['item', 'qty', 'vendor', 'status'],       defaults: { status: 'needed' } },
  campaign:  { table: 'event_campaign_steps',  fields: ['step', 'send_at', 'email_subject', 'status', 'sort_order'], defaults: { status: 'draft' } },
  guest:     { table: 'event_guests',          fields: ['name', 'email', 'rsvp'],                 defaults: { rsvp: 'invited' } },
}

// Verify the event exists and the caller may edit it (own org or corporate).
async function guard(eventId: string) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const { data: evt } = await supabase.from('property_events').select('org_id').eq('id', eventId).maybeSingle()
  if (!evt) return { error: 'Event not found', status: 404 as const }
  if (!user.isCorporate && evt.org_id && evt.org_id !== user.org_id) return { error: 'Forbidden', status: 403 as const }
  return { ok: true as const }
}

function pick(cfg: { fields: string[] }, body: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const k of cfg.fields) if (k in body) out[k] = body[k]
  return out
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(params.id); if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status })
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const kind = body.kind as Kind
  const cfg = CONFIG[kind]; if (!cfg) return NextResponse.json({ error: 'Unknown kind' }, { status: 400 })
  const row = { event_id: params.id, ...cfg.defaults, ...pick(cfg, body) }
  const { data, error } = await supabase.from(cfg.table).insert(row).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(params.id); if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status })
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const kind = body.kind as Kind
  const cfg = CONFIG[kind]; if (!cfg) return NextResponse.json({ error: 'Unknown kind' }, { status: 400 })
  const itemId = String(body.item_id ?? ''); if (!itemId) return NextResponse.json({ error: 'item_id required' }, { status: 400 })
  const patch = pick(cfg, body)
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'No editable fields' }, { status: 400 })
  const { data, error } = await supabase.from(cfg.table).update(patch).eq('id', itemId).eq('event_id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(params.id); if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status })
  const kind = req.nextUrl.searchParams.get('kind') as Kind
  const itemId = req.nextUrl.searchParams.get('item_id') ?? ''
  const cfg = CONFIG[kind]; if (!cfg) return NextResponse.json({ error: 'Unknown kind' }, { status: 400 })
  if (!itemId) return NextResponse.json({ error: 'item_id required' }, { status: 400 })
  const { error } = await supabase.from(cfg.table).delete().eq('id', itemId).eq('event_id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
