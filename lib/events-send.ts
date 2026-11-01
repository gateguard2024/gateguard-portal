/**
 * Event campaign emails — the one place that sends them (the Send button and the
 * daily automatic send both come here).
 *
 *   - One personal email per guest (merge fields filled), sent through Resend's
 *     batch API, 100 per call, with an idempotency key per chunk.
 *   - A per-step log (sent_guest_ids) means a retry or "send again" only reaches
 *     guests who haven't had this email yet — nobody gets it twice.
 *   - A lock (status 'sending' + sending_started_at) stops two clicks or two tabs
 *     from both sending; a stuck lock frees itself after 10 minutes.
 *   - Email HTML is cleaned to a small safe set of tags before it goes out.
 */
import crypto from 'node:crypto'
import { eventsDb as sb } from '@/lib/events-access'
import { sendEmailBatch } from '@/lib/email-sender'
import { fillMerge } from '@/lib/events-merge'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>
const LOCK_MS = 10 * 60 * 1000
const MAX_PER_RUN = 1000

export { sanitizeEmailHtml } from '@/lib/events-merge'
import { sanitizeEmailHtml } from '@/lib/events-merge'

const AUDIENCE_OK: Record<string, (g: Row) => boolean> = {
  invited: g => (g.rsvp ?? 'invited') === 'invited',
  yes: g => g.rsvp === 'yes',
  attended: g => g.rsvp === 'attended' || !!g.checked_in_at,
  no_show: g => g.rsvp === 'yes' && !g.checked_in_at,
  all: g => (g.rsvp ?? 'invited') !== 'no',
}
export const inAudience = (aud: string | null | undefined, g: Row) => (AUDIENCE_OK[aud ?? 'all'] ?? AUDIENCE_OK.all)(g)
const validEmail = (e: unknown) => /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(String(e ?? ''))

function footer(evt: Row, host: string) {
  const esc = (x: string) => x.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
  return `<p style="margin-top:24px;color:#8a8a8e;font-size:12px;line-height:1.4">You’re getting this because ${esc(host)} invited you to ${esc(String(evt.title ?? 'an event'))}. Reply “no thanks” and we won’t email you about it again.</p>`
}

export type SendOutcome =
  | { ok: true; sent: number; failed: number; skipped: number; remaining: number; errors?: string[] }
  | { ok: false; status: number; error: string; sent?: number }

/** Build one guest's email. */
export function renderForGuest(step: Row, evt: Row, guest: Row | null, host: { name: string; email?: string | null }) {
  const rsvp = host.email ? `mailto:${host.email}?subject=${encodeURIComponent(`RSVP: ${evt.title ?? 'Event'}`)}` : ''
  const extra = { rsvp_link: rsvp }
  return {
    subject: fillMerge(String(step.email_subject ?? ''), evt, guest, host.name, false, extra).replace(/[\r\n]+/g, ' ').slice(0, 250),
    html: fillMerge(sanitizeEmailHtml(step.email_html), evt, guest, host.name, true, extra) + footer(evt, host.name),
  }
}

/**
 * Send one campaign step to its audience (only guests who haven't had it yet).
 * `host` = who it's from (replies go to them).
 */
