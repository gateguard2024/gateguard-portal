/**
 * Email sequences in Leads — the rules (migration 240).
 *
 * A rep starts a sequence on a lead. Each step is a short personal email sent from THAT
 * rep's own Gmail (no newsletter look), logged on the lead's timeline; Gmail's sent copy
 * shows up in Nexus Mail through the normal mailbox sync.
 *
 * It stops by itself when:
 *   • the lead replies (any email from the lead's address after the start) — a reply that
 *     starts with "stop" / "unsubscribe" also marks the lead Do not email
 *   • an email bounces (mailer-daemon / postmaster in the conversation)
 *   • the lead is marked Lost, made an opportunity (Won), deleted, or set Do not email
 *   • the lead is marked Stuck while it runs (lead-window calls stopLeadRuns) — but you
 *     CAN start a sequence on a lead that's already Stuck (that's what "Gone quiet" is for)
 *   • the rep presses Stop
 *
 * Sending rules: weekdays 8:00–17:00 Eastern only (the runner fires every 2 minutes in
 * that window and sends at most ONE email per rep per run, so a rep's emails are ~2 min
 * apart); at most 50 sequence emails per rep per day; one live sequence per lead; never
 * to a lead with no email or marked Do not email. A step can only be sent once (unique
 * run + step). The FIRST email goes right away when the rep presses Start (it's a person
 * sending an email) unless they're over the daily cap — then it waits for the next slot.
 * If the rep's Gmail needs reconnecting, the sequence pauses and says so — it never falls
 * back to another address.
 */
import { createClient } from '@supabase/supabase-js'
import type { PortalUser } from '@/lib/current-user'
import { normalizeRole } from '@/lib/permissions'
import { resolveOrgScope } from '@/lib/org-scope'
import { sendViaGmail, isReconnectError, type OutboundEmail } from '@/lib/mail-send'
import { signatureParts } from '@/lib/mail-signature'
import { todayET, etMidnight, addDaysISO, etDateOf } from '@/lib/tz'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

export const DAILY_CAP = 50
export const SEND_START_MIN = 8 * 60      // 8:00 ET
export const SEND_END_MIN = 17 * 60       // 17:00 ET (exclusive)
export const VARS = ['first_name', 'contact_name', 'property', 'company', 'units', 'city', 'rep_name', 'rep_first'] as const
export const STOP_LINE = 'If this isn’t a fit, just reply "stop" and I won’t email you about it again.'

export const STOP_TEXT: Record<string, string> = {
  replied: 'They replied', bounced: 'The email bounced', lost: 'Lead marked Lost', won: 'Made an opportunity (Won)',
  stuck: 'Lead marked Stuck', do_not_email: 'Lead is set to Do not email', no_email: 'Lead has no email address',
  deleted: 'Lead was deleted', manual: 'Stopped by hand', sequence_empty: 'The sequence has no emails',
}
export const PAUSE_TEXT: Record<string, string> = {
  gmail: 'Your Gmail needs reconnecting (Mail → Settings) — press Resume after.',
  errors: 'Sending failed 3 times in a row — check the last error, then press Resume.',
  manual: 'Paused by hand.',
}

/** True when the 240 tables aren't there yet (an older database). */
export const needsMigration = (e: { message?: string; code?: string } | null | undefined) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /lead_sequence|do_not_email|relation .* does not exist|schema cache/i.test(e.message ?? ''))
export const MIGRATION_MSG = 'Email sequences need database update 240 — ask Gate Guard to run migration 240.'

