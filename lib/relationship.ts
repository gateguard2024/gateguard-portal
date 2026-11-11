/**
 * One relationship, one live record: Lead → Deal → Customer (the property).
 *
 * When a lead becomes a deal, or a deal is won, everything pointing at the old record
 * moves to the new one — email threads (and so the next emails from those people) and
 * tasks — so search, "Link to…" and Mail only ever show where the relationship is now.
 * The old record stays as history inside the new one (lead → deal keeps lead_id on the
 * deal; deal → customer keeps related_org_id on the deal).
 *
 * Note: no .or() on these UPDATEs (PostgREST 12.2 fails on .or() in PATCH) — one query
 * per pattern instead.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

type Step =
  | { from: 'lead'; fromId: string; to: 'opportunity'; toId: string; label: string }
  | { from: 'opportunity'; fromId: string; to: 'customer'; toId: string; label: string }

export async function carryForward(db: SupabaseClient, s: Step): Promise<{ threads: number; tasks: number; errors: string[] }> {
  const errors: string[] = []
  let threads = 0
  const now = new Date().toISOString()
  const toThread: Record<string, unknown> = { linked_type: s.to, linked_id: s.toId, linked_label: s.label, updated_at: now }
  if (s.to === 'opportunity') toThread.linked_opportunity_id = s.toId
  if (s.to === 'customer') { toThread.linked_customer_org_id = s.toId; toThread.linked_opportunity_id = null }

  // Threads linked the new way (linked_type / linked_id)…
  {
    const { data, error } = await db.from('message_threads').update(toThread).eq('linked_type', s.from).eq('linked_id', s.fromId).select('id')
    if (error) errors.push(`threads: ${error.message}`); else threads += data?.length ?? 0
  }
  // …and the older way (linked_opportunity_id) for deals.
  if (s.from === 'opportunity') {
    const { data, error } = await db.from('message_threads').update(toThread).eq('linked_opportunity_id', s.fromId).select('id')
    if (error) errors.push(`threads (old link): ${error.message}`); else threads += data?.length ?? 0
  }

  const { data: t, error: tErr } = await db.from('todos')
    .update({ linked_type: s.to, linked_id: s.toId, linked_label: s.label })
    .eq('linked_type', s.from).eq('linked_id', s.fromId).select('id')
  if (tErr) errors.push(`tasks: ${tErr.message}`)

  for (const e of errors) console.error(`carryForward ${s.from}→${s.to}:`, e)
  return { threads, tasks: t?.length ?? 0, errors }
}

/**
 * The people on a won deal become the customer's contacts, so their next emails file
 * themselves under the customer (Mail's auto-link reads org_contacts). Skips anyone
 * already listed.
 */
export async function copyDealContactsToCustomer(db: SupabaseClient, oppId: string, orgId: string, fallback?: { name?: string | null; email?: string | null; phone?: string | null }): Promise<string | null> {
  const { data: oc } = await db.from('opportunity_contacts').select('contact_name, contact_email, contact_phone, contact_title').eq('opportunity_id', oppId).limit(50)
  const people = (oc ?? []).map((c: Record<string, string | null>) => ({ name: c.contact_name, email: c.contact_email, phone: c.contact_phone, title: c.contact_title }))
  if (fallback?.email && !people.some((p) => (p.email ?? '').toLowerCase() === fallback.email!.toLowerCase())) people.push({ name: fallback.name ?? null, email: fallback.email, phone: fallback.phone ?? null, title: null })
  const withEmail = people.filter((p) => p.email && /@/.test(p.email))
  if (!withEmail.length) return null
  const { data: have, error: hErr } = await db.from('org_contacts').select('email').eq('org_id', orgId)
  if (hErr) return hErr.message
  const known = new Set((have ?? []).map((h: { email: string | null }) => (h.email ?? '').toLowerCase()))
  const rows = withEmail.filter((p) => !known.has(p.email!.toLowerCase())).map((p, i) => ({
    org_id: orgId, name: p.name || p.email!, email: p.email, phone: p.phone ?? null, title: p.title ?? null, is_primary: known.size === 0 && i === 0,
  }))
  if (!rows.length) return null
  const { error } = await db.from('org_contacts').insert(rows)
  return error ? error.message : null
}
