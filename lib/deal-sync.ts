/**
 * Quotes ⇄ deals — keeps a deal in step with its quotes (Part 1 · Dealer).
 *
 *  • Every quote event (created / sent / viewed / accepted / declined) is written to
 *    the deal's timeline (crm_activities, type 'quote', quote_id set).
 *  • A deal's primary quote = opportunities.quote_id. The first quote on a deal becomes
 *    primary automatically. While values_locked = false, the deal's monthly value,
 *    install fee and quote status follow the primary quote.
 *  • Quote sent → deal moves up to Proposal; quote accepted → Contract & Sign.
 *    Forward only, never out of Won / Lost, and every move records why.
 *
 * All calls are awaited by the quote routes; failures are logged, never thrown, so a
 * quote save can't fail because the deal side had a problem.
 */
import { createClient } from '@supabase/supabase-js'
import { normalizeStage, STAGE_LABELS, STAGE_PROB } from '@/lib/pipeline'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>
export type QuoteEvent = 'created' | 'sent' | 'viewed' | 'accepted' | 'declined'
export type Actor = { id?: string | null; name?: string | null }

const ORDER = ['meet_present', 'survey', 'propose', 'negotiate', 'contract', 'deposit']
const VERB: Record<QuoteEvent, string> = { created: 'created', sent: 'sent', viewed: 'viewed', accepted: 'accepted', declined: 'declined' }
const fmt = (n: unknown) => (n == null ? '—' : `$${Math.round(Number(n)).toLocaleString()}`)

async function loadQuote(quoteId: string) {
  const { data } = await sb.from('quotes')
    .select('id, quote_number, title, status, total_mrr, total_one_time, opportunity_id, signer_name, client_name, view_count')
    .eq('id', quoteId).maybeSingle()
  return data as Row | null
}

async function loadDeal(id: string) {
  const { data } = await sb.from('opportunities').select('*').eq('id', id).maybeSingle()
  return data as Row | null
}

async function log(deal: Row, row: Row) {
  const { error } = await sb.from('crm_activities').insert({
    opportunity_id: deal.id, dealer_org_id: deal.dealer_org_id ?? null, org_id: deal.dealer_org_id ?? null,
    completed_at: new Date().toISOString(), ...row,
  })
  if (error) console.error('[deal-sync] activity:', error.message)
}

/** Copy primary-quote values onto the deal (and make the quote primary if the deal has none). */
export async function syncDealFromQuote(quoteId: string): Promise<void> {
  try {
    const q = await loadQuote(quoteId)
    if (!q?.opportunity_id) return
    const deal = await loadDeal(q.opportunity_id)
    if (!deal) return
    const upd: Row = {}
    if (!deal.quote_id && q.status !== 'declined') upd.quote_id = q.id
    const primary = (upd.quote_id ?? deal.quote_id) === q.id
    if (primary) {
      upd.quote_status = q.status
      upd.quote_total = q.total_one_time
      if (!deal.values_locked) {
        if (q.total_mrr != null) upd.est_mrr = q.total_mrr
        if (q.total_one_time != null) upd.install_fee = q.total_one_time
        upd.quote_synced_at = new Date().toISOString()
      }
    }
    if (!Object.keys(upd).length) return
    upd.updated_at = new Date().toISOString()
    const { error } = await sb.from('opportunities').update(upd).eq('id', deal.id)
    if (error) console.error('[deal-sync] sync:', error.message)
  } catch (e) { console.error('[deal-sync] sync failed:', (e as Error).message) }
}

/** Record a quote event on its deal, sync values, and move the stage forward when it should. */
export async function quoteEvent(quoteId: string, event: QuoteEvent, actor: Actor = {}): Promise<void> {
  try {
    const q = await loadQuote(quoteId)
    if (!q?.opportunity_id) return
    let deal = await loadDeal(q.opportunity_id)
    if (!deal) return
    const label = q.quote_number || q.title || 'proposal'
    const who = event === 'accepted' || event === 'declined' ? (q.signer_name || q.client_name || actor.name) : actor.name
    await log(deal, {
      type: 'quote', quote_id: q.id,
      subject: `Proposal ${label} ${VERB[event]}${event === 'viewed' && q.view_count > 1 ? ` (${q.view_count} views)` : ''}`,
      body: event === 'viewed' ? null : `${fmt(q.total_mrr)}/mo · ${fmt(q.total_one_time)} one-time${who && (event === 'accepted' || event === 'declined') ? ` · by ${who}` : ''}`,
      created_by: actor.id ?? null, created_by_name: actor.name ?? (event === 'viewed' || event === 'accepted' || event === 'declined' ? (who || 'Customer') : null),
    })
    if (event !== 'viewed') await syncDealFromQuote(q.id)

    // Stage moves — forward only, open deals only, and only for the primary quote.
    deal = await loadDeal(q.opportunity_id)
    if (!deal || deal.quote_id !== q.id) return
    const from = normalizeStage(deal.stage)
    const target = event === 'sent' ? 'propose' : event === 'accepted' ? 'contract' : null
    if (!target || !ORDER.includes(from) || ORDER.indexOf(from) >= ORDER.indexOf(target)) return
    const { error } = await sb.from('opportunities')
      .update({ stage: target, probability: STAGE_PROB[target] ?? 0, updated_at: new Date().toISOString() })
      .eq('id', deal.id)
    if (error) { console.error('[deal-sync] stage:', error.message); return }
    const reason = event === 'sent' ? 'Proposal sent' : `Proposal accepted${who ? ` by ${who}` : ''}`
    await log(deal, {
      type: 'stage_change', quote_id: q.id,
      subject: `${STAGE_LABELS[from] ?? from} → ${STAGE_LABELS[target] ?? target}`,
      body: `${reason} (${label}) — moved automatically`, outcome: reason,
      created_by: actor.id ?? null, created_by_name: actor.name ?? 'Nexus',
    })
  } catch (e) { console.error('[deal-sync] event failed:', (e as Error).message) }
}

/** Customer opened the proposal: count it, and log at most one "viewed" per 30 minutes. */
export async function quoteViewed(quoteId: string): Promise<void> {
  try {
    const { data } = await sb.from('quotes').select('id, view_count, first_viewed_at, last_viewed_at, status').eq('id', quoteId).maybeSingle()
    if (!data) return
    const now = new Date()
    const recent = data.last_viewed_at && now.getTime() - new Date(data.last_viewed_at).getTime() < 30 * 60 * 1000
    const upd: Row = { view_count: (data.view_count ?? 0) + 1, last_viewed_at: now.toISOString() }
    if (!data.first_viewed_at) upd.first_viewed_at = now.toISOString()
    if (data.status === 'sent') upd.status = 'viewed'
    const { error } = await sb.from('quotes').update(upd).eq('id', quoteId)
    if (error) { console.error('[deal-sync] view count:', error.message); return }
    if (!recent) await quoteEvent(quoteId, 'viewed')
  } catch (e) { console.error('[deal-sync] view failed:', (e as Error).message) }
}
