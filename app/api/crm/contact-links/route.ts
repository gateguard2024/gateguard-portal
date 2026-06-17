/**
 * Contacts ⇄ records (many-to-many).
 *   GET    ?entity_type=&entity_id=   → contacts attached to a record
 *   GET    ?contact_id=               → records a contact is attached to
 *   POST   { contact_id, entity_type, entity_id, role?, is_primary? }  → attach
 *   DELETE ?id=   OR   ?contact_id=&entity_type=&entity_id=            → detach
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser, type PortalUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const fullName = (c: { first_name?: string | null; last_name?: string | null; email?: string | null }) =>
  [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || c.email || 'Contact'

export async function GET(req: NextRequest) {
  await getCurrentUser()
  const { searchParams } = new URL(req.url)
  const entityType = clean(searchParams.get('entity_type'))
  const entityId = clean(searchParams.get('entity_id'))
  const contactId = clean(searchParams.get('contact_id'))

  if (entityType && entityId) {
    const { data: links, error } = await supabase
      .from('contact_links').select('id, contact_id, role, is_primary')
      .eq('entity_type', entityType).eq('entity_id', entityId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const ids = (links ?? []).map(l => l.contact_id)
    const { data: contacts } = ids.length
      ? await supabase.from('contacts').select('id, first_name, last_name, email, phone, title').in('id', ids)
      : { data: [] }
    const byId = new Map((contacts ?? []).map(c => [c.id, c]))
    const rows = (links ?? []).map(l => {
      const c = byId.get(l.contact_id) as { first_name?: string; last_name?: string; email?: string; phone?: string; title?: string } | undefined
      return { link_id: l.id, contact_id: l.contact_id, role: l.role, is_primary: l.is_primary, name: c ? fullName(c) : 'Contact', email: c?.email ?? null, phone: c?.phone ?? null, title: c?.title ?? null }
    })
    return NextResponse.json({ contacts: rows })
  }

  if (contactId) {
    const { data, error } = await supabase
      .from('contact_links').select('id, entity_type, entity_id, role, is_primary')
      .eq('contact_id', contactId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ links: data ?? [] })
  }

  return NextResponse.json({ error: 'entity_type+entity_id or contact_id required' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const user: PortalUser = await getCurrentUser()
  const body = await req.json().catch(() => ({}))
  const contact_id = clean(body.contact_id)
  const entity_type = clean(body.entity_type)
  const entity_id = clean(body.entity_id)
  if (!contact_id || !entity_type || !entity_id) {
    return NextResponse.json({ error: 'contact_id, entity_type, entity_id required' }, { status: 400 })
  }
  const { data, error } = await supabase
    .from('contact_links')
    .upsert({ contact_id, entity_type, entity_id, role: clean(body.role) || null, is_primary: body.is_primary === true, created_by: user.id }, { onConflict: 'contact_id,entity_type,entity_id' })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  await getCurrentUser()
  const { searchParams } = new URL(req.url)
  const id = clean(searchParams.get('id'))
  let q = supabase.from('contact_links').delete()
  if (id) q = q.eq('id', id)
  else {
    const ct = clean(searchParams.get('contact_id')), et = clean(searchParams.get('entity_type')), ei = clean(searchParams.get('entity_id'))
    if (!ct || !et || !ei) return NextResponse.json({ error: 'id or (contact_id+entity_type+entity_id) required' }, { status: 400 })
    q = q.eq('contact_id', ct).eq('entity_type', et).eq('entity_id', ei)
  }
  const { error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