export async function sendCampaignStep(eventId: string, stepId: string, host: { name: string; email?: string | null }): Promise<SendOutcome> {
  if (!process.env.RESEND_API_KEY) return { ok: false, status: 503, error: 'Email isn’t set up yet (RESEND_API_KEY is missing).' }
  const { data: step, error } = await sb.from('event_campaign_steps').select('*').eq('id', stepId).eq('event_id', eventId).maybeSingle()
  if (error) return { ok: false, status: 500, error: error.message }
  if (!step) return { ok: false, status: 404, error: 'Email step not found' }
  if (!String(step.email_subject ?? '').trim() || !String(step.email_html ?? '').trim()) return { ok: false, status: 400, error: 'Add a subject and message first.' }

  // Claim the step (one sender at a time).
  // What to go back to if nothing gets sent (a stale 'sending' lock counts as unsent).
  const prevStatus = step.status === 'sending' || !step.status ? ((step.sent_guest_ids ?? []).length ? 'partial' : 'draft') : String(step.status)
  // Atomic claim in the database (migration 208).
  const { data: claimed, error: cErr } = await sb.rpc('claim_campaign_step', { p_step: stepId, p_event: eventId, p_stale_seconds: Math.round(LOCK_MS / 1000) })
  if (cErr) return { ok: false, status: 500, error: cErr.message }
  if (!claimed?.length) return { ok: false, status: 409, error: 'This email is already being sent.' }
  const release = async (status: string, extra: Row = {}) => {
    const { error: rErr } = await sb.from('event_campaign_steps').update({ status, sending_started_at: null, ...extra }).eq('id', stepId).eq('event_id', eventId)
    if (rErr) console.error('[events-send] release failed', rErr.message)
  }

  try {
    const [{ data: evt, error: eErr }, { data: guests, error: gErr }] = await Promise.all([
      sb.from('property_events').select('*').eq('id', eventId).maybeSingle(),
      sb.from('event_guests').select('*').eq('event_id', eventId),
    ])
    if (eErr || gErr || !evt) { await release(prevStatus); return { ok: false, status: 500, error: eErr?.message ?? gErr?.message ?? 'Event not found' } }

    const already = new Set<string>(((claimed[0] as Row).sent_guest_ids ?? []).map(String))
    const audience = ((guests ?? []) as Row[]).filter(g => inAudience(step.audience, g))
    const fresh = audience.filter(g => !already.has(String(g.id)))
    const withEmail = fresh.filter(g => validEmail(g.email))
    const skipped = fresh.length - withEmail.length
    const todo = withEmail.slice(0, MAX_PER_RUN)
    if (!todo.length) {
      await release(prevStatus)
      return already.size
        ? { ok: false, status: 400, error: 'Everyone in this audience already got this email.' }
        : { ok: false, status: 400, error: 'No guests with an email address in this audience.' }
    }

    const sentIds = [...already]
    let sent = 0, lastId: string | null = null
    const errors: string[] = []
    for (let i = 0; i < todo.length; i += 100) {
      const chunk = todo.slice(i, i + 100)
      const emails = chunk.map(g => ({ to: String(g.email).trim(), ...renderForGuest(step, evt, g, host), replyTo: host.email || undefined }))
      const key = `evt-${stepId}-${crypto.createHash('sha256').update(chunk.map(g => g.id).join(',')).digest('hex').slice(0, 32)}`
      const r = await sendEmailBatch(emails, key)
      for (const ok of r.sent) { sentIds.push(String(chunk[ok.index].id)); sent++; lastId = ok.id ?? lastId }
      for (const f of r.failed) if (errors.length < 5) errors.push(`${chunk[f.index].email}: ${f.error}`)
      // Record progress after every chunk, so a timeout never causes a re-send.
      const { error: pErr } = await sb.from('event_campaign_steps').update({ sent_guest_ids: sentIds, sending_started_at: new Date().toISOString() }).eq('id', stepId).eq('event_id', eventId)
      if (pErr) { await release(sent ? 'partial' : prevStatus); return { ok: false, status: 500, error: `Sent ${sent}, but couldn’t record it: ${pErr.message}`, sent } }
    }
    const remaining = withEmail.length - todo.length + (todo.length - sent)
    await release(sent === 0 ? prevStatus : remaining > 0 ? 'partial' : 'sent', sent ? { sent_at: new Date().toISOString(), sent_message_id: lastId } : {})
    if (!sent) return { ok: false, status: 502, error: errors[0] ?? 'Nothing was sent.' }
    return { ok: true, sent, failed: todo.length - sent, skipped, remaining, ...(errors.length ? { errors } : {}) }
  } catch (e) {
    await release(prevStatus)
    return { ok: false, status: 500, error: e instanceof Error ? e.message : 'Send failed' }
  }
}
