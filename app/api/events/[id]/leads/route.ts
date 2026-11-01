/**
 * POST /api/events/[id]/leads — turn event guests into sales leads.
 *   body { guest_ids?: string[] }  (omit → every guest who said yes / attended / checked in)
 *   → { created, skipped, leads: [{ guest_id, lead_id }] }
 * Guests that already have a lead are skipped. Leads are owned by the event's
 * company (or the caller's), source = 'event', with a note naming the event.
 */
import { NextRequest, NextResponse } from 'next/server'
import { eventsDb as supabase, guardEvent } from '@/lib/events-access'

export const dynamic = 'force-dynamic'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guardEvent(params.id); if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status })
  const { user, event } = g as { user: Row; event: Row }
  const body = await req.json().catch(() => ({} as Row))
  const ids: string[] | null = Array.isArray(body.guest_ids) ? body.guest_ids.map(String) : null

  const { data: guests, error } = await supabase.from('event_guests').select('*').eq('event_id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const pickList = ((guests ?? []) as Row[]).filter(gu => ids ? ids.includes(gu.id) : (gu.rsvp === 'yes' || gu.rsvp === 'attended' || !!gu.checked_in_at))
  const out: { guest_id: string; lead_id: string }[] = []
  let skipped = 0
  const when = event.event_date ? ` on ${event.event_date}` : ''
  for (const gu of pickList) {
    if (gu.lead_id) { skipped++; continue }
    const { data: lead, error: lErr } = await supabase.from('leads').insert({
      org_id: event.org_id ?? user.org_id ?? null,
      assigned_to: user.id,
      company_name: gu.company || gu.name,
      contact_name: gu.name,
      email: gu.email || null,
      phone: gu.phone || null,
      location: event.property_name || event.venue || null,
      stage: 'new',
      source: 'event',
      notes: `Met at "${event.title}"${when}.${gu.notes ? ` ${gu.notes}` : ''}`,
    }).select('id').single()
    if (lErr || !lead) return NextResponse.json({ error: lErr?.message ?? 'Lead create failed', created: out.length, leads: out }, { status: 500 })
    const { error: uErr } = await supabase.from('event_guests').update({ lead_id: lead.id }).eq('id', gu.id).eq('event_id', params.id)
    if (uErr) return NextResponse.json({ error: `Lead made but not linked: ${uErr.message}`, created: out.length + 1, leads: [...out, { guest_id: gu.id, lead_id: lead.id }] }, { status: 500 })
    out.push({ guest_id: gu.id, lead_id: lead.id })
  }
  return NextResponse.json({ created: out.length, skipped, leads: out })
}
