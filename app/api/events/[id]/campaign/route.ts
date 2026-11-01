/**
 * POST /api/events/[id]/campaign — send one campaign email.
 *   body { step_id, test?: boolean }
 *   test → sends only to the caller (subject prefixed [Test]); nothing is marked sent.
 *   else → sends to the step's audience — only guests who haven't had it yet —
 *          one personal email each (lib/events-send.ts), then marks the step
 *          'sent' (or 'partial' if some are left).
 *   → { sent, failed, skipped, remaining, errors? }
 * Audience: all (everyone but "no") · invited (no reply yet) · yes · attended · no_show.
 */
import { NextRequest, NextResponse } from 'next/server'
import { eventsDb as supabase, guardEvent } from '@/lib/events-access'
import { sendEmail } from '@/lib/email-sender'
import { renderForGuest, sendCampaignStep } from '@/lib/events-send'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guardEvent(params.id); if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status })
  const { user, event } = g as { user: Row; event: Row }
  const body = await req.json().catch(() => ({} as Row))
  const stepId = String(body.step_id ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(stepId)) return NextResponse.json({ error: 'Email step not found' }, { status: 404 })
  const host = { name: String(event.host_name || user.name || 'Gate Guard'), email: user.email || null }

  if (body.test) {
    if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'Email isn’t set up yet (RESEND_API_KEY is missing).' }, { status: 503 })
    if (!user.email) return NextResponse.json({ error: 'Your account has no email address.' }, { status: 400 })
    const { data: step, error } = await supabase.from('event_campaign_steps').select('*').eq('id', stepId).eq('event_id', params.id).maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!step) return NextResponse.json({ error: 'Email step not found' }, { status: 404 })
    if (!step.email_subject || !step.email_html) return NextResponse.json({ error: 'Add a subject and message first.' }, { status: 400 })
    const m = renderForGuest(step, event, { name: user.name }, host)
    const r = await sendEmail({ to: user.email, subject: `[Test] ${m.subject}`, html: m.html, replyTo: user.email })
    if (!r.success) return NextResponse.json({ error: r.error ?? 'Send failed' }, { status: 502 })
    return NextResponse.json({ sent: 1, failed: 0, skipped: 0, remaining: 0, test: true })
  }

  const r = await sendCampaignStep(params.id, stepId, host)
  if (!r.ok) return NextResponse.json({ error: r.error, ...(r.sent ? { sent: r.sent } : {}) }, { status: r.status })
  return NextResponse.json(r)
}