// ── Time ─────────────────────────────────────────────────────────────────────
const minutesET = (d: Date) => { const [h, m] = d.toLocaleTimeString('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).split(':').map(Number); return h * 60 + m }
const weekdayET = (ymd: string) => new Date(`${ymd}T12:00:00Z`).getUTCDay() // 0 Sun … 6 Sat
const atET = (ymd: string, min: number) => new Date(etMidnight(ymd).getTime() + min * 60000)

/** Is `d` inside the sending window (weekday 8:00–17:00 ET)? */
export function inWindow(d = new Date()): boolean {
  const ymd = etDateOf(d.toISOString()); const wd = weekdayET(ymd); const m = minutesET(d)
  return wd >= 1 && wd <= 5 && m >= SEND_START_MIN && m < SEND_END_MIN
}
/** The first moment at or after `d` that's inside the sending window. */
export function nextWindow(d: Date): Date {
  if (inWindow(d)) return d
  let ymd = etDateOf(d.toISOString())
  if (minutesET(d) < SEND_START_MIN && weekdayET(ymd) >= 1 && weekdayET(ymd) <= 5) return atET(ymd, SEND_START_MIN + 30)
  for (let i = 0; i < 8; i++) { ymd = addDaysISO(ymd, 1); const wd = weekdayET(ymd); if (wd >= 1 && wd <= 5) return atET(ymd, SEND_START_MIN + 30) }
  return d
}
/** When step `dayOffset` is due for a run started at `startedAt` — same clock time as the start
 *  (kept inside 8:30–16:30 ET), moved to the next weekday if needed, never before `notBefore`. */
export function dueAt(startedAt: string, dayOffset: number, notBefore = new Date()): Date {
  const start = new Date(startedAt)
  const clock = Math.min(Math.max(minutesET(start), SEND_START_MIN + 30), SEND_END_MIN - 30)
  let day = addDaysISO(etDateOf(startedAt), dayOffset)
  for (let i = 0; i < 3 && (weekdayET(day) === 0 || weekdayET(day) === 6); i++) day = addDaysISO(day, 1) // weekend → Monday, same time
  const t = nextWindow(atET(day, clock))
  return t.getTime() < notBefore.getTime() ? nextWindow(notBefore) : t
}

// ── Filling in the template ──────────────────────────────────────────────────
export function leadVars(lead: Row, rep: { name?: string | null }) {
  const contact = String(lead.contact_name ?? '').trim()
  const first = contact.split(/\s+/)[0] ?? ''
  const prop = String(lead.property_name ?? '').trim() || String(lead.company_name ?? '').trim()
  const repName = String(rep.name ?? '').trim()
  return {
    first_name: first, contact_name: contact, property: prop, company: String(lead.company_name ?? '').trim(),
    units: lead.unit_count != null ? String(lead.unit_count) : '', city: String(lead.city ?? '').trim() || String(lead.location ?? '').split(',')[0].trim(),
    rep_name: repName, rep_first: repName.split(/\s+/)[0] ?? '',
  } as Record<(typeof VARS)[number], string>
}
const FALLBACK: Partial<Record<(typeof VARS)[number], string>> = { first_name: 'there', contact_name: 'there', property: 'your property', company: 'your company', units: 'your', city: 'your area' }

/** Replace {vars}. Empty values use a safe fallback ("there", "your property") and are listed in `missing`. */
export function fill(text: string, vars: Record<string, string>): { text: string; missing: string[] } {
  const missing = new Set<string>()
  const out = String(text ?? '').replace(/\{\s*([a-z_]+)\s*\}/gi, (m, k: string) => {
    const key = k.toLowerCase()
    if (!(VARS as readonly string[]).includes(key)) return m
    const v = vars[key]
    if (v) return v
    missing.add(key)
    return FALLBACK[key as (typeof VARS)[number]] ?? ''
  })
  return { text: out, missing: [...missing] }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
/** Plain text → a plain personal-looking HTML email (paragraphs, no styling tricks). */
export function toHtml(text: string) {
  return String(text).trim().split(/\n{2,}/).map((p) => `<p style="margin:0 0 12px">${esc(p).replace(/\n/g, '<br>')}</p>`).join('')
}

// ── Reading ──────────────────────────────────────────────────────────────────
export type Step = { id: string; sequence_id: string; step_no: number; day_offset: number; subject: string; body: string; same_thread: boolean }
export type Sequence = { id: string; org_id: string | null; name: string; description: string | null; active: boolean; steps: Step[]; [k: string]: unknown }

/** Sequences this person may START (and, for managers, edit). */
export async function visibleSequences(user: PortalUser, includeInactive = false): Promise<{ error: { message?: string; code?: string } } | { sequences: Sequence[] }> {
  let q = sb.from('lead_sequences').select('*').order('name')
  if (!includeInactive) q = q.eq('active', true)
  const { data, error } = await q
  if (error) return { error }
  const scope = await resolveOrgScope(user)
  const rows = ((data ?? []) as Row[]).filter((s) => s.org_id == null ? user.isCorporate : scope.all || scope.ids.includes(s.org_id))
  if (!rows.length) return { sequences: [] }
  const { data: steps, error: sErr } = await sb.from('lead_sequence_steps').select('*').in('sequence_id', rows.map((s) => s.id)).order('step_no')
  if (sErr) return { error: sErr }
  const by = new Map<string, Step[]>()
  for (const st of (steps ?? []) as Step[]) { const l = by.get(st.sequence_id) ?? []; l.push(st); by.set(st.sequence_id, l) }
  return { sequences: rows.map((s) => ({ ...s, steps: by.get(s.id) ?? [] }) as Sequence) }
}

/** Who may create / edit sequences: Gate Guard admins (all + Gate Guard's own), dealer admins (their company's). */
export function canManage(user: PortalUser) { return normalizeRole(user.role) === 'admin' }
export async function canEditSequence(user: PortalUser, orgId: string | null) {
  if (!canManage(user)) return false
  if (orgId == null) return user.isCorporate
  if (user.isCorporate) return true
  const scope = await resolveOrgScope(user)
  return scope.all || scope.ids.includes(orgId)
}

async function stepsOf(sequenceId: string): Promise<Step[]> {
  const { data, error } = await sb.from('lead_sequence_steps').select('*').eq('sequence_id', sequenceId).order('step_no')
  if (error) throw new Error(error.message)
  return (data ?? []) as Step[]
}

/** The rep's own Gmail connector (active, with a token). */
export async function gmailFor(userId: string) {
  const { data, error } = await sb.from('message_channels').select('*').eq('user_id', userId).eq('channel_type', 'gmail').eq('is_active', true)
    .not('oauth_refresh_token', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error) return null
  return data as Row | null
}

/** Sequence emails this rep has sent today (Eastern). */
export async function sentToday(userId: string) {
  const { count } = await sb.from('lead_sequence_sends').select('id', { count: 'exact', head: true }).eq('user_id', userId).neq('status', 'failed').gte('sent_at', etMidnight(todayET()).toISOString())
  return count ?? 0
}

/** Why this lead must not get sequence email right now (null = fine). Stuck is NOT a block. */
export function blockReason(lead: Row | null): string | null {
  if (!lead || lead.deleted_at) return 'deleted'
  if (lead.do_not_email) return 'do_not_email'
  if (lead.opportunity_id || /^(converted|won|closed[_ ]?won)$/i.test(String(lead.stage ?? ''))) return 'won'
  if (lead.lost_at || /^(lost|dead|closed|closed[_ ]?lost)$/i.test(String(lead.stage ?? ''))) return 'lost'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(lead.email ?? '').trim())) return 'no_email'
  return null
}

const BOUNCE_FROM = /^(mailer-daemon|postmaster)@/i
const STOP_WORDS = /^\s*(stop|unsubscribe|remove me|please remove|take me off)\b/i

/** Did they answer (or did it bounce) since the run started? */
export async function checkReplies(run: Row): Promise<{ kind: 'replied' | 'bounced'; stopWord: boolean } | null> {
  const email = String(run.to_email ?? '').trim().toLowerCase()
  const since = String(run.started_at)
  // Bounces land in the conversation step 1 started.
  if (run.gmail_thread_id) {
    let tq = sb.from('message_threads').select('id').eq('external_thread_id', run.gmail_thread_id)
    if (run.channel_id) tq = tq.eq('channel_id', run.channel_id)
    const { data: ths } = await tq.limit(5)
    const tids = ((ths ?? []) as Row[]).map((t) => t.id)
    if (tids.length) {
      const { data: inb } = await sb.from('messages').select('from_address, body, created_at').in('thread_id', tids).eq('direction', 'inbound').gte('created_at', since).limit(20)
      for (const m of (inb ?? []) as Row[]) if (BOUNCE_FROM.test(String(m.from_address ?? ''))) return { kind: 'bounced', stopWord: false }
    }
  }
  if (!email) return null
  const { data: rep } = await sb.from('messages').select('from_address, body, created_at').eq('direction', 'inbound').ilike('from_address', email.replace(/[%_]/g, '\\$&')).gte('created_at', since).order('created_at', { ascending: true }).limit(5)
  const first = ((rep ?? []) as Row[])[0]
  if (!first) return null
  const firstLine = String(first.body ?? '').split('\n').map((l) => l.trim()).find(Boolean) ?? ''
  return { kind: 'replied', stopWord: STOP_WORDS.test(firstLine) }
}

// ── Timeline ─────────────────────────────────────────────────────────────────
async function timeline(lead: Row, row: Row) {
  const { error } = await sb.from('crm_activities').insert({ lead_id: lead.id, dealer_org_id: lead.org_id ?? null, ...row })
  if (error) console.error('[sequences] timeline note not saved:', error.message)
}

// ── Stopping / pausing ───────────────────────────────────────────────────────
export async function stopRun(run: Row, reason: string, lead?: Row | null, byName?: string | null) {
  const now = new Date().toISOString()
  const { data, error } = await sb.from('lead_sequence_runs').update({ status: 'stopped', stop_reason: reason, stopped_at: now, next_send_at: null, updated_at: now })
    .eq('id', run.id).in('status', ['active', 'paused']).select('id')
  if (error) throw new Error(error.message)
  if (!(data ?? []).length) return false
  const L = lead ?? (await sb.from('leads').select('id, org_id').eq('id', run.lead_id).maybeSingle()).data
  if (L) await timeline(L, { type: 'note', subject: `Sequence stopped — ${STOP_TEXT[reason] ?? reason}`, body: `Sent ${run.sent_count} of ${run.step_total} emails.`, completed_at: now, created_by_name: byName ?? 'Nexus' })
  return true
}

/** Stop every live sequence on a lead (lead marked Lost / Stuck / made an opportunity). Never throws. */
export async function stopLeadRuns(leadId: string, reason: string, byName?: string | null) {
  try {
    const { data, error } = await sb.from('lead_sequence_runs').select('*').eq('lead_id', leadId).in('status', ['active', 'paused'])
    if (error) { if (!needsMigration(error)) console.error('[sequences] stopLeadRuns:', error.message); return 0 }
    let n = 0
    for (const r of (data ?? []) as Row[]) if (await stopRun(r, reason, null, byName)) n++
    return n
  } catch (e) { console.error('[sequences] stopLeadRuns:', e instanceof Error ? e.message : e); return 0 }
}

async function pauseRun(run: Row, reason: string, lastError?: string | null) {
  const now = new Date().toISOString()
  const { error } = await sb.from('lead_sequence_runs').update({ status: 'paused', pause_reason: reason, last_error: lastError ?? run.last_error ?? null, updated_at: now }).eq('id', run.id).eq('status', 'active')
  if (error) throw new Error(error.message)
}

// ── Sending one step ─────────────────────────────────────────────────────────
export type SendOutcome = { ok: true; step: number; finished: boolean } | { ok: false; error: string; paused?: string; duplicate?: boolean }

/**
 * Send the run's next step (sent_count + 1). `override` = the rep's edited subject/body
 * for this step (the Start screen). Claims the step first (unique run + step) so two
 * runners can never send the same email twice.
 */
export async function sendNext(run: Row, lead: Row, override?: { subject?: string; body?: string }): Promise<SendOutcome> {
  const steps = await stepsOf(run.sequence_id)
  const stepNo = Number(run.sent_count) + 1
  const step = steps.find((s) => s.step_no === stepNo) ?? steps[Number(run.sent_count)]
  if (!step) {
    const now = new Date().toISOString()
    await sb.from('lead_sequence_runs').update({ status: 'finished', next_send_at: null, updated_at: now }).eq('id', run.id)
    return { ok: true, step: stepNo, finished: true }
  }

  const channel = run.channel_id ? (await sb.from('message_channels').select('*').eq('id', run.channel_id).maybeSingle()).data as Row | null : await gmailFor(run.user_id)
  if (!channel || !channel.is_active || !channel.oauth_refresh_token || channel.user_id !== run.user_id) {
    await pauseRun(run, 'gmail', 'Gmail is not connected')
    return { ok: false, error: PAUSE_TEXT.gmail, paused: 'gmail' }
  }

  // Claim the step.
  const { data: claim, error: cErr } = await sb.from('lead_sequence_sends').insert({ run_id: run.id, lead_id: lead.id, user_id: run.user_id, step_no: step.step_no, status: 'sending' }).select('id').single()
  if (cErr) {
    if (cErr.code === '23505') return { ok: false, error: 'That email was already sent.', duplicate: true }
    throw new Error(cErr.message)
  }

  if (!override && step.step_no === 1 && (run.step1_subject || run.step1_body)) override = { subject: run.step1_subject ?? undefined, body: run.step1_body ?? undefined }
  const vars = leadVars(lead, { name: run.sender_name })
  const isReply = step.step_no > 1 && step.same_thread && !!run.gmail_thread_id
  const baseSubject = String(run.first_subject ?? '').trim()
  const subjRaw = override?.subject?.trim() || step.subject?.trim() || ''
  let subject = subjRaw ? fill(subjRaw, vars).text : (baseSubject || fill(steps[0]?.subject || 'Quick question', vars).text)
  if (isReply && !subjRaw) subject = /^\s*re:/i.test(baseSubject) ? baseSubject : `Re: ${baseSubject || subject}`
  const body = fill(override?.body?.trim() || step.body, vars).text.trim()

  // Signature (same as Nexus Mail); no signature → the rep's name.
  const { data: sig } = await sb.from('user_settings').select('email_signature').eq('user_id', run.user_id).maybeSingle()
  const sp = signatureParts(String(sig?.email_signature ?? ''))
  const sigText = sp.text.trim() || String(run.sender_name ?? '').trim()
  const text = [body, STOP_LINE, sigText].filter(Boolean).join('\n\n')
  const html = `${toHtml(body)}<p style="margin:0 0 12px;color:#6E6E73;font-size:12px">${esc(STOP_LINE)}</p>${sp.html ? `<div class="gg-signature" style="margin-top:14px">${sp.html}</div>` : sigText ? `<p style="margin:0">${esc(sigText)}</p>` : ''}`

  // Reply threading for every mail app: In-Reply-To = our last email in this conversation.
  let inReplyTo: string | undefined, references: string | undefined
  if (isReply) {
    const { data: prev } = await sb.from('lead_sequence_sends').select('gmail_message_id').eq('run_id', run.id).eq('status', 'sent').not('gmail_message_id', 'is', null).order('step_no', { ascending: false }).limit(5)
    const gids = ((prev ?? []) as Row[]).map((p) => p.gmail_message_id)
    if (gids.length) {
      const { data: msgs } = await sb.from('messages').select('rfc_message_id').eq('channel_id', channel.id).in('external_message_id', gids)
      const ids = ((msgs ?? []) as Row[]).map((m) => m.rfc_message_id).filter(Boolean) as string[]
      if (ids.length) { inReplyTo = ids[0]; references = ids.slice().reverse().join(' ') }
    }
  }

  const fromAddress = String(channel.config?.from_address ?? run.sender_email ?? '')
  const email: OutboundEmail = {
    to: String(run.to_email), subject, text, html, fromName: run.sender_name ?? undefined, fromAddress,
    inline: sp.html && sp.inline.length ? sp.inline : undefined,
    gmailThreadId: isReply ? run.gmail_thread_id : undefined, inReplyTo, references,
  }
  const res = await sendViaGmail(String(channel.oauth_refresh_token), fromAddress, email)
  const now = new Date().toISOString()

  if (!res.ok) {
    // Free the step so it can be tried again.
    await sb.from('lead_sequence_sends').delete().eq('id', claim.id)
    const fails = Number(run.fail_count ?? 0) + 1
    const reconnect = isReconnectError(res.error)
    const upd: Row = { fail_count: fails, last_error: String(res.error ?? 'Send failed').slice(0, 500), updated_at: now }
    if (reconnect || fails >= 3) Object.assign(upd, { status: 'paused', pause_reason: reconnect ? 'gmail' : 'errors' })
    else upd.next_send_at = nextWindow(new Date(Date.now() + 15 * 60000)).toISOString() // try again in 15 min
    await sb.from('lead_sequence_runs').update(upd).eq('id', run.id)
    return { ok: false, error: reconnect ? PAUSE_TEXT.gmail : `Could not send: ${res.error ?? 'unknown error'}`, paused: upd.status === 'paused' ? upd.pause_reason : undefined }
  }

  const { error: sErr } = await sb.from('lead_sequence_sends').update({ status: 'sent', subject, gmail_message_id: res.externalId ?? null, gmail_thread_id: res.threadId ?? null, sent_at: now }).eq('id', claim.id)
  if (sErr) console.error('[sequences] send log not updated:', sErr.message)

  const later = steps.filter((s) => s.step_no > step.step_no)
  const next = later[0]
  const runUpd: Row = {
    sent_count: step.step_no, last_sent_at: now, fail_count: 0, last_error: null, updated_at: now,
    gmail_thread_id: run.gmail_thread_id ?? res.threadId ?? null,
    first_subject: run.first_subject ?? subject,
    next_send_at: next ? dueAt(String(run.started_at), next.day_offset, new Date(Date.now() + 60000)).toISOString() : null,
    status: next ? 'active' : 'finished',
  }
  const { error: rErr } = await sb.from('lead_sequence_runs').update(runUpd).eq('id', run.id)
  if (rErr) throw new Error(rErr.message)

  await timeline(lead, {
    type: 'email', subject, body: text, direction: 'outbound', to_email: run.to_email, from_email: fromAddress,
    email_status: 'sent', completed_at: now, created_by_name: run.sender_name ?? null,
  })
  Object.assign(run, runUpd)
  return { ok: true, step: step.step_no, finished: !next }
}

// ── Starting ─────────────────────────────────────────────────────────────────
export type StartResult = { ok: true; run: Row; sent: boolean; message: string } | { ok: false; status: number; error: string }

export async function startRun(user: PortalUser, lead: Row, sequenceId: string, opts: { subject?: string; body?: string; sendNow?: boolean }): Promise<StartResult> {
  const block = blockReason(lead)
  if (block) return { ok: false, status: 409, error: block === 'no_email' ? 'This lead has no email address — add one first.' : block === 'do_not_email' ? 'This lead is set to Do not email.' : `Can’t start: ${STOP_TEXT[block] ?? block}.` }
  const vis = await visibleSequences(user)
  if ('error' in vis) return { ok: false, status: needsMigration(vis.error) ? 409 : 500, error: needsMigration(vis.error) ? MIGRATION_MSG : String(vis.error?.message) }
  const seq = vis.sequences.find((s) => s.id === sequenceId)
  if (!seq) return { ok: false, status: 404, error: 'Sequence not found.' }
  if (!seq.steps.length) return { ok: false, status: 409, error: 'That sequence has no emails yet.' }
  const channel = await gmailFor(user.id)
  if (!channel) return { ok: false, status: 409, error: 'Connect your Gmail first (Mail → Settings) — sequences send from your own email.' }

  const now = new Date()
  const overCap = (await sentToday(user.id)) >= DAILY_CAP
  const sendNow = opts.sendNow !== false && !overCap
  const { data: run, error } = await sb.from('lead_sequence_runs').insert({
    lead_id: lead.id, sequence_id: seq.id, org_id: lead.org_id ?? null, user_id: user.id, sender_name: user.name, sender_email: String(channel.config?.from_address ?? user.email ?? ''),
    channel_id: channel.id, to_email: String(lead.email).trim(), status: 'active', step_total: seq.steps.length,
    step1_subject: opts.subject?.trim() || null, step1_body: opts.body?.trim() || null,
    started_at: now.toISOString(), next_send_at: (sendNow ? now : nextWindow(new Date(now.getTime() + (overCap ? 0 : 60000)))).toISOString(),
  }).select('*').single()
  if (error) {
    if (error.code === '23505') return { ok: false, status: 409, error: 'This lead is already in a sequence — stop that one first.' }
    return { ok: false, status: needsMigration(error) ? 409 : 500, error: needsMigration(error) ? MIGRATION_MSG : error.message }
  }
  await timeline(lead, { type: 'note', subject: `Sequence started — ${seq.name}`, body: `${seq.steps.length} emails from ${user.name}${overCap ? ' (daily limit reached — first email goes in the next sending window)' : ''}.`, completed_at: now.toISOString(), created_by_name: user.name })

  const override = opts.subject?.trim() || opts.body?.trim() ? { subject: opts.subject?.trim() || undefined, body: opts.body?.trim() || undefined } : undefined
  if (!sendNow) return { ok: true, run, sent: false, message: overCap ? `You’ve sent ${DAILY_CAP} sequence emails today — the first one goes in the next sending window.` : 'Started — the first email goes in the next sending window.' }
  const out = await sendNext(run, lead, override)
  if (!out.ok) return { ok: true, run, sent: false, message: out.error }
  return { ok: true, run, sent: true, message: 'Started — first email sent.' }
}

// ── The runner (Inngest, every 2 min in the sending window) ──────────────────
export async function runDue(now = new Date()): Promise<{ checked: number; sent: number; stopped: number; skipped: number; errors: string[] }> {
  const out = { checked: 0, sent: 0, stopped: 0, skipped: 0, errors: [] as string[] }
  if (!inWindow(now)) return out
  const { data, error } = await sb.from('lead_sequence_runs').select('*').eq('status', 'active').lte('next_send_at', now.toISOString()).order('next_send_at', { ascending: true }).limit(300)
  if (error) { if (!needsMigration(error)) out.errors.push(error.message); return out }
  const seen = new Set<string>()
  for (const run of (data ?? []) as Row[]) {
    if (seen.has(run.user_id)) continue // one email per rep per run → ~2 minutes apart
    out.checked++
    try {
      const { data: lead } = await sb.from('leads').select('*').eq('id', run.lead_id).maybeSingle()
      const block = blockReason(lead as Row | null)
      if (block) { if (await stopRun(run, block, lead as Row | null)) out.stopped++; continue }
      const rep = await checkReplies(run)
      if (rep) {
        if (rep.stopWord) {
          const { error: dErr } = await sb.from('leads').update({ do_not_email: true, updated_at: now.toISOString() }).eq('id', run.lead_id)
          if (dErr) out.errors.push(`do_not_email: ${dErr.message}`)
        }
        if (await stopRun(run, rep.stopWord ? 'do_not_email' : rep.kind, lead as Row)) out.stopped++
        continue
      }
      if ((await sentToday(run.user_id)) >= DAILY_CAP) {
        seen.add(run.user_id)
        const tomorrow = atET(addDaysISO(todayET(now), 1), SEND_START_MIN + 30)
        await sb.from('lead_sequence_runs').update({ next_send_at: nextWindow(tomorrow).toISOString() }).eq('id', run.id)
        out.skipped++
        continue
      }
      seen.add(run.user_id)
      const r = await sendNext(run, lead as Row)
      if (r.ok) out.sent++
      else if (!r.duplicate) out.errors.push(`${run.id}: ${r.error}`)
    } catch (e) {
      out.errors.push(`${run.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return out
}

// ── For the lead screens ─────────────────────────────────────────────────────
/** Live / latest run per lead: { name, step, total, status, next_send_at } (empty if 240 isn't run). */
export async function runsForLeads(leadIds: string[]) {
  const out = new Map<string, { run_id: string; name: string; sent: number; total: number; status: string; next_send_at: string | null }>()
  if (!leadIds.length) return out
  for (let i = 0; i < leadIds.length; i += 150) {
    const { data, error } = await sb.from('lead_sequence_runs').select('id, lead_id, sequence_id, sent_count, step_total, status, next_send_at').in('lead_id', leadIds.slice(i, i + 150)).in('status', ['active', 'paused'])
    if (error) return out
    const rows = (data ?? []) as Row[]
    if (!rows.length) continue
    const { data: seqs } = await sb.from('lead_sequences').select('id, name').in('id', [...new Set(rows.map((r) => r.sequence_id))])
    const names = new Map(((seqs ?? []) as Row[]).map((s) => [s.id, s.name]))
    for (const r of rows) out.set(r.lead_id, { run_id: r.id, name: String(names.get(r.sequence_id) ?? 'Sequence'), sent: r.sent_count, total: r.step_total, status: r.status, next_send_at: r.next_send_at })
  }
  return out
}

export { sb as sequencesDb }
