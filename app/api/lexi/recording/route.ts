/**
 * /api/lexi/recording — turn a meeting or call into work (Plaud-style).
 *   POST { transcript, title? } → { recording: { id?, title, summary, decisions, todos, crm_note,
 *                                   follow_up, links: [{ type, id, label }] }, saved }
 *   GET                         → { recordings: [...] } (caller's latest 20)
 *
 * The transcript comes from /api/plaud/transcribe (audio) or is pasted (e.g. a
 * Plaud app export). Lexi reads it once and returns a summary, to-dos, a CRM
 * note and a follow-up email draft, and suggests the deal / property it's
 * about. Nothing is created here — the page creates the to-dos and logs the
 * note through /api/assistant/execute, so every one of those can be undone.
 */
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { LEXI_OFF_MESSAGE, lexiAccess } from '@/lib/lexi/access'
import { isSignedIn } from '@/lib/assistant-executor'
import { applyOrgScope } from '@/lib/org-scope'
import { dealCtx, scopeDeals } from '@/lib/sales-deals'
import { notReady } from '@/lib/lexi/brain'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const MODEL = process.env.LEXI_MODEL || 'claude-sonnet-4-6'
const MAX_CHARS = 60000
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

const FILE_TOOL: Anthropic.Tool = {
  name: 'file_recording',
  description: 'File the notes for this recording.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: '3–7 word title, e.g. "Marbella gate walk with PM".' },
      summary: { type: 'string', description: '3–6 plain sentences: who, what was discussed, what was decided.' },
      decisions: { type: 'array', items: { type: 'string' } },
      todos: { type: 'array', description: 'Concrete next steps for OUR side (Gate Guard), one per item.', items: { type: 'object', properties: { title: { type: 'string' }, due_date: { type: 'string', description: 'YYYY-MM-DD only if a date was said or clearly implied.' }, owner: { type: 'string', description: 'Name of who said they would do it, if said.' } }, required: ['title'] } },
      crm_note: { type: 'string', description: 'A short note for the deal/site record: what happened and what is next. 2–5 sentences.' },
      follow_up: { type: 'object', description: 'A follow-up email to the other party, if one makes sense.', properties: { to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' } } },
      mentions: { type: 'object', properties: { properties: { type: 'array', items: { type: 'string' }, description: 'Apartment communities / sites named.' }, companies: { type: 'array', items: { type: 'string' } }, people: { type: 'array', items: { type: 'string' } } } },
    },
    required: ['title', 'summary', 'todos', 'crm_note'],
  },
}

async function caller() {
  const user = await getCurrentUser()
  if (!isSignedIn(user)) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if ((await lexiAccess(user)) === 'none') return { error: NextResponse.json({ error: LEXI_OFF_MESSAGE }, { status: 403 }) }
  return { user }
}

const clean = (s: string) => s.replace(/[%_,()]/g, ' ').trim()

export async function GET() {
  const c = await caller(); if (c.error) return c.error
  const { data, error } = await sb.from('lexi_recordings').select('id, title, summary, result, linked_type, linked_id, linked_label, created_at').eq('user_id', c.user.id).order('created_at', { ascending: false }).limit(20)
  if (error) return NextResponse.json({ error: notReady(error.message) }, { status: 500 })
  return NextResponse.json({ recordings: data ?? [] })
}

