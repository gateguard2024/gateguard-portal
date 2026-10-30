'use client'

/**
 * Proposals (Gate Guard sells partnership proposals, not plain quotes).
 * startProposal() creates a partnership proposal on the deal — pre-filled from the deal —
 * and opens the proposal editor (/quotes/[id]/partnership) in a new tab, the same flow the
 * old deal window used. Proposals are stored in the quotes table (quote_mode 'partnership').
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

export const proposalHref = (q: Row) =>
  q.quote_mode === 'line_item' || q.quote_mode === 'survey' ? `/quotes/${q.id}` : `/quotes/${q.id}/partnership`

export async function startProposal(deal: Row, contacts: Row[] = []): Promise<{ ok: true } | { ok: false; error: string }> {
  // Open the tab now, while we still have the click — opening after the await gets popup-blocked.
  const win = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null
  try {
    const primary = contacts.find(c => c.is_primary) ?? contacts[0] ?? null
    const body = {
      title: String(deal.name || deal.account_name || 'New proposal'),
      opportunity_id: deal.id,
      quote_mode: 'partnership',
      client_name: primary?.contact_name || deal.account_name || deal.site_contact_name || null,
      client_email: primary?.contact_email || deal.contact_email || deal.site_contact_email || null,
      client_phone: primary?.contact_phone || deal.contact_phone || deal.site_contact_phone || null,
      property_name: deal.account_name || deal.name || null,
      units: deal.units ?? null,
    }
    const r = await fetch('/api/quotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const j = await r.json().catch(() => ({}))
    const qid = j?.quote?.id || j?.id
    if (!r.ok || !qid) { win?.close(); return { ok: false, error: j?.error || 'Could not create the proposal.' } }
    const url = `/quotes/${qid}/partnership`
    if (win) win.location.href = url
    else window.location.href = url // popup blocked → same tab
    return { ok: true }
  } catch {
    win?.close()
    return { ok: false, error: 'Could not create the proposal.' }
  }
}
