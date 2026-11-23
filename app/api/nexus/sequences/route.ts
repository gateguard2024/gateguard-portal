/**
 * Email sequences — list + manage (Leads → Sequences).
 *   GET                         → sequences you can use (+ inactive ones if you can manage)
 *   POST   { name, description?, steps: [{ day_offset, subject, body, same_thread }] }   (admins)
 *   PATCH  { id, name?, description?, active?, steps? }   steps replace the whole list   (admins)
 *   DELETE ?id=                 → turned off (kept, because past runs point at it)       (admins)
 * Gate Guard admins manage Gate Guard's own sequences; dealer admins their company's.
 * Rules: lib/lead-sequences.ts. Needs migration 240.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { visibleSequences, canManage, canEditSequence, needsMigration, MIGRATION_MSG, VARS, sequencesDb as sb } from '@/lib/lead-sequences'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>
const fail = (e: { message?: string; code?: string } | null | undefined) =>
  NextResponse.json({ error: needsMigration(e) ? MIGRATION_MSG : e?.message ?? 'Something went wrong.' }, { status: needsMigration(e) ? 409 : 500 })

function cleanSteps(raw: unknown): { steps?: Row[]; error?: string } {
  if (!Array.isArray(raw) || !raw.length) return { error: 'Add at least one email.' }
  if (raw.length > 10) return { error: 'A sequence can have at most 10 emails.' }
  const steps: Row[] = []
  let last = -1
  for (let i = 0; i < raw.length; i++) {
    const s = (raw[i] ?? {}) as Row
    const day = Math.round(Number(s.day_offset ?? 0))
    if (!Number.isFinite(day) || day < 0 || day > 365) return { error: `Email ${i + 1}: the day must be between 0 and 365.` }
    if (i === 0 && day !== 0) return { error: 'The first email goes on day 0 (when you press Start).' }
    if (day < last) return { error: `Email ${i + 1} is set before email ${i} — keep them in order.` }
    if (i > 0 && day === last) return { error: `Email ${i + 1} is on the same day as email ${i} — space them at least a day apart.` }
    last = day
    const subject = String(s.subject ?? '').trim().slice(0, 200)
    const body = String(s.body ?? '').trim().slice(0, 8000)
    const sameThread = i === 0 ? true : s.same_thread !== false
    if (i === 0 && !subject) return { error: 'The first email needs a subject.' }
    if (i > 0 && !sameThread && !subject) return { error: `Email ${i + 1} is a new email (not a reply), so it needs a subject.` }
    if (!body) return { error: `Email ${i + 1} needs a message.` }
    const unknown = [...`${subject} ${body}`.matchAll(/\{\s*([a-z_]+)\s*\}/gi)].map((m) => m[1].toLowerCase()).filter((k) => !(VARS as readonly string[]).includes(k))
    if (unknown.length) return { error: `Email ${i + 1}: {${unknown[0]}} isn't a field we can fill in. Use ${VARS.map((v) => `{${v}}`).join(' ')}.` }
    steps.push({ step_no: i + 1, day_offset: day, subject, body, same_thread: sameThread })
  }
  return { steps }
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user.canViewCRM) return NextResponse.json({ error: 'CRM access denied.' }, { status: 403 })
  const manage = canManage(user)
  const r = await visibleSequences(user, manage)
  if ('error' in r) return fail(r.error)
  const sequences = await Promise.all(r.sequences.map(async (s) => ({ ...s, can_edit: await canEditSequence(user, s.org_id ?? null) })))
  return NextResponse.json({ sequences, can_manage: manage, vars: VARS })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!canManage(user)) return NextResponse.json({ error: 'Only an admin can create sequences.' }, { status: 403 })
  const body = (await req.json().catch(() => ({}))) as Row
  const name = String(body.name ?? '').trim().slice(0, 120)
  if (!name) return NextResponse.json({ error: 'Give the sequence a name.' }, { status: 400 })
  const st = cleanSteps(body.steps)
  if (st.error) return NextResponse.json({ error: st.error }, { status: 400 })
  const orgId = user.isCorporate ? null : user.org_id ?? null
  if (!user.isCorporate && !orgId) return NextResponse.json({ error: 'Your account isn’t linked to a company.' }, { status: 400 })
  const { data: seq, error } = await sb.from('lead_sequences').insert({ org_id: orgId, name, description: String(body.description ?? '').trim().slice(0, 300) || null, created_by: user.id }).select('*').single()
  if (error) return fail(error)
  const { error: sErr } = await sb.from('lead_sequence_steps').insert(st.steps!.map((s) => ({ ...s, sequence_id: seq.id })))
  if (sErr) {
    const { error: dErr } = await sb.from('lead_sequences').delete().eq('id', seq.id)
    if (dErr) console.error('[sequences] cleanup failed:', dErr.message)
    return fail(sErr)
  }
  return NextResponse.json({ sequence: { ...seq, steps: st.steps } }, { status: 201 })
}

async function loadEditable(id: string) {
  const user = await getCurrentUser()
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { res: NextResponse.json({ error: 'Bad sequence id.' }, { status: 400 }) }
  const { data: seq, error } = await sb.from('lead_sequences').select('*').eq('id', id).maybeSingle()
  if (error) return { res: fail(error) }
  if (!seq) return { res: NextResponse.json({ error: 'Sequence not found.' }, { status: 404 }) }
  if (!(await canEditSequence(user, seq.org_id ?? null))) return { res: NextResponse.json({ error: 'Only an admin can change this sequence.' }, { status: 403 }) }
  return { seq: seq as Row }
}

export async function PATCH(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Row
  const a = await loadEditable(String(body.id ?? ''))
  if (a.res) return a.res
  const upd: Row = { updated_at: new Date().toISOString() }
  if (body.name !== undefined) { const n = String(body.name).trim().slice(0, 120); if (!n) return NextResponse.json({ error: 'Give the sequence a name.' }, { status: 400 }); upd.name = n }
  if (body.description !== undefined) upd.description = String(body.description ?? '').trim().slice(0, 300) || null
  if (body.active !== undefined) upd.active = !!body.active
  let steps: Row[] | undefined
  if (body.steps !== undefined) { const st = cleanSteps(body.steps); if (st.error) return NextResponse.json({ error: st.error }, { status: 400 }); steps = st.steps }
  const { error } = await sb.from('lead_sequences').update(upd).eq('id', a.seq.id)
  if (error) return fail(error)
  if (steps) {
    // Replace the emails. Leads already in this sequence use the new wording for the emails they haven't had yet.
    const { data: old, error: oErr } = await sb.from('lead_sequence_steps').select('*').eq('sequence_id', a.seq.id)
    if (oErr) return fail(oErr)
    const { error: dErr } = await sb.from('lead_sequence_steps').delete().eq('sequence_id', a.seq.id)
    if (dErr) return fail(dErr)
    const { error: iErr } = await sb.from('lead_sequence_steps').insert(steps.map((s) => ({ ...s, sequence_id: a.seq.id })))
    if (iErr) {
      // Put the old emails back so the sequence is never left empty.
      const { error: rErr } = await sb.from('lead_sequence_steps').insert(((old ?? []) as Row[]).map(({ id: _id, ...s }) => s))
      if (rErr) console.error('[sequences] restore failed:', rErr.message)
      return fail(iErr)
    }
    const { error: tErr } = await sb.from('lead_sequence_runs').update({ step_total: steps.length }).eq('sequence_id', a.seq.id).in('status', ['active', 'paused'])
    if (tErr) console.error('[sequences] step totals not updated:', tErr.message)
  }
  const { data: seq } = await sb.from('lead_sequences').select('*').eq('id', a.seq.id).maybeSingle()
  const { data: st } = await sb.from('lead_sequence_steps').select('*').eq('sequence_id', a.seq.id).order('step_no')
  return NextResponse.json({ sequence: { ...(seq ?? a.seq), steps: st ?? [] } })
}

export async function DELETE(req: NextRequest) {
  const a = await loadEditable(new URL(req.url).searchParams.get('id') ?? '')
  if (a.res) return a.res
  const { error } = await sb.from('lead_sequences').update({ active: false, updated_at: new Date().toISOString() }).eq('id', a.seq.id)
  if (error) return fail(error)
  return NextResponse.json({ ok: true, message: 'Turned off — no new leads can start it. Leads already in it keep going.' })
}
