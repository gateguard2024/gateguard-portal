/**
 * Portal service — the property's service requests + jobs for the manager's
 * Service page (/api/portal/[slug]/service).
 *   • Requests  = wo_requests for the site (from the portal, the public request
 *     form, unit QR labels, and the AI — Gate Watch files "Gate left open").
 *   • Jobs      = work_orders for the site. A request turned into a job shows as
 *     that job (with "from your request" / "found by AI").
 * Shown to the manager: title, where, status, dates, first line of the details.
 * NEVER shown: internal notes, prices, costs, the AI's reasoning, tech phone numbers.
 */
import { createClient } from '@supabase/supabase-js'

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

export type ServiceItem = {
  id: string
  kind: 'request' | 'job'
  number: string | null
  title: string
  where: string | null
  details: string | null
  status: string            // friendly label
  stage: 'received' | 'scheduled' | 'working' | 'waiting' | 'done' | 'closed'
  priority: string | null
  ai: boolean               // found by AI (Gate Watch etc.)
  from_request: boolean
  opened: string | null
  scheduled: string | null
  done: string | null
  tech: string | null       // first name only
  photos?: string[]
}
export type ServiceData = { open: ServiceItem[]; history: ServiceItem[]; counts: { open: number; working: number; ai_30d: number; done_30d: number }; error?: string }

const WO_DONE = ['completed', 'complete', 'closed', 'done', 'invoiced', 'cancelled', 'canceled']
const isAiRequest = (r: Row) => /\(ai\)/i.test(String(r.contact_name ?? '')) || /(^|\n)AI:/.test(String(r.description ?? ''))
const firstLine = (s: unknown) => { const t = String(s ?? '').split('\n').map(x => x.trim()).find(x => x && !/^AI:/.test(x) && !/^Photo: /.test(x)); return t ? t.slice(0, 240) : null }
/** Photos added from the portal are kept as "Photo: <url>" lines in the request (no migration). */
export const photosOf = (s: unknown) => String(s ?? '').split('\n').map(x => x.trim()).filter(x => /^Photo: https:\/\//.test(x)).map(x => x.slice(7)).slice(0, 10)
const firstName = (s: unknown) => { const t = String(s ?? '').trim(); return t ? t.split(/\s+/)[0] : null }

export function jobStage(status: string): { stage: ServiceItem['stage']; label: string } {
  const s = status.toLowerCase().replace(/[\s-]+/g, '_')
  if (['cancelled', 'canceled'].includes(s)) return { stage: 'closed', label: 'Cancelled' }
  if (WO_DONE.includes(s)) return { stage: 'done', label: 'Done' }
  if (['in_progress', 'on_site', 'en_route', 'in_route', 'started', 'working'].includes(s)) return { stage: 'working', label: s === 'en_route' || s === 'in_route' ? 'Tech on the way' : 'Being worked on' }
  if (['on_hold', 'waiting_parts', 'waiting', 'parts_ordered', 'pending_parts'].includes(s)) return { stage: 'waiting', label: 'Waiting on parts' }
  if (['scheduled', 'assigned', 'dispatched'].includes(s)) return { stage: 'scheduled', label: 'Scheduled' }
  return { stage: 'received', label: 'Received' }
}
export function requestStage(status: string): { stage: ServiceItem['stage']; label: string } {
  const s = status.toLowerCase()
  if (s === 'closed') return { stage: 'closed', label: 'Closed' }
  if (s === 'acknowledged') return { stage: 'received', label: 'Being reviewed' }
  return { stage: 'received', label: 'Received' }
}

export async function getServiceData(siteId: string | null): Promise<ServiceData> {
  const empty: ServiceData = { open: [], history: [], counts: { open: 0, working: 0, ai_30d: 0, done_30d: 0 } }
  if (!siteId) return empty
  const sb = db()
  const since = new Date(Date.now() - 365 * 864e5).toISOString()
  const [rq, wo] = await Promise.all([
    sb.from('wo_requests').select('id, title, description, area, priority_requested, status, contact_name, converted_wo_id, created_at, updated_at')
      .eq('site_id', siteId).gte('created_at', since).order('created_at', { ascending: false }).limit(300),
    sb.from('work_orders').select('*').eq('site_id', siteId).gte('created_at', since).order('created_at', { ascending: false }).limit(300),
  ])
  if (rq.error) return { ...empty, error: rq.error.message }
  if (wo.error) return { ...empty, error: wo.error.message }
  const requests = (rq.data ?? []) as Row[]
  const jobs = (wo.data ?? []) as Row[]

  // Which jobs came from a request (and was that request the AI's)?
  const fromReq = new Map<string, Row>()
  for (const r of requests) if (r.converted_wo_id) fromReq.set(String(r.converted_wo_id), r)

  const items: ServiceItem[] = []
  for (const j of jobs) {
    const st = jobStage(String(j.status ?? ''))
    const req = fromReq.get(String(j.id))
    items.push({
      id: String(j.id), kind: 'job', number: j.wo_number != null ? String(j.wo_number) : null,
      title: String(j.title ?? 'Service job'), where: j.location ?? req?.area ?? null,
      details: firstLine(req?.description ?? j.description), status: st.label, stage: st.stage,
      priority: j.priority ?? req?.priority_requested ?? null,
      ai: req ? isAiRequest(req) : /\(ai\)|gate watch/i.test(String(j.source ?? '')),
      from_request: !!req,
      opened: req?.created_at ?? j.created_at ?? null,
      scheduled: j.scheduled_date ?? j.scheduled_at ?? null,
      done: st.stage === 'done' ? (j.completed_at ?? j.updated_at ?? null) : null,
      tech: firstName(j.assignee_name), photos: req ? photosOf(req.description) : [],
    })
  }
  for (const r of requests) {
    if (r.converted_wo_id && jobs.some(j => String(j.id) === String(r.converted_wo_id))) continue // shown as its job
    const st = requestStage(String(r.status ?? 'new'))
    items.push({
      id: String(r.id), kind: 'request', number: null, title: String(r.title ?? 'Service request'), where: r.area ?? null,
      details: firstLine(r.description), status: st.label, stage: st.stage, priority: r.priority_requested ?? null,
      ai: isAiRequest(r), from_request: true, opened: r.created_at ?? null, scheduled: null,
      done: st.stage === 'closed' ? (r.updated_at ?? null) : null, tech: null, photos: photosOf(r.description),
    })
  }
  const closed = (i: ServiceItem) => i.stage === 'done' || i.stage === 'closed'
  const open = items.filter(i => !closed(i)).sort((a, b) => String(b.opened).localeCompare(String(a.opened)))
  const history = items.filter(closed).sort((a, b) => String(b.done ?? b.opened).localeCompare(String(a.done ?? a.opened))).slice(0, 150)
  const d30 = new Date(Date.now() - 30 * 864e5).toISOString()
  return {
    open, history,
    counts: {
      open: open.length,
      working: open.filter(i => i.stage === 'working' || i.stage === 'scheduled').length,
      ai_30d: items.filter(i => i.ai && String(i.opened) >= d30).length,
      done_30d: history.filter(i => i.stage === 'done' && String(i.done) >= d30).length,
    },
  }
}
