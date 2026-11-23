/**
 * A lead's email sequence (the Sequence card on the lead panel / page).
 *   GET  → { run (live or latest) + its emails, sequences you can start, gmail connected?, do_not_email, … }
 *   POST { action: 'preview', sequence_id }                → email 1 filled in for this lead (to edit)
 *        { action: 'start', sequence_id, subject?, body?, send_now? }
 *        { action: 'pause' | 'resume' | 'skip' | 'stop' }
 *        { action: 'do_not_email', on: boolean }
 * Rules: lib/lead-sequences.ts. Needs migration 240.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { leadInScope } from '@/lib/crm-scope'
import {
  visibleSequences, gmailFor, sentToday, startRun, stopRun, blockReason, fill, leadVars, dueAt, nextWindow,
  needsMigration, MIGRATION_MSG, DAILY_CAP, STOP_TEXT, PAUSE_TEXT, sequencesDb as sb,
} from '@/lib/lead-sequences'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>
const fail = (e: { message?: string; code?: string } | null | undefined) =>
  NextResponse.json({ error: needsMigration(e) ? MIGRATION_MSG : e?.message ?? 'Something went wrong.' }, { status: needsMigration(e) ? 409 : 500 })

async function load(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { res: NextResponse.json({ error: 'Bad lead id.' }, { status: 400 }) }
  const user = await getCurrentUser()
  if (!user.canViewCRM) return { res: NextResponse.json({ error: 'CRM access denied.' }, { status: 403 }) }
  if (!(await leadInScope(id))) return { res: NextResponse.json({ error: 'Lead not found or outside your access.' }, { status: 404 }) }
  const { data: lead, error } = await sb.from('leads').select('*').eq('id', id).maybeSingle()
  if (error) return { res: fail(error) }
  if (!lead) return { res: NextResponse.json({ error: 'Lead not found.' }, { status: 404 }) }
  return { user, lead: lead as Row }
}

async function runView(leadId: string) {
  const { data: runs, error } = await sb.from('lead_sequence_runs').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(5)
  if (error) return { error }
  const run = ((runs ?? []) as Row[]).find((r) => r.status === 'active' || r.status === 'paused') ?? ((runs ?? []) as Row[])[0] ?? null
  if (!run) return { run: null }
  const [{ data: seq }, { data: steps }, { data: sends }] = await Promise.all([
    sb.from('lead_sequences').select('id, name').eq('id', run.sequence_id).maybeSingle(),
    sb.from('lead_sequence_steps').select('step_no, day_offset, subject, same_thread').eq('sequence_id', run.sequence_id).order('step_no'),
    sb.from('lead_sequence_sends').select('step_no, status, subject, sent_at').eq('run_id', run.id).order('step_no'),
  ])
  const sent = new Map(((sends ?? []) as Row[]).filter((s) => s.status === 'sent').map((s) => [s.step_no, s]))
  const emails = ((steps ?? []) as Row[]).map((s) => {
    const done = sent.get(s.step_no)
    const state = done ? 'sent' : s.step_no <= run.sent_count ? 'skipped' : s.step_no === run.sent_count + 1 && (run.status === 'active' || run.status === 'paused') ? 'next' : run.status === 'active' || run.status === 'paused' ? 'later' : 'not_sent'
    return { step_no: s.step_no, day_offset: s.day_offset, subject: done?.subject ?? s.subject ?? '', reply: s.step_no > 1 && s.same_thread, state, sent_at: done?.sent_at ?? null }
  })
  return {
    run: {
      id: run.id, name: seq?.name ?? 'Sequence', status: run.status, sent: run.sent_count, total: run.step_total, next_send_at: run.next_send_at,
      started_at: run.started_at, sender_name: run.sender_name, to_email: run.to_email, last_error: run.last_error,
      pause_reason: run.pause_reason, pause_text: run.pause_reason ? PAUSE_TEXT[run.pause_reason] ?? run.pause_reason : null,
      stop_reason: run.stop_reason, stop_text: run.stop_reason ? STOP_TEXT[run.stop_reason] ?? run.stop_reason : null, stopped_at: run.stopped_at,
      emails,
    },
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const a = await load(params.id)
  if (a.res) return a.res
  const { user, lead } = a
  const rv = await runView(lead.id)
  if ('error' in rv) return fail(rv.error)
  const vis = await visibleSequences(user)
  if ('error' in vis) return fail(vis.error)
  const gmail = await gmailFor(user.id)
  const block = blockReason(lead)
  return NextResponse.json({
    run: rv.run,
    sequences: vis.sequences.filter((s) => s.steps.length).map((s) => ({ id: s.id, name: s.name, description: s.description, emails: s.steps.length, days: s.steps[s.steps.length - 1]?.day_offset ?? 0 })),
    gmail: !!gmail, gmail_address: gmail ? String(gmail.config?.from_address ?? '') || null : null,
    email: lead.email ?? null, do_not_email: !!lead.do_not_email,
    block, block_text: block ? (block === 'no_email' ? 'Add an email address to this lead to start a sequence.' : STOP_TEXT[block] ?? block) : null,
    sent_today: gmail ? await sentToday(user.id) : 0, daily_cap: DAILY_CAP,
  })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const a = await load(params.id)
  if (a.res) return a.res
  const { user, lead } = a
  const body = (await req.json().catch(() => ({}))) as Row
  const action = String(body.action ?? '')
  const now = new Date()

  if (action === 'preview') {
    const vis = await visibleSequences(user)
    if ('error' in vis) return fail(vis.error)
    const seq = vis.sequences.find((s) => s.id === body.sequence_id)
    if (!seq || !seq.steps.length) return NextResponse.json({ error: 'Sequence not found.' }, { status: 404 })
    const vars = leadVars(lead, { name: user.name })
    const s1 = seq.steps[0]
    const subj = fill(s1.subject, vars), msg = fill(s1.body, vars)
    return NextResponse.json({
      subject: subj.text, body: msg.text, missing: [...new Set([...subj.missing, ...msg.missing])],
      emails: seq.steps.map((s) => ({ step_no: s.step_no, day_offset: s.day_offset, subject: s.subject ? fill(s.subject, vars).text : '', reply: s.step_no > 1 && s.same_thread })),
    })
  }

  if (action === 'start') {
    const r = await startRun(user, lead, String(body.sequence_id ?? ''), { subject: body.subject ? String(body.subject).slice(0, 200) : undefined, body: body.body ? String(body.body).slice(0, 8000) : undefined, sendNow: body.send_now !== false })
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
    const rv = await runView(lead.id)
    return NextResponse.json({ ok: true, message: r.message, sent: r.sent, run: 'error' in rv ? null : rv.run })
  }

  if (action === 'do_not_email') {
    const on = body.on !== false
    const { error } = await sb.from('leads').update({ do_not_email: on, updated_at: now.toISOString() }).eq('id', lead.id)
    if (error) return fail(error)
    const { error: aErr } = await sb.from('crm_activities').insert({ lead_id: lead.id, dealer_org_id: lead.org_id ?? null, type: 'note', subject: on ? 'Set to Do not email' : 'Email allowed again', completed_at: now.toISOString(), created_by_name: user.name })
    if (aErr) console.error('[sequences] note not saved:', aErr.message)
    if (on) {
      const { data: live } = await sb.from('lead_sequence_runs').select('*').eq('lead_id', lead.id).in('status', ['active', 'paused'])
      for (const r of (live ?? []) as Row[]) await stopRun(r, 'do_not_email', lead, user.name)
    }
    return NextResponse.json({ ok: true, message: on ? 'Set to Do not email — no sequence will email this lead.' : 'Email allowed again.' })
  }

  if (!['pause', 'resume', 'skip', 'stop'].includes(action)) return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  const { data: run, error: rErr } = await sb.from('lead_sequence_runs').select('*').eq('lead_id', lead.id).in('status', ['active', 'paused']).maybeSingle()
  if (rErr) return fail(rErr)
  if (!run) return NextResponse.json({ error: 'This lead isn’t in a sequence right now.' }, { status: 409 })
  const note = async (subject: string) => {
    const { error } = await sb.from('crm_activities').insert({ lead_id: lead.id, dealer_org_id: lead.org_id ?? null, type: 'note', subject, completed_at: now.toISOString(), created_by_name: user.name })
    if (error) console.error('[sequences] note not saved:', error.message)
  }
  let msg = ''

  if (action === 'stop') {
    await stopRun(run, 'manual', lead, user.name)
    msg = 'Sequence stopped.'
  } else if (action === 'pause') {
    if (run.status === 'paused') return NextResponse.json({ error: 'It’s already paused.' }, { status: 409 })
    const { error } = await sb.from('lead_sequence_runs').update({ status: 'paused', pause_reason: 'manual', updated_at: now.toISOString() }).eq('id', run.id).eq('status', 'active')
    if (error) return fail(error)
    await note('Sequence paused'); msg = 'Paused — nothing more goes until you press Resume.'
  } else if (action === 'resume') {
    if (run.status === 'active') return NextResponse.json({ error: 'It’s already running.' }, { status: 409 })
    const block = blockReason(lead)
    if (block) return NextResponse.json({ error: `Can’t resume: ${STOP_TEXT[block] ?? block}.` }, { status: 409 })
    if (!(await gmailFor(run.user_id))) return NextResponse.json({ error: run.user_id === user.id ? 'Reconnect your Gmail first (Mail → Settings), then press Resume.' : `${run.sender_name ?? 'The sender'}’s Gmail isn’t connected — they need to reconnect it first.` }, { status: 409 })
    const { data: step } = await sb.from('lead_sequence_steps').select('day_offset').eq('sequence_id', run.sequence_id).eq('step_no', run.sent_count + 1).maybeSingle()
    const next = step ? dueAt(String(run.started_at), Number(step.day_offset), now) : nextWindow(now)
    const { error } = await sb.from('lead_sequence_runs').update({ status: 'active', pause_reason: null, fail_count: 0, last_error: null, next_send_at: next.toISOString(), updated_at: now.toISOString() }).eq('id', run.id).eq('status', 'paused')
    if (error) return fail(error)
    await note('Sequence resumed'); msg = 'Resumed.'
  } else {
    // skip the next email
    const { data: steps, error: sErr } = await sb.from('lead_sequence_steps').select('step_no, day_offset').eq('sequence_id', run.sequence_id).order('step_no')
    if (sErr) return fail(sErr)
    const later = ((steps ?? []) as Row[]).filter((s) => s.step_no > run.sent_count + 1)
    const nextStep = later[0]
    const upd: Row = { sent_count: run.sent_count + 1, updated_at: now.toISOString() }
    if (nextStep) upd.next_send_at = dueAt(String(run.started_at), Number(nextStep.day_offset), now).toISOString()
    else Object.assign(upd, { status: 'finished', next_send_at: null })
    const { error } = await sb.from('lead_sequence_runs').update(upd).eq('id', run.id).eq('sent_count', run.sent_count)
    if (error) return fail(error)
    await note(`Sequence: skipped email ${run.sent_count + 1}`); msg = nextStep ? `Skipped email ${run.sent_count + 1}.` : 'Skipped the last email — sequence finished.'
  }
  const rv = await runView(lead.id)
  return NextResponse.json({ ok: true, message: msg, run: 'error' in rv ? null : rv.run })
}
