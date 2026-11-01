/**
 * POST /api/events/[id]/campaign — send one campaign email.
 *   body { step_id, test?: boolean }
 *   test → sends only to the caller (subject prefixed [Test]); nothing is marked sent.
 *   else → sends to the step's audience on the guest list, one email per guest
 *          (so merge fields are personal), then marks the step sent.
 *   → { sent, failed, skipped, errors? }
 * Audience: all (everyone but "no") · invited (no reply yet) · yes · attended · no_show.
 */
import { NextRequest, NextResponse } from 'next/server'
import { eventsDb as supabase, guardEvent } from '@/lib/events-access'
import { sendEmail } from '@/lib/email-sender'
import { fillMerge } from '@/lib/events-merge'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>
const MAX = 300

function inAudience(aud: string | null | undefined, g: Row) {
  const r = g.rsvp ?? 'invited'
  switch (aud) {
    case 'invited': return r === 'invited'
    case 'yes': return r === 'yes'
    case 'attended': return r === 'attended' || !!g.checked_in_at
    case 'no_show': return r === 'yes' && !g.checked_in_at
    default: return r !== 'no'
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guardEvent(params.id); if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status })
  const { user, event } = g as { user: Row; event: Row }
  const body = await req.json().catch(() => ({} as Row))
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'Email isn’t set up yet (RESEND_API_KEY is missing).' }, { status: 503 })
  if (!/^[0-9a-f-]{36}$/i.test(String(body.step_id ?? ''))) return NextResponse.json({ error: 'Email step not found' }, { status: 404 })
  const { data: step, error } = await supabase.from('event_campaign_steps').select('*').eq('id', String(body.step_id ?? '')).eq('event_id', params.id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!step) return NextResponse.json({ error: 'Email step not found' }, { status: 404 })
  if (!step.email_subject || !step.email_html) return NextResponse.json({ error: 'Add a subject and message first.' }, { status: 400 })
  const host = event.host_name || user.name || 'Gate Guard'

  if (body.test) {
    if (!user.email) return NextResponse.json({ error: 'Your account has no email address.' }, { status: 400 })
    const r = await sendEmail({ to: user.email, subject: `[Test] ${fillMerge(step.email_subject, event, { name: user.name }, host, false)}`, html: fillMerge(step.email_html, event, { name: user.name }, host), replyTo: user.email })
    if (!r.success) return NextResponse.json({ error: r.error ?? 'Send failed' }, { status: 502 })
    return NextResponse.json({ sent: 1, failed: 0, skipped: 0, test: true })
  }
  if (step.status === 'sent' && !body.resend) return NextResponse.json({ error: 'This email was already sent.' }, { status: 409 })

  const { data: guests, error: gErr } = await supabase.from('event_guests').select('*').eq('event_id', params.id)
  if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })
  const list = ((guests ?? []) as Row[]).filter(x => inAudience(step.audience, x))
  const withEmail = list.filter(x => /.+@.+\..+/.test(String(x.email ?? ''))).slice(0, MAX)
  const skipped = list.length - withEmail.length
  if (!withEmail.length) return NextResponse.json({ error: 'No guests with an email address in this audience.' }, { status: 400 })

  let sent = 0; let lastId: string | null = null
  const errors: string[] = []
  for (const guest of withEmail) {
    const r = await sendEmail({ to: String(guest.email), subject: fillMerge(step.email_subject, event, guest, host, false), html: fillMerge(step.email_html, event, guest, host), replyTo: user.email || undefined })
    if (r.success) { sent++; lastId = r.id ?? lastId } else if (errors.length < 5) errors.push(`${guest.email}: ${r.error}`)
  }
  if (sent) {
    const { error: uErr } = await supabase.from('event_campaign_steps').update({ status: 'sent', sent_message_id: lastId }).eq('id', step.id).eq('event_id', params.id)
    if (uErr) return NextResponse.json({ error: `Sent ${sent}, but couldn’t mark it sent: ${uErr.message}`, sent }, { status: 500 })
  }
  return NextResponse.json({ sent, failed: withEmail.length - sent, skipped, ...(errors.length ? { errors } : {}) }, { status: sent ? 200 : 502 })
}
