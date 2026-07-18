// lib/email-match.ts
// Auto-matching between synced email threads and CRM records.
//
// The rule: an email conversation belongs to an opportunity/customer when one
// of its outside participants is a known CRM contact email —
//   • opportunities.site_contact_email
//   • opportunity_contacts.contact_email
//   • org_contacts.email  (→ customer organization)
//
// autoLinkThread() is called from the Gmail sync (lib/mail-fetch.ts) and after
// in-portal sends. It only fills EMPTY links and never touches link_source
// 'manual', so a human link/unlink always wins over the matcher.

import type { SupabaseClient } from '@supabase/supabase-js'

const norm = (e: unknown): string => String(e ?? '').trim().toLowerCase()

// Build a PostgREST .or() filter of case-insensitive equality matches.
// Emails containing or() delimiter characters are skipped (they'd break the filter).
export function ilikeOr(column: string, emails: string[]): string | null {
  const safe = emails.filter((e) => e && !/[,()]/.test(e))
  if (!safe.length) return null
  return safe.map((e) => `${column}.ilike.${e}`).join(',')
}

/** Contact emails for an opportunity (embedded + contact rows), lowercased. */
export async function opportunityContactEmails(
  supabase: SupabaseClient,
  opportunityId: string,
): Promise<string[]> {
  const out = new Set<string>()
  const { data: opp } = await supabase
    .from('opportunities')
    .select('site_contact_email')
    .eq('id', opportunityId)
    .maybeSingle()
  if (opp?.site_contact_email) out.add(norm(opp.site_contact_email))
  const { data: contacts } = await supabase
    .from('opportunity_contacts')
    .select('contact_email')
    .eq('opportunity_id', opportunityId)
  for (const c of contacts ?? []) if (c.contact_email) out.add(norm(c.contact_email))
  out.delete('')
  return [...out]
}

/** Contact emails for a customer organization, lowercased. */
export async function orgContactEmails(
  supabase: SupabaseClient,
  orgId: string,
): Promise<string[]> {
  const { data } = await supabase.from('org_contacts').select('email').eq('org_id', orgId)
  const out = new Set<string>()
  for (const c of data ?? []) if (c.email) out.add(norm(c.email))
  out.delete('')
  return [...out]
}

export interface AutoLinkResult {
  opportunityId?: string
  customerOrgId?: string
  linked: boolean
}

/**
 * Try to link one thread to an opportunity and/or customer org by matching the
 * given participant addresses against CRM contact emails.
 *
 * - `addresses` should be every non-self address seen on the thread
 *   (from + to/cc of each message). Pass the connector's own address in
 *   `selfAddress` so it's excluded.
 * - Existing links are preserved; 'manual' link_source is never overwritten.
 */
