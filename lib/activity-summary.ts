/**
 * lib/activity-summary.ts — the property portal's emailed summary (Nov 24 2026).
 * Each manager picks Off / Daily / Weekly on the Activity page (stored on the portal:
 * client_portals.branding.summary_subs[managerId] — no migration). Inngest
 * nexus-portal-summaries sends daily ones every morning and weekly ones on Mondays.
 * Content: door events (valid / denied / admin), the most-denied people & doors,
 * what's lowering health right now, cameras offline. Read-only; never sends to a
 * manager who is turned off or has no email.
 */
import { createClient } from '@supabase/supabase-js'
import { recentSiteEvents } from '@/lib/brivo-events-store'
import { siteHealth } from '@/lib/site-health'
import { sendEmail } from '@/lib/email-sender'

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export type Freq = 'off' | 'daily' | 'weekly'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const subsOf = (branding: any): Record<string, Freq> => (branding && typeof branding.summary_subs === 'object' && branding.summary_subs) || {}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const cat = (a: string) => /\b(deni|invalid|reject|fail|unauthor)/i.test(a) ? 'denied' : /(administrator|admin|pulse|manager|remote|unlock early)/i.test(a) ? 'admin' : 'access'

export async function buildSummary(siteId: string, days: number): Promise<{ subject: string; html: string } | null> {
  const { data: site } = await db().from('sites').select('name').eq('id', siteId).maybeSingle()
  const name = site?.name ?? 'Your property'
  const evs = await recentSiteEvents(siteId, { days, limit: 3000 }).catch(() => [])
  const since = Date.now() - days * 864e5
  const inWin = evs.filter(e => e.occurred && Date.parse(e.occurred) >= since)
  const n = { access: 0, denied: 0, admin: 0 }
  const deniedWho = new Map<string, number>(), deniedDoor = new Map<string, number>()
  for (const e of inWin) {
    const c = cat(e.action) as keyof typeof n; n[c]++
    if (c === 'denied') { if (e.actor) deniedWho.set(e.actor, (deniedWho.get(e.actor) ?? 0) + 1); if (e.door) deniedDoor.set(e.door, (deniedDoor.get(e.door) ?? 0) + 1) }
  }
  const top = (m: Map<string, number>) => Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const h = (await siteHealth([siteId]).catch(() => new Map())).get(siteId)
  const period = days === 1 ? 'yesterday' : `the last ${days} days`
  const row = (k: string, v: string | number) => `<tr><td style="padding:4px 12px 4px 0;color:#6E6E73">${esc(k)}</td><td style="padding:4px 0;font-weight:600">${esc(String(v))}</td></tr>`
  const list = (items: [string, number][]) => items.length ? `<ul style="margin:4px 0 12px;padding-left:18px">${items.map(([k, v]) => `<li>${esc(k)} — ${v}</li>`).join('')}</ul>` : '<p style="margin:4px 0 12px;color:#6E6E73">None</p>'
  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1D1D1F;max-width:560px">
    <h2 style="margin:0 0 4px">${esc(name)}</h2><p style="margin:0 0 16px;color:#6E6E73">Activity summary for ${period}</p>
    <table style="border-collapse:collapse;margin-bottom:12px">${row('Door & gate uses', n.access)}${row('Access denied', n.denied)}${row('Manager / remote actions', n.admin)}${h ? row('Health score', `${h.score} / 100`) : ''}</table>
    <h3 style="margin:12px 0 4px;font-size:15px">Needs attention now</h3>${h?.reasons?.length ? `<ul style="margin:4px 0 12px;padding-left:18px">${h.reasons.map((r: { text: string }) => `<li>${esc(r.text)}</li>`).join('')}</ul>` : '<p style="margin:4px 0 12px;color:#6E6E73">Nothing — all clear.</p>'}
    <h3 style="margin:12px 0 4px;font-size:15px">Most denied (people)</h3>${list(top(deniedWho))}
    <h3 style="margin:12px 0 4px;font-size:15px">Most denied (doors & gates)</h3>${list(top(deniedDoor))}
    <p style="color:#6E6E73;font-size:12px;margin-top:20px">You chose to get this in the property portal (Activity → Email summary). Change it there any time.</p></div>`
  return { subject: `${name} — activity ${days === 1 ? 'yesterday' : 'this week'}`, html }
}

/** Send every subscribed manager their summary. kind 'daily' (every day) or 'weekly'. */
export async function sendSummaries(kind: 'daily' | 'weekly'): Promise<{ sent: number; failed: number }> {
  const { data: portals } = await db().from('client_portals').select('id, site_id, branding, status').neq('status', 'disabled').not('site_id', 'is', null)
  let sent = 0, failed = 0
  for (const p of (portals ?? []) as { id: string; site_id: string; branding: unknown }[]) {
    const subs = subsOf(p.branding)
    const ids = Object.entries(subs).filter(([, f]) => f === kind).map(([id]) => id)
    if (!ids.length) continue
    const { data: mgrs } = await db().from('portal_managers').select('id, email, active').eq('client_portal_id', p.id).in('id', ids)
    const to = (mgrs ?? []).filter(m => m.active && m.email).map(m => String(m.email))
    if (!to.length) continue
    const s = await buildSummary(p.site_id, kind === 'daily' ? 1 : 7)
    if (!s) continue
    for (const addr of to) { const r = await sendEmail({ to: addr, subject: s.subject, html: s.html }); if (r.success) sent++; else failed++ }
  }
  return { sent, failed }
}