export async function POST(req: NextRequest) {
  const c = await caller(); if (c.error) return c.error
  const user = c.user
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'Lexi isn’t set up yet (missing ANTHROPIC_API_KEY).' }, { status: 503 })
  const body = await req.json().catch(() => ({}))
  const transcript = typeof body?.transcript === 'string' ? body.transcript.trim() : ''
  if (transcript.length < 40) return NextResponse.json({ error: 'That recording is too short to work with.' }, { status: 400 })

  // ── Read it once ───────────────────────────────────────────────────────────
  let out: Row
  try {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })
    const r = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2500,
      system: `You file meeting and call notes for ${user.name} at Gate Guard (gates, access control and cameras for apartment communities). Today is ${today}. Be accurate: only include what was actually said. Write plainly and briefly. The follow-up email is from ${user.name}, warm and short, and confirms what was agreed and the next steps.`,
      tools: [FILE_TOOL],
      tool_choice: { type: 'tool', name: 'file_recording' },
      messages: [{ role: 'user', content: `${typeof body?.title === 'string' && body.title.trim() ? `Title given: ${body.title.trim()}\n\n` : ''}Transcript:\n${transcript.slice(0, MAX_CHARS)}` }],
    })
    const block = r.content.find(b => b.type === 'tool_use')
    if (!block || block.type !== 'tool_use') throw new Error('no notes')
    out = block.input as Row
  } catch (e) {
    const m = e instanceof Error ? e.message : ''
    console.error('[lexi/recording]', m)
    return NextResponse.json({ error: /overloaded|529/i.test(m) ? 'Lexi is busy right now — try again in a moment.' : 'Lexi couldn’t read that recording. Try again.' }, { status: 502 })
  }

  // ── Suggest what it's about (deals + properties the user can see) ──────────
  const names = [...(out.mentions?.properties ?? []), ...(out.mentions?.companies ?? [])].map((n: unknown) => clean(String(n))).filter(n => n.length > 2).slice(0, 4)
  const links: { type: 'opportunity' | 'site'; id: string; label: string }[] = []
  if (names.length) {
    const deals = await dealCtx(user)
    const or = names.map(n => `name.ilike.%${n}%`).join(',')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dealQ: any = scopeDeals(sb.from('opportunities').select('id, name, account_name, stage').is('deleted_at', null), deals)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const siteQ: any = deals.scope.all || deals.scope.ids.length ? applyOrgScope(sb.from('sites').select('id, name, city'), deals.scope, 'site') : null
    const [d, s] = await Promise.all([
      dealQ.or(`${or},${names.map(n => `account_name.ilike.%${n}%`).join(',')}`).not('stage', 'in', '(lost)').order('updated_at', { ascending: false }).limit(4),
      siteQ ? siteQ.or(or).limit(3) : Promise.resolve({ data: [] }),
    ]) as { data: Row[] | null }[]
    for (const x of (d.data ?? []) as Row[]) links.push({ type: 'opportunity', id: x.id, label: `${x.name || x.account_name} (deal)` })
    for (const x of (s.data ?? []) as Row[]) links.push({ type: 'site', id: x.id, label: `${x.name}${x.city ? `, ${x.city}` : ''} (property)` })
  }

  const recording = {
    title: String(out.title ?? body?.title ?? 'Recording').slice(0, 120),
    summary: String(out.summary ?? ''),
    decisions: Array.isArray(out.decisions) ? out.decisions.map(String).slice(0, 12) : [],
    todos: Array.isArray(out.todos) ? out.todos.filter((t: Row) => t?.title).slice(0, 15).map((t: Row) => ({ title: String(t.title).slice(0, 200), due_date: /^\d{4}-\d{2}-\d{2}$/.test(String(t.due_date ?? '')) ? t.due_date : null, owner: t.owner ? String(t.owner) : null })) : [],
    crm_note: String(out.crm_note ?? ''),
    follow_up: out.follow_up?.body ? { to: out.follow_up.to ?? null, subject: String(out.follow_up.subject ?? ''), body: String(out.follow_up.body) } : null,
    links,
  }

  const link = links[0] ?? null
  const { data: saved, error } = await sb.from('lexi_recordings').insert({
    user_id: user.id, org_id: user.org_id, title: recording.title, transcript: transcript.slice(0, MAX_CHARS),
    summary: recording.summary, result: recording,
    linked_type: link?.type ?? null, linked_id: link?.id ?? null, linked_label: link?.label ?? null,
  }).select('id').single()
  if (error) console.error('[lexi/recording] save failed:', error.message)
  return NextResponse.json({ recording: { id: saved?.id ?? null, ...recording }, saved: !error, ...(error ? { saveError: notReady(error.message) } : {}) })
}