export async function autoLinkThread(
  supabase: SupabaseClient,
  threadId: string,
  addresses: string[],
  selfAddress?: string,
): Promise<AutoLinkResult> {
  const self = norm(selfAddress)
  const candidates = [...new Set(addresses.map(norm))].filter(
    (a) => a && a.includes('@') && a !== self,
  )
  if (candidates.length === 0) return { linked: false }

  const { data: thread } = await supabase
    .from('message_threads')
    .select('id, linked_opportunity_id, linked_customer_org_id, link_source')
    .eq('id', threadId)
    .maybeSingle()
  if (!thread) return { linked: false }
  if (thread.link_source === 'manual') return { linked: false } // human decision wins
  if (thread.linked_opportunity_id && thread.linked_customer_org_id) return { linked: false }

  let opportunityId: string | undefined
  let customerOrgId: string | undefined

  // 1) opportunity_contacts — most specific signal.
  if (!thread.linked_opportunity_id) {
    const ocFilter = ilikeOr('contact_email', candidates)
    if (ocFilter) {
      const { data: oc } = await supabase
        .from('opportunity_contacts')
        .select('opportunity_id, contact_email, created_at')
        .or(ocFilter)
        .order('created_at', { ascending: false })
        .limit(1)
      if (oc?.[0]?.opportunity_id) opportunityId = oc[0].opportunity_id
    }

    // 2) opportunities.site_contact_email fallback.
    if (!opportunityId) {
      const oppFilter = ilikeOr('site_contact_email', candidates)
      if (oppFilter) {
        const { data: opp } = await supabase
          .from('opportunities')
          .select('id, created_at')
          .or(oppFilter)
          .order('created_at', { ascending: false })
          .limit(1)
        if (opp?.[0]?.id) opportunityId = opp[0].id
      }
    }
  }

  // 3) org_contacts → customer organization.
  if (!thread.linked_customer_org_id) {
    const orgFilter = ilikeOr('email', candidates)
    if (orgFilter) {
      const { data: orgC } = await supabase
        .from('org_contacts')
        .select('org_id, created_at')
        .or(orgFilter)
        .order('created_at', { ascending: false })
        .limit(1)
      if (orgC?.[0]?.org_id) customerOrgId = orgC[0].org_id
    }
  }

  if (!opportunityId && !customerOrgId) return { linked: false }

  const patch: Record<string, unknown> = { link_source: 'auto' }
  if (opportunityId) patch.linked_opportunity_id = opportunityId
  if (customerOrgId) patch.linked_customer_org_id = customerOrgId
  const { error } = await supabase.from('message_threads').update(patch).eq('id', threadId)
  if (error) return { linked: false }
  return { opportunityId, customerOrgId, linked: true }
}

/**
 * Collect every address on a thread (participants + message from/to) for
 * matching or suggestion queries.
 */
export async function threadAddresses(
  supabase: SupabaseClient,
  threadId: string,
): Promise<string[]> {
  const out = new Set<string>()
  const { data: thread } = await supabase
    .from('message_threads')
    .select('participants')
    .eq('id', threadId)
    .maybeSingle()
  for (const p of (thread?.participants as any[]) ?? []) if (p?.address) out.add(norm(p.address))
  const { data: msgs } = await supabase
    .from('messages')
    .select('from_address, to_addresses')
    .eq('thread_id', threadId)
    .limit(50)
  for (const m of msgs ?? []) {
    if (m.from_address) out.add(norm(m.from_address))
    for (const t of (m.to_addresses as any[]) ?? []) if (t?.address) out.add(norm(t.address))
  }
  out.delete('')
  return [...out]
}

/**
 * Backfill: run the matcher over recent threads that have no CRM link yet.
 * Used by POST /api/nexus/messages/match and safe to re-run any time.
 */
export async function matchUnlinkedThreads(
  supabase: SupabaseClient,
  opts: { limit?: number; channelId?: string } = {},
): Promise<{ scanned: number; linked: number }> {
  let query = supabase
    .from('message_threads')
    .select('id, channel_id, participants')
    .is('linked_opportunity_id', null)
    .is('linked_customer_org_id', null)
    .order('last_message_at', { ascending: false })
    .limit(opts.limit ?? 100)
  if (opts.channelId) query = query.eq('channel_id', opts.channelId)
  const { data: threads } = await query
  if (!threads?.length) return { scanned: 0, linked: 0 }

  // Look up each thread's channel address once so self-addresses are excluded.
  const channelIds = [...new Set(threads.map((t: any) => t.channel_id).filter(Boolean))]
  const selfByChannel: Record<string, string> = {}
  if (channelIds.length) {
    const { data: channels } = await supabase
      .from('message_channels')
      .select('id, config')
      .in('id', channelIds)
    for (const ch of channels ?? []) selfByChannel[ch.id] = norm((ch.config as any)?.from_address)
  }

  let linked = 0
  for (const t of threads) {
    const addrs = await threadAddresses(supabase, t.id)
    const res = await autoLinkThread(supabase, t.id, addrs, selfByChannel[t.channel_id] ?? '')
    if (res.linked) linked++
  }
  return { scanned: threads.length, linked }
}
