/**
 * /api/events/[id]/items — add / edit / remove an event's child items
 * (checklist, supplies, campaign steps, guests). body.kind picks the table;
 * fields are whitelisted per kind. Access: lib/events-access.ts.
 *   POST   { kind, ...fields }            → { item }
 *   POST   { kind: 'guest', rows: [...] } → { items, skipped }   (bulk guest import, max 500)
 *   PATCH  { kind, item_id, ...fields }   → { item }
 *   DELETE ?kind=&item_id=                → { ok }
 */
import { NextRequest, NextResponse } from 'next/server'
import { eventsDb as supabase, guardEvent } from '@/lib/events-access'

export const dynamic = 'force-dynamic'

type Kind = 'checklist' | 'supply' | 'campaign' | 'guest'
const CONFIG: Record<Kind, { table: string; fields: string[]; nums?: string[]; defaults: Record<string, unknown> }> = {
  checklist: { table: 'event_checklist_items', fields: ['title', 'category', 'due_date', 'status', 'owner_name', 'owner_user_id'], defaults: { status: 'open' } },
  supply:    { table: 'event_supplies',        fields: ['item', 'category', 'qty', 'vendor', 'cost', 'needed_by', 'status'], nums: ['qty', 'cost'], defaults: { status: 'needed' } },
  campaign:  { table: 'event_campaign_steps',  fields: ['step', 'audience', 'send_at', 'email_subject', 'email_html', 'status', 'sort_order'], nums: ['sort_order'], defaults: { status: 'draft' } },
  guest:     { table: 'event_guests',          fields: ['name', 'email', 'phone', 'company', 'rsvp', 'notes', 'checked_in_at'], defaults: { rsvp: 'invited' } },
}

function pick(cfg: { fields: string[]; nums?: string[] }, body: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const k of cfg.fields) if (k in body) {
    const v = body[k]
    out[k] = cfg.nums?.includes(k) ? (v === '' || v == null || !isFinite(Number(v)) ? null : Number(v)) : (v === '' ? null : v)
  }
  return out
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guardEvent(params.id); if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status })
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const kind = body.kind as Kind
  const cfg = CONFIG[kind]; if (!cfg) return NextResponse.json({ error: 'Unknown kind' }, { status: 400 })

  // Bulk guest import (pasted list / CSV). Skips blanks and emails already on the list.
  if (kind === 'guest' && Array.isArray(body.rows)) {
    const { data: existing, error: exErr } = await supabase.from('event_guests').select('email').eq('event_id', params.id)
    if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 })
    const seen = new Set((existing ?? []).map(r => String(r.email ?? '').toLowerCase()).filter(Boolean))
    const rows: Record<string, unknown>[] = []
    let skipped = 0
    for (const raw of (body.rows as Record<string, unknown>[]).slice(0, 500)) {
      const r = pick(cfg, raw ?? {})
      const name = String(r.name ?? '').trim(); const email = String(r.email ?? '').trim().toLowerCase()
      if (!name && !email) { skipped++; continue }
      if (email && seen.has(email)) { skipped++; continue }
      if (email) seen.add(email)
      rows.push({ event_id: params.id, ...cfg.defaults, ...r, name: name || email, email: email || null })
    }
    if (!rows.length) return NextResponse.json({ items: [], skipped })
    const { data, error } = await supabase.from('event_guests').insert(rows).select()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ items: data ?? [], skipped })
  }

  const row = { event_id: params.id, ...cfg.defaults, ...pick(cfg, body) }
  const { data, error } = await supabase.from(cfg.table).insert(row).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guardEvent(params.id); if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status })
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
  const g = await guardEvent(params.id); if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status })
  const kind = req.nextUrl.searchParams.get('kind') as Kind
  const itemId = req.nextUrl.searchParams.get('item_id') ?? ''
  const cfg = CONFIG[kind]; if (!cfg) return NextResponse.json({ error: 'Unknown kind' }, { status: 400 })
  if (!itemId) return NextResponse.json({ error: 'item_id required' }, { status: 400 })
  const { error } = await supabase.from(cfg.table).delete().eq('id', itemId).eq('event_id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
