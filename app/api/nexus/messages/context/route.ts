import { NextRequest, NextResponse } from 'next/server'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safe(p: PromiseLike<{ data: unknown; error: unknown }>): Promise<any> {
  try { const r = await p; return r.error ? null : r.data } catch { return null }
}
const DONE_JOB = ['completed', 'complete', 'closed', 'cancelled', 'canceled', 'done']
const PAID = ['paid', 'void', 'voided', 'draft', 'cancelled', 'canceled', 'written_off']
const okEmail = (e: string) => /^[^\s,()*]+@[^\s,()*]+\.[a-z]{2,}$/i.test(e)

// GET /api/nexus/messages/context?thread=<id>
// "Who is this?" for the email you're reading: the deal or customer it's linked to, their
// properties, open jobs and unpaid invoices — what Gmail can't tell you.
// Dealers only see properties their company is on.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  const id = new URL(req.url).searchParams.get('thread') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Bad thread.' }, { status: 400 })
  const { data: thread } = await supabase.from('message_threads').select('*').eq('id', id).maybeSingle()
  if (!thread || thread.user_id !== user.id) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  const { data: chans } = await supabase.from('message_channels').select('display_name, config').eq('user_id', user.id)
  const self = new Set<string>([user.email?.toLowerCase() ?? ''])
  for (const c of chans ?? []) self.add(String((c.config as { from_address?: string } | null)?.from_address ?? c.display_name ?? '').toLowerCase())
  const parts = (Array.isArray(thread.participants) ? thread.participants : []) as { name?: string; address?: string }[]
  const people = parts.filter((p) => p.address && !self.has(p.address.toLowerCase()))
  const emails = [...new Set(people.map((p) => p.address!.toLowerCase()).filter(okEmail))].slice(0, 4)
  const domain = emails[0]?.split('@')[1] ?? null

  // Linked deal.
  const oppId = thread.linked_opportunity_id ?? (thread.linked_type === 'opportunity' ? thread.linked_id : null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let opportunity: any = null
  if (oppId) {
    const o = await safe(supabase.from('opportunities').select('*').eq('id', oppId).maybeSingle())
    if (o && (user.isCorporate || !o.dealer_org_id || o.dealer_org_id === user.org_id)) {
      opportunity = { id: o.id, name: o.name, stage: o.stage ?? null, mrr: o.est_mrr ?? null, setup: o.est_setup ?? null, close_date: o.close_date ?? null }
    }
  }

  // Customer + their properties.
  const custId = thread.linked_customer_org_id ?? (thread.linked_type === 'customer' ? thread.linked_id : null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sitesQ: any = supabase.from('sites').select('id, name, city, state, status, org_id, units').limit(8)
  const ors: string[] = []
  for (const e of emails) ors.push(`primary_contact_email.ilike.${e}`, `pm_email.ilike.${e}`)
  if (custId) ors.push(`org_id.eq.${custId}`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sites: any[] = []
  if (ors.length) {
    sitesQ = sitesQ.or(ors.join(','))
    if (!user.isCorporate && user.org_id) {
      sitesQ = sitesQ.or(`master_dealer_id.eq.${user.org_id},install_dealer_id.eq.${user.org_id},service_dealer_id.eq.${user.org_id},org_id.eq.${user.org_id}`)
    } else if (!user.isCorporate) sitesQ = null
    sites = sitesQ ? (await safe(sitesQ)) ?? [] : []
  }
  const siteIds = sites.map((s) => s.id)
  const orgIds = [...new Set([custId, ...sites.map((s) => s.org_id)].filter(Boolean))] as string[]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let customer: any = null
  if (orgIds[0] && (user.isCorporate || siteIds.length)) {
    const org = await safe(supabase.from('organizations').select('id, name, status').eq('id', orgIds[0]).maybeSingle())
    if (org) customer = { id: org.id, name: org.name, status: org.status ?? null }
  }

  // Open jobs at those properties.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let jobs: any[] = []
  if (siteIds.length) {
    const rows = await safe(supabase.from('work_orders').select('id, wo_number, title, status, priority, scheduled_date, site_id').in('site_id', siteIds).order('created_at', { ascending: false }).limit(20))
    jobs = ((rows ?? []) as any[]).filter((j) => !DONE_JOB.includes(String(j.status ?? '').toLowerCase())).slice(0, 5)
      .map((j: any) => ({ id: j.id, number: j.wo_number ?? null, title: j.title, status: j.status, priority: j.priority ?? null, date: j.scheduled_date ?? null }))
  }

  // Unpaid invoices.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let invoices: any[] = []
  if (siteIds.length || (user.isCorporate && orgIds.length)) {
    const orInv = [siteIds.length ? `site_id.in.(${siteIds.join(',')})` : '', user.isCorporate && orgIds.length ? `client_org_id.in.(${orgIds.join(',')})` : ''].filter(Boolean).join(',')
    let rows = await safe(supabase.from('invoices').select('*').or(orInv).order('created_at', { ascending: false }).limit(30))
    if (!rows && siteIds.length) rows = await safe(supabase.from('invoices').select('*').in('site_id', siteIds).order('created_at', { ascending: false }).limit(30))
    invoices = ((rows ?? []) as any[]).filter((i) => !PAID.includes(String(i.status ?? '').toLowerCase()))
      .map((i: any) => {
        const total = Number(i.total ?? i.amount ?? 0)
        const balance = i.balance_due != null ? Number(i.balance_due) : Math.max(0, total - Number(i.amount_paid ?? 0))
        return { id: i.id, number: i.invoice_number ?? null, balance, due_date: i.due_date ?? null, status: i.status }
      })
      .filter((i: { balance: number }) => i.balance > 0)
      .slice(0, 6)
  }
  const openBalance = invoices.reduce((a, i) => a + i.balance, 0)

  // Other conversations with the same people.
  let otherThreads = 0
  if (emails.length) {
    const { count } = await supabase.from('message_threads').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).neq('id', thread.id).or(emails.map((e) => `participants.cs.[{"address":"${e}"}]`).join(','))
    otherThreads = count ?? 0
  }

  return NextResponse.json({
    people: people.slice(0, 8).map((p) => ({ name: p.name || null, address: p.address })),
    domain,
    linked: thread.linked_type ? { type: thread.linked_type, id: thread.linked_id, label: thread.linked_label } : null,
    opportunity,
    customer,
    sites: sites.map((s) => ({ id: s.id, name: s.name, place: [s.city, s.state].filter(Boolean).join(', ') || null, status: s.status ?? null, units: s.units ?? null })),
    jobs,
    invoices,
    open_balance: Math.round(openBalance * 100) / 100,
    other_threads: otherThreads,
  })
}
