/**
 * Lexi — the Brain.
 *
 * Two kinds of memory, both in `lexi_brain` (migration 200):
 *   company  → shared with everyone in the same company (pricing, policies,
 *              call scripts, how we write). Admins and supervisors edit it.
 *   personal → only the owner sees it ("remember that I like short answers").
 *
 * Lexi reads both on every message (they go into its instructions), and can
 * add or remove them with the remember / forget tools.
 */
import type Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import type { PortalUser } from '@/lib/current-user'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export type BrainRow = { id: string; scope: 'company' | 'personal'; category: string; title: string | null; body: string; created_by_name: string | null; updated_at: string }
export const BRAIN_CATEGORIES = ['fact', 'pricing', 'policy', 'script', 'voice', 'preference'] as const
const CAT = new Set<string>(BRAIN_CATEGORIES)
const COLS = 'id, scope, category, title, body, created_by_name, updated_at'
// Friendlier message when migration 200 hasn't been run yet.
export const notReady = (m: string) => (/lexi_brain|lexi_recordings/.test(m) && /does not exist|schema cache/i.test(m) ? 'The Brain isn’t set up yet — run migration 200.' : m)
const MAX_BODY = 2000

/** Admins and supervisors may change the shared company Brain. */
export const canEditCompanyBrain = (u: PortalUser) => u.role === 'admin' || u.role === 'supervisor'

// Company rows belong to the user's company; Gate Guard corporate users with no
// company id share the "null org" Brain.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const companyFilter = (q: any, u: PortalUser) => (u.org_id ? q.eq('org_id', u.org_id) : q.is('org_id', null))

export async function loadBrain(u: PortalUser): Promise<{ company: BrainRow[]; personal: BrainRow[]; error?: string }> {
  const [c, p] = await Promise.all([
    companyFilter(sb.from('lexi_brain').select(COLS).eq('scope', 'company'), u).order('updated_at', { ascending: false }).limit(200),
    sb.from('lexi_brain').select(COLS).eq('scope', 'personal').eq('user_id', u.id).order('updated_at', { ascending: false }).limit(100),
  ])
  const error = c.error?.message || p.error?.message
  return { company: (c.data ?? []) as BrainRow[], personal: (p.data ?? []) as BrainRow[], ...(error ? { error } : {}) }
}

export async function addBrain(u: PortalUser, input: { body: unknown; title?: unknown; category?: unknown; scope?: unknown }): Promise<{ row?: BrainRow; error?: string }> {
  const body = typeof input.body === 'string' ? input.body.trim().slice(0, MAX_BODY) : ''
  if (!body) return { error: 'Tell me what to remember.' }
  const scope = input.scope === 'company' ? 'company' : 'personal'
  if (scope === 'company' && !canEditCompanyBrain(u)) return { error: 'Only admins and supervisors can add to the company Brain. I can save it just for you instead.' }
  const category = typeof input.category === 'string' && CAT.has(input.category) ? input.category : scope === 'personal' ? 'preference' : 'fact'
  const title = typeof input.title === 'string' && input.title.trim() ? input.title.trim().slice(0, 120) : null
  const { data, error } = await sb.from('lexi_brain').insert({
    scope, category, title, body,
    org_id: u.org_id,
    user_id: scope === 'personal' ? u.id : null,
    created_by: u.id, created_by_name: u.name,
  }).select(COLS).single()
  if (error) return { error: notReady(error.message) }
  return { row: data as BrainRow }
}

/** Delete one row the user is allowed to delete. Returns false when not found / not allowed. */
export async function deleteBrain(u: PortalUser, id: string): Promise<{ ok: boolean; error?: string }> {
  const { data: row, error } = await sb.from('lexi_brain').select('id, scope, user_id, org_id').eq('id', id).maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!row) return { ok: false, error: 'Not found.' }
  const mine = row.scope === 'personal' && row.user_id === u.id
  const company = row.scope === 'company' && (u.org_id ? row.org_id === u.org_id : row.org_id === null) && canEditCompanyBrain(u)
  if (!mine && !company) return { ok: false, error: 'You can’t remove that one.' }
  const { error: dErr } = await sb.from('lexi_brain').delete().eq('id', id)
  if (dErr) return { ok: false, error: dErr.message }
  return { ok: true }
}

