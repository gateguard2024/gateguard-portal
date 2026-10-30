/**
 * GET /api/sales/deals/[id]/page — everything the deal page shows, in one call.
 * One timeline merged from: crm_activities (calls, notes, meetings, stage moves, quote events),
 * linked email threads, tasks linked to the deal, surveys, files and invoices.
 * Same visibility rules as the Sales board (lib/sales-deals).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { STAGE_LABELS } from '@/lib/pipeline'
import { cardFor, dealCtx, dealHealth, loadVisibleDeal, profileNames, sb, type Row } from '@/lib/sales-deals'

export const dynamic = 'force-dynamic'

type TL = { id: string; kind: string; at: string; title: string; body?: string | null; meta?: string | null; who?: string | null; href?: string | null }
const LABEL_TO_KEY = Object.fromEntries(Object.entries(STAGE_LABELS).map(([k, v]) => [v, k]))
const MONEY = ['est_mrr', 'install_fee', 'contract_term', 'est_deposit', 'quote_total', 'est_setup', 'monthly_total', 'amount', 'est_arr', 'dtv_bulk_value', 'monthly_per_unit']
const safe = async <T,>(p: PromiseLike<{ data: T | null; error: unknown }>, fallback: T): Promise<T> => {
  try { const r = await p; return (r.error ? fallback : r.data ?? fallback) as T } catch { return fallback }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user.id || user.id === 'anonymous') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await dealCtx(user)
  const r = await loadVisibleDeal(params.id, ctx)
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status })
  const deal = r.deal
  const id = deal.id as string

  const actsRes = await sb.from('crm_activities')
    .select('id, type, subject, body, outcome, due_at, completed_at, created_at, created_by_name, contact_name, duration_min, quote_id')
    .eq('opportunity_id', id).order('created_at', { ascending: false }).limit(400)
  if (actsRes.error) return NextResponse.json({ error: actsRes.error.message }, { status: 500 })
  const acts = (actsRes.data ?? []) as Row[]

  const [contacts, quotes, surveys, files, todos, invoices, jobs, threads, lead, org, card, reps, aria] = await Promise.all([
    safe(sb.from('opportunity_contacts').select('*').eq('opportunity_id', id).order('is_primary', { ascending: false }).order('created_at', { ascending: true }), [] as Row[]),
    safe(sb.from('quotes').select('id, quote_number, title, status, total_mrr, total_one_time, dealer_mrr, sent_at, accepted_at, declined_at, view_count, last_viewed_at, created_at, updated_at').eq('opportunity_id', id).order('created_at', { ascending: false }), [] as Row[]),
    safe(sb.from('surveys').select('id, survey_number, property_name, status, survey_date, devices, created_at').eq('opportunity_id', id).order('created_at', { ascending: false }), [] as Row[]),
    safe(sb.from('attachments').select('id, file_name, url, file_type, size_bytes, category, created_at').eq('opportunity_id', id).order('created_at', { ascending: false }).limit(200), [] as Row[]),
    safe(sb.from('todos').select('id, title, status, priority, due_date, assigned_to_name, task_number, completed_at, created_at').eq('linked_type', 'opportunity').eq('linked_id', id).order('created_at', { ascending: false }).limit(100), [] as Row[]),
    safe(sb.from('invoices').select('id, invoice_number, status, total, balance_due, due_date, paid_at, created_at').eq('opportunity_id', id).order('created_at', { ascending: false }), [] as Row[]),
    safe(sb.from('work_orders').select('id, wo_number, title, status, created_at').eq('opportunity_id', id).order('created_at', { ascending: false }), [] as Row[]),
    safe(sb.from('message_threads').select('id, subject, participants, last_message_at, link_source, created_at').eq('linked_opportunity_id', id).order('last_message_at', { ascending: false }).limit(50), [] as Row[]),
    deal.lead_id ? safe(sb.from('leads').select('id, contact_name, company_name, stage, created_at').eq('id', deal.lead_id).maybeSingle(), null as Row | null) : Promise.resolve(null),
    deal.dealer_org_id ? safe(sb.from('organizations').select('id, name').eq('id', deal.dealer_org_id).maybeSingle(), null as Row | null) : Promise.resolve(null),
    cardFor(deal, ctx),
    (async () => {
      if (ctx.repOnly) return [] as { id: string; name: string }[]
      let q = sb.from('profiles').select('id, first_name, last_name, email').order('first_name').limit(500)
      if (!ctx.scope.all) q = q.in('org_id', ctx.scope.ids.length ? ctx.scope.ids : ['00000000-0000-0000-0000-000000000000'])
      const rows = await safe(q, [] as Row[])
      return rows.map(p => ({ id: p.id as string, name: [p.first_name, p.last_name].filter(Boolean).join(' ') || (p.email as string) || 'Unknown' }))
    })(),
    deal.aria_property_id ? safe(sb.from('aria_properties').select('id, property_name, address, buy_score, urgency').eq('id', deal.aria_property_id).maybeSingle(), null as Row | null) : Promise.resolve(null),
  ])

  // Last message per email thread (snippet for the timeline).
  const snippets: Record<string, Row> = {}
  if (threads.length) {
    const msgs = await safe(sb.from('messages').select('thread_id, direction, from_name, from_address, body, created_at, sent_at').in('thread_id', threads.map(t => t.id)).order('created_at', { ascending: false }).limit(300), [] as Row[])
    for (const m of msgs) if (!snippets[m.thread_id]) snippets[m.thread_id] = m
  }

  // ── Timeline ──
  const tl: TL[] = []
  for (const a of acts) {
    if (!a.completed_at && a.due_at) continue // upcoming, shown separately
    tl.push({
      id: `a-${a.id}`, kind: a.type === 'site_walk' ? 'visit' : a.type, at: a.completed_at ?? a.created_at,
      title: a.subject ?? a.type, body: a.body ?? null,
      meta: [a.contact_name, a.duration_min ? `${a.duration_min} min` : null, a.outcome && a.type !== 'stage_change' ? `outcome: ${a.outcome}` : null].filter(Boolean).join(' · ') || null,
      who: a.created_by_name ?? null,
    })
  }
  for (const t of threads) {
    const m = snippets[t.id]
    const text = m?.body ? String(m.body).replace(/\s+/g, ' ').trim().slice(0, 220) : null
    tl.push({ id: `e-${t.id}`, kind: 'email', at: t.last_message_at ?? t.created_at, title: m ? `Email ${m.direction === 'outbound' ? 'to' : 'from'} ${m.direction === 'outbound' ? 'customer' : (m.from_name || m.from_address || 'customer')}: ${t.subject ?? '(no subject)'}` : (t.subject ?? 'Email thread'), body: text, meta: t.link_source === 'auto' ? 'linked automatically' : null })
  }
  for (const t of todos) if (t.completed_at) tl.push({ id: `t-${t.id}`, kind: 'task', at: t.completed_at, title: `Task done: ${t.title}`, meta: [t.task_number ? `T-${t.task_number}` : null, t.assigned_to_name].filter(Boolean).join(' · ') || null })
  for (const s of surveys) tl.push({ id: `s-${s.id}`, kind: 'survey', at: s.created_at, title: `Site survey ${s.survey_number ?? ''}`.trim(), meta: [s.status, Array.isArray(s.devices) ? `${s.devices.length} devices` : null].filter(Boolean).join(' · ') || null })
  for (const f of files) tl.push({ id: `f-${f.id}`, kind: 'file', at: f.created_at, title: `File added: ${f.file_name}`, meta: f.category ? String(f.category).replace(/_/g, ' ') : null, href: f.url })
  tl.sort((a, b) => String(b.at).localeCompare(String(a.at)))

  // Upcoming = open dated activities + open tasks.
  const upcoming = [
    ...acts.filter(a => !a.completed_at && a.due_at).map(a => ({ id: a.id as string, source: 'activity', type: a.type, title: a.subject ?? a.type, due: a.due_at as string })),
    ...todos.filter(t => t.status !== 'done' && !t.completed_at).map(t => ({ id: t.id as string, source: 'task', type: 'task', title: t.title as string, due: t.due_date ? `${t.due_date}T17:00:00` : null, key: t.task_number ? `T-${t.task_number}` : null })),
  ].sort((a, b) => String(a.due ?? '9999').localeCompare(String(b.due ?? '9999')))

  // Days spent in each stage, from the recorded stage moves (oldest first).
  const moves = acts.filter(a => a.type === 'stage_change' && typeof a.subject === 'string' && a.subject.includes('→'))
    .map(a => { const [f, t] = String(a.subject).split('→').map(x => x.trim()); return { from: LABEL_TO_KEY[f], to: LABEL_TO_KEY[t], at: a.completed_at ?? a.created_at } })
    .filter(m => m.from && m.to).sort((a, b) => String(a.at).localeCompare(String(b.at)))
  const stageDays: Record<string, number> = {}
  let prevAt: string | null = null
  for (const m of moves) {
    if (prevAt) stageDays[m.from] = (stageDays[m.from] ?? 0) + Math.max(0, Math.round((Date.parse(m.at) - Date.parse(prevAt)) / 86400000))
    prevAt = m.at
  }
  stageDays[card.stage] = card.days_in_stage

  const primaryQuote = quotes.find(q => q.id === deal.quote_id) ?? null
  const health = dealHealth(deal, card, { hasDecisionMaker: contacts.some(c => /decision/i.test(String(c.role ?? ''))), primaryQuote })
  const names = await profileNames([deal.rep_id])

  const raw: Row = { ...deal }
  if (!user.canViewFinancials) {
    for (const k of MONEY) raw[k] = null
    for (const q of quotes) { q.total_mrr = null; q.total_one_time = null; q.dealer_mrr = null }
    for (const i of invoices) { i.total = null; i.balance_due = null }
  }

  return NextResponse.json({
    deal: raw, card, health, timeline: tl, upcoming, stageDays,
    contacts, quotes, primaryQuoteId: deal.quote_id ?? null, valuesLocked: !!deal.values_locked,
    surveys, files, todos, invoices, jobs, threads: threads.length, lead, aria,
    dealer: org?.name ?? null, owner: (deal.rep_id && names[deal.rep_id]) || deal.owner_name || null,
    reps, activities: acts,
    can: { edit: true, reassign: !ctx.repOnly, money: user.canViewFinancials },
  })
}
