/**
 * /api/sales/deals/[id] — one deal on the Sales board.
 *   GET    full deal + activity + contacts + jobs + owner choices
 *   PATCH  edit deal fields (allow-listed; money needs financial access; stage goes through POST move)
 *   POST   { action } — move | archive | unarchive | add_activity | complete_activity | delete_activity
 * Every stage move records WHY (crm_activities type 'stage_change'), as Russel asked.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, type PortalUser } from '@/lib/current-user'
import { STAGE_LABELS, STAGE_PROB, normalizeStage } from '@/lib/pipeline'
import { kickoffProvisioning } from '@/lib/provisioning'
import { OPEN_STAGES, cardFor, dealCtx, loadVisibleDeal, sb, type DealCtx, type Row } from '@/lib/sales-deals'
import { syncDealFromQuote } from '@/lib/deal-sync'

export const dynamic = 'force-dynamic'
type Ctx = { params: { id: string } }

const MONEY = ['est_mrr', 'install_fee', 'contract_term', 'est_deposit', 'quote_total', 'est_setup', 'monthly_total', 'amount', 'est_arr', 'dtv_bulk_value', 'monthly_per_unit']
const TEXT = ['name', 'account_name', 'management_co', 'owner_entity', 'property_address', 'property_city', 'property_state', 'property_zip', 'property_type',
  'forecast_cat', 'opp_type', 'source', 'description', 'notes', 'next_step', 'incumbent_vendor', 'dtv_package', 'isp_service', 'quote_url', 'quote_status', 'manager_name',
  'pain_points', 'budget_status']
const BUDGET = ['confirmed', 'not_confirmed', 'unknown']
const INTS = ['units', 'vehicle_gates', 'pedestrian_gates', 'amenity_doors', 'existing_cameras', 'new_cameras', 'probability', 'year_built', 'buildings', 'occupancy_pct']
const DATES = ['close_date', 'incumbent_contract_end', 'mdu_contract_expiry', 'decision_date', 'target_install_date']
const ARRAYS = ['tags', 'interests', 'competing_vendors']
const LABEL: Record<string, string> = {
  est_mrr: 'monthly value', install_fee: 'install fee', contract_term: 'term', est_deposit: 'deposit', close_date: 'expected close',
  account_name: 'account', management_co: 'management company', opp_type: 'type', forecast_cat: 'forecast category', rep_id: 'owner',
  incumbent_vendor: 'current vendor', incumbent_contract_end: 'vendor contract end', property_address: 'address',
  decision_date: 'decision date', budget_status: 'budget', pain_points: 'pain / why they\'re looking', competing_vendors: 'competing bids',
  target_install_date: 'target install date', year_built: 'year built', occupancy_pct: 'occupancy',
}
const ACT_TYPES = ['call', 'email', 'meeting', 'visit', 'task', 'note', 'demo', 'site_walk']

async function auth(id: string) {
  const user = await getCurrentUser()
  if (!user.id || user.id === 'anonymous') return { res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const ctx = await dealCtx(user)
  const r = await loadVisibleDeal(id, ctx)
  if ('error' in r) return { res: NextResponse.json({ error: r.error }, { status: r.status }) }
  return { user, ctx, deal: r.deal }
}

async function logActivity(user: PortalUser, deal: Row, row: Row) {
  const { error } = await sb.from('crm_activities').insert({
    opportunity_id: deal.id, dealer_org_id: deal.dealer_org_id ?? null, org_id: deal.dealer_org_id ?? null,
    created_by: user.id, created_by_name: user.name, ...row,
  })
  return error?.message ?? null
}

async function repChoices(ctx: DealCtx) {
  if (ctx.repOnly) return []
  let q = sb.from('profiles').select('id, first_name, last_name, email').order('first_name').limit(500)
  if (!ctx.scope.all) q = q.in('org_id', ctx.scope.ids.length ? ctx.scope.ids : ['00000000-0000-0000-0000-000000000000'])
  const { data } = await q
  return ((data ?? []) as Row[]).map(p => ({ id: p.id as string, name: [p.first_name, p.last_name].filter(Boolean).join(' ') || (p.email as string) || 'Unknown' }))
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const a = await auth(params.id); if ('res' in a) return a.res
  const { user, ctx, deal } = a
  const [acts, contacts, jobs, reps, card] = await Promise.all([
    sb.from('crm_activities').select('id, type, subject, body, outcome, due_at, completed_at, created_at, created_by, created_by_name').eq('opportunity_id', deal.id).order('created_at', { ascending: false }).limit(150),
    sb.from('opportunity_contacts').select('*').eq('opportunity_id', deal.id).order('is_primary', { ascending: false }).order('created_at', { ascending: true }),
    sb.from('work_orders').select('id, wo_number, title, status, created_at').eq('opportunity_id', deal.id).order('created_at', { ascending: false }),
    repChoices(ctx),
    cardFor(deal, ctx),
  ])
  if (acts.error) return NextResponse.json({ error: acts.error.message }, { status: 500 })
  const raw: Row = { ...deal }
  if (!user.canViewFinancials) for (const k of MONEY) raw[k] = null
  return NextResponse.json({
    deal: raw,
    card,
    activities: acts.data ?? [],
    contacts: contacts.error ? [] : contacts.data ?? [],
    jobs: jobs.error ? [] : jobs.data ?? [],
    reps,
    can: { edit: true, reassign: !ctx.repOnly, money: user.canViewFinancials },
  })
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const a = await auth(params.id); if ('res' in a) return a.res
  const { user, ctx, deal } = a
  const body = (await req.json().catch(() => ({}))) as Row
  const upd: Row = {}
  const bad = (m: string) => NextResponse.json({ error: m }, { status: 400 })
  for (const [k, v] of Object.entries(body)) {
    if (TEXT.includes(k)) upd[k] = v === null || v === '' ? null : String(v).slice(0, 4000)
    else if (INTS.includes(k) || MONEY.includes(k)) {
      if (MONEY.includes(k) && !user.canViewFinancials) return NextResponse.json({ error: 'You do not have access to deal values.' }, { status: 403 })
      if (v === null || v === '') upd[k] = null
      else {
        const n = Number(v)
        if (!Number.isFinite(n) || n < 0) return bad(`${LABEL[k] ?? k} must be a positive number`)
        if (k === 'occupancy_pct' && n > 100) return bad('Occupancy is a percentage (0–100)')
        if (k === 'year_built' && (n < 1800 || n > 2100)) return bad('Year built looks wrong')
        upd[k] = k === 'probability' ? Math.min(100, Math.round(n)) : ['year_built', 'buildings', 'units'].includes(k) ? Math.round(n) : n
      }
    } else if (DATES.includes(k)) {
      if (v === null || v === '') upd[k] = null
      else if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) upd[k] = v
      else return bad(`${LABEL[k] ?? k} must be a date`)
    } else if (ARRAYS.includes(k)) {
      if (!Array.isArray(v)) return bad(`${k} must be a list`)
      upd[k] = [...new Set(v.map(x => String(x).trim()).filter(Boolean))].slice(0, 30)
    } else if (k === 'rep_id') {
      if (ctx.repOnly) return NextResponse.json({ error: 'Only a manager can change the owner.' }, { status: 403 })
      const reps = await repChoices(ctx)
      const r = reps.find(x => x.id === v)
      if (!r) return bad('That person is not in your team')
      upd.rep_id = r.id; upd.owner_name = r.name
      upd.owner_initials = r.name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase()
    } else if (k === 'stage') return bad('Use the move action to change stage')
  }
  if (typeof upd.name === 'string' && !upd.name.trim()) return bad('A deal needs a name')
  if (upd.budget_status != null && !BUDGET.includes(upd.budget_status)) return bad('Budget must be confirmed, not confirmed or unknown')
  if (!Object.keys(upd).length) return bad('Nothing to change')
  // Typing your own monthly value / install fee stops them following the primary quote.
  if (deal.quote_id && (('est_mrr' in upd && Number(upd.est_mrr) !== Number(deal.est_mrr)) || ('install_fee' in upd && Number(upd.install_fee) !== Number(deal.install_fee)))) upd.values_locked = true
  upd.updated_at = new Date().toISOString()

  const { data, error } = await sb.from('opportunities').update(upd).eq('id', deal.id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const changed = Object.keys(upd).filter(k => !['updated_at', 'owner_name', 'owner_initials'].includes(k) && String(deal[k] ?? '') !== String(upd[k] ?? ''))
  if (changed.length) {
    const logErr = await logActivity(user, deal, { type: 'note', subject: `Updated ${changed.map(k => LABEL[k] ?? k.replace(/_/g, ' ')).join(', ')}`, completed_at: new Date().toISOString() })
    if (logErr) console.error('[sales deal PATCH] history:', logErr)
  }
  return NextResponse.json({ deal: data, card: await cardFor(data, ctx) })
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const a = await auth(params.id); if ('res' in a) return a.res
  const { user, ctx, deal } = a
  const body = (await req.json().catch(() => ({}))) as Row
  const now = new Date().toISOString()
  const bad = (m: string) => NextResponse.json({ error: m }, { status: 400 })

  if (body.action === 'move') {
    const to = String(body.stage ?? '')
    if (![...OPEN_STAGES, 'won', 'lost'].includes(to)) return bad('Unknown stage')
    const from = normalizeStage(deal.stage)
    if (from === to) return bad('The deal is already in that stage')
    const reason = String(body.reason ?? '').trim().slice(0, 200)
    const note = String(body.note ?? '').trim().slice(0, 4000)
    if (to === 'lost' && !String(body.lost_reason ?? '').trim()) return bad('Pick a reason for losing the deal')
    if (to !== 'lost' && !reason && !note) return bad('Say what happened — pick a reason or add a note')

    const upd: Row = { stage: to, probability: STAGE_PROB[to] ?? 0, updated_at: now }
    if (to === 'won') Object.assign(upd, { won_at: now, lost_at: null, archived_at: null })
    else if (to === 'lost') Object.assign(upd, {
      lost_at: now, won_at: null, lost_reason: String(body.lost_reason).trim().slice(0, 200),
      lost_competitor: String(body.lost_competitor ?? '').trim().slice(0, 200) || null, lost_note: note || null,
    })
    else if (from === 'won' || from === 'lost' || from === 'dead') Object.assign(upd, { won_at: null, lost_at: null, archived_at: null })

    const { data, error } = await sb.from('opportunities').update(upd).eq('id', deal.id).select('*').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const why = to === 'lost'
      ? [upd.lost_reason, upd.lost_competitor && `competitor: ${upd.lost_competitor}`, note].filter(Boolean).join(' — ')
      : [reason, note].filter(Boolean).join(' — ')
    const logErr = await logActivity(user, deal, {
      type: 'stage_change', subject: `${STAGE_LABELS[from] ?? from} → ${STAGE_LABELS[to] ?? to}`,
      body: why || null, outcome: to === 'lost' ? upd.lost_reason : reason || null, completed_at: now,
    })
    if (logErr) return NextResponse.json({ error: `Stage saved, but the reason did not save: ${logErr}` }, { status: 500 })

    const nx = body.next as Row | undefined
    if (nx && String(nx.subject ?? '').trim()) {
      const err = await logActivity(user, deal, {
        type: ACT_TYPES.includes(nx.type) ? nx.type : 'task', subject: String(nx.subject).trim().slice(0, 300),
        due_at: nx.due_at ? new Date(nx.due_at).toISOString() : null,
      })
      if (err) return NextResponse.json({ error: `Stage saved, but the next step did not save: ${err}` }, { status: 500 })
    }

    let provisioning: unknown
    if (to === 'won') {
      try { provisioning = await kickoffProvisioning(deal.id) } catch (e) { console.error('[sales move] kickoff:', (e as Error).message) }
    }
    return NextResponse.json({ deal: data, card: await cardFor(data, ctx), provisioning })
  }

  if (body.action === 'archive' || body.action === 'unarchive') {
    const { error } = await sb.from('opportunities').update({ archived_at: body.action === 'archive' ? now : null, updated_at: now }).eq('id', deal.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const logErr = await logActivity(user, deal, { type: 'note', subject: body.action === 'archive' ? 'Archived' : 'Restored from archive', completed_at: now })
    if (logErr) console.error('[sales archive] history:', logErr)
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'add_activity') {
    const subject = String(body.subject ?? '').trim()
    if (!subject) return bad('Give the step a short title')
    const type = ACT_TYPES.includes(body.type) ? body.type : 'task'
    const err = await logActivity(user, deal, {
      type, subject: subject.slice(0, 300), body: body.body ? String(body.body).slice(0, 4000) : null,
      due_at: body.due_at ? new Date(body.due_at).toISOString() : null,
      completed_at: body.done ? now : null, outcome: body.outcome ? String(body.outcome).slice(0, 200) : null,
      duration_min: Number.isFinite(Number(body.duration_min)) && Number(body.duration_min) > 0 ? Math.round(Number(body.duration_min)) : null,
      contact_name: body.contact_name ? String(body.contact_name).slice(0, 200) : null,
    })
    if (err) return NextResponse.json({ error: err }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'complete_activity' || body.action === 'delete_activity') {
    const actId = String(body.activity_id ?? '')
    const { data: act } = await sb.from('crm_activities').select('id, opportunity_id, created_by').eq('id', actId).maybeSingle()
    if (!act || act.opportunity_id !== deal.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (body.action === 'delete_activity') {
      if (ctx.repOnly && act.created_by !== user.id) return NextResponse.json({ error: 'You can only delete steps you added.' }, { status: 403 })
      const { error } = await sb.from('crm_activities').delete().eq('id', actId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await sb.from('crm_activities').update({ completed_at: body.undo ? null : now, outcome: body.outcome ? String(body.outcome).slice(0, 200) : undefined }).eq('id', actId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  // ── Quotes: choose the primary quote / go back to following it ──
  if (body.action === 'set_primary_quote' || body.action === 'use_quote_values') {
    const qid = body.action === 'set_primary_quote' ? String(body.quote_id ?? '') : String(deal.quote_id ?? '')
    if (!qid) return bad('This deal has no primary quote')
    const { data: q } = await sb.from('quotes').select('id, quote_number, opportunity_id, status').eq('id', qid).maybeSingle()
    if (!q || q.opportunity_id !== deal.id) return NextResponse.json({ error: 'Quote not found on this deal' }, { status: 404 })
    const { error } = await sb.from('opportunities').update({ quote_id: q.id, values_locked: false, updated_at: now }).eq('id', deal.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await syncDealFromQuote(q.id)
    const logErr = await logActivity(user, deal, { type: 'quote', quote_id: q.id, subject: body.action === 'set_primary_quote' ? `Proposal ${q.quote_number ?? ''} made primary` : `Deal values reset to proposal ${q.quote_number ?? ''}`, completed_at: now })
    if (logErr) console.error('[sales primary quote] history:', logErr)
    const { data: fresh } = await sb.from('opportunities').select('*').eq('id', deal.id).single()
    return NextResponse.json({ deal: fresh, card: await cardFor(fresh, ctx) })
  }

  // ── ARIA: find the researched property, then fill empty fields from it ──
  if (body.action === 'aria_lookup') {
    const terms = [deal.name, deal.account_name, deal.property_address].map(x => String(x ?? '').replace(/[,%()"\\]/g, ' ').replace(/\s+/g, ' ').trim()).filter(x => x.length >= 3)
    if (!terms.length) return NextResponse.json({ matches: [] })
    let q = sb.from('aria_properties').select('id, property_name, address, units, year_built, occupancy, management_company, owner_entity, current_vendor, primary_concern, updated_at')
      .or(terms.flatMap(t => [`property_name.ilike."%${t.slice(0, 60)}%"`, `address.ilike."%${t.slice(0, 60)}%"`]).join(','))
      .limit(6)
    if (!user.isCorporate) q = q.eq('org_id', user.org_id ?? '00000000-0000-0000-0000-000000000000')
    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ matches: data ?? [] })
  }

  if (body.action === 'aria_apply') {
    let q = sb.from('aria_properties').select('*').eq('id', String(body.aria_property_id ?? ''))
    if (!user.isCorporate) q = q.eq('org_id', user.org_id ?? '00000000-0000-0000-0000-000000000000')
    const { data: ap, error } = await q.maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!ap) return NextResponse.json({ error: 'ARIA property not found' }, { status: 404 })
    const occ = ap.occupancy ? Number(String(ap.occupancy).replace(/[^0-9.]/g, '')) : NaN
    const pains = Array.isArray(ap.pain_signals) ? (ap.pain_signals as Row[]).slice(0, 3).map(s => s.quote || s.summary || s.signal_type || s.type).filter(Boolean) : []
    const pain = [ap.primary_concern, ...pains].filter(Boolean).map(x => `• ${String(x).trim()}`).join('\n')
    // Only fill what's empty — never overwrite what a rep typed.
    const fill: Row = {}
    const put = (col: string, v: unknown) => { if ((deal[col] === null || deal[col] === undefined || deal[col] === '') && v !== null && v !== undefined && v !== '' && !(typeof v === 'number' && !Number.isFinite(v))) fill[col] = v }
    put('year_built', ap.year_built && ap.year_built >= 1800 && ap.year_built <= 2100 ? ap.year_built : null)
    put('units', ap.units)
    put('occupancy_pct', Number.isFinite(occ) && occ >= 0 && occ <= 100 ? occ : null)
    put('management_co', ap.management_company)
    put('owner_entity', ap.owner_entity)
    put('property_type', ap.property_type)
    put('incumbent_vendor', ap.current_vendor)
    put('pain_points', pain || null)
    put('property_address', ap.address)
    fill.aria_property_id = ap.id
    fill.updated_at = now
    const { data, error: uErr } = await sb.from('opportunities').update(fill).eq('id', deal.id).select('*').single()
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })
    const filled = Object.keys(fill).filter(k => !['aria_property_id', 'updated_at'].includes(k))
    const logErr = await logActivity(user, deal, { type: 'note', subject: filled.length ? `Filled from ARIA: ${filled.map(k => LABEL[k] ?? k.replace(/_/g, ' ')).join(', ')}` : 'Linked to ARIA property', completed_at: now })
    if (logErr) console.error('[sales aria_apply] history:', logErr)
    return NextResponse.json({ deal: data, filled, card: await cardFor(data, ctx) })
  }

  return bad('Unknown action')
}