/** Find rows the user can see whose text matches (for "forget …"). */
export async function findBrain(u: PortalUser, query: string): Promise<BrainRow[]> {
  const { company, personal } = await loadBrain(u)
  const words = query.toLowerCase().split(/\W+/).filter(w => w.length > 2)
  if (!words.length) return []
  const score = (r: BrainRow) => words.filter(w => `${r.title ?? ''} ${r.body}`.toLowerCase().includes(w)).length
  return [...personal, ...company].map(r => ({ r, s: score(r) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).map(x => x.r)
}

/** The Brain as text for Lexi's instructions (kept short — newest first). */
export function brainPrompt(b: { company: BrainRow[]; personal: BrainRow[] }): string {
  const line = (r: BrainRow) => `- [${r.category}] ${r.title ? `${r.title}: ` : ''}${r.body.replace(/\s+/g, ' ').slice(0, 400)}`
  let budget = 9000
  const take = (rows: BrainRow[]) => rows.map(line).filter(l => (budget -= l.length) > 0).join('\n')
  const personal = take(b.personal)
  const company = take(b.company)
  if (!personal && !company) return 'The Brain is empty so far. When the user tells you a lasting fact or preference ("remember that…"), save it with the remember tool.'
  return [
    personal && `What this user asked you to remember (follow these):\n${personal}`,
    company && `Company Brain — shared knowledge for everyone (treat as true unless the user corrects it; if it conflicts with live data, trust the data and say so):\n${company}`,
  ].filter(Boolean).join('\n\n')
}

// ── Tools Lexi can call ──────────────────────────────────────────────────────
export const BRAIN_TOOLS: Anthropic.Tool[] = [
  {
    name: 'remember',
    description: 'Save something to the Brain so you remember it in every future chat. Use when the user says "remember…", "from now on…", "always…", "our price for X is…", or states a lasting preference or company fact. for_everyone=true saves it to the shared company Brain (pricing, policies, scripts, how we write) — only when the user clearly means the whole team; otherwise it is saved just for this user. Save one clear fact per call, in plain words.',
    input_schema: { type: 'object', properties: {
      fact: { type: 'string', description: 'The fact or preference, written as a complete sentence.' },
      title: { type: 'string', description: 'Optional short label, e.g. "Install labor rate".' },
      category: { type: 'string', enum: [...BRAIN_CATEGORIES] },
      for_everyone: { type: 'boolean' },
    }, required: ['fact'] },
  },
  {
    name: 'forget',
    description: 'Remove something from the Brain when the user says "forget…", "that\'s no longer true", or corrects a saved fact (forget the old one, then remember the new one). Describe what to forget in a few words.',
    input_schema: { type: 'object', properties: { what: { type: 'string' } }, required: ['what'] },
  },
]
export const BRAIN_TOOL_NAMES = new Set(BRAIN_TOOLS.map(t => t.name))

export async function runBrainTool(name: string, input: Record<string, unknown>, u: PortalUser): Promise<{ ok: boolean; summary: string; message: string }> {
  if (name === 'remember') {
    const scope = input.for_everyone ? 'company' : 'personal'
    const r = await addBrain(u, { body: input.fact, title: input.title, category: input.category, scope })
    const fact = String(input.fact ?? '').slice(0, 90)
    if (r.error) return { ok: false, summary: `Remember: "${fact}"`, message: r.error }
    return { ok: true, summary: `${scope === 'company' ? 'Added to the company Brain' : 'Remembered'}: "${fact}"`, message: 'Saved. It shows in the Brain panel, where it can be removed.' }
  }
  if (name === 'forget') {
    const what = String(input.what ?? '').trim()
    const hits = await findBrain(u, what)
    if (!hits.length) return { ok: false, summary: `Forget: "${what}"`, message: 'Nothing in the Brain matched that.' }
    const r = await deleteBrain(u, hits[0].id)
    if (!r.ok) return { ok: false, summary: `Forget: "${what}"`, message: r.error ?? 'Couldn’t remove it.' }
    return { ok: true, summary: `Forgot: "${(hits[0].title ? `${hits[0].title}: ` : '') + hits[0].body.slice(0, 80)}"`, message: 'Removed from the Brain.' }
  }
  return { ok: false, summary: name, message: 'Unknown Brain tool.' }
}
