/**
 * Lexi — proactive (Phase 3).
 *
 *   computeNudges(ctx)   "I noticed…" items: late jobs, jobs with no tech, stalled
 *                        deals, overdue tasks, emails you owe, open incidents,
 *                        proposals about to expire. Each has a ready question for
 *                        Lexi and a link. Snoozed items are hidden.
 *   snoozeNudge(...)     hide one item for N days (user_settings.lexi_snoozed).
 *   buildBriefEmail(u)   the weekday morning brief (counts + top items + a short
 *                        written intro), as an email.
 *   sendMorningBrief(u)  build + send via Resend; marks it sent for today.
 *
 * Everything reads through lib/lexi/tools.ts, so the user only ever sees what
 * they are allowed to see. Settings live in user_settings (migration 201).
 */
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import type { PortalUser } from '@/lib/current-user'
import { lexiCtx, runReadTool, type LexiCtx } from '@/lib/lexi/tools'
import { sendEmail } from '@/lib/email-sender'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const FAST_MODEL = process.env.LEXI_FAST_MODEL || 'claude-haiku-4-5-20251001'
const APP_URL = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://portal.gateguard.co').replace(/\/+$/, '')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

export type Nudge = { key: string; tone: 'red' | 'orange' | 'blue'; kind: string; title: string; detail: string; ask: string; href?: string }

const nice = (d?: string | null) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '')
const dayStr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) // YYYY-MM-DD in Eastern

// ── Settings ─────────────────────────────────────────────────────────────────
export async function getLexiSettings(userId: string): Promise<{ briefEmail: boolean; lastSent: string | null; snoozed: Record<string, string>; error?: string }> {
  const { data, error } = await sb.from('user_settings').select('lexi_brief_email, lexi_brief_last_sent, lexi_snoozed').eq('user_id', userId).maybeSingle()
  if (error) return { briefEmail: false, lastSent: null, snoozed: {}, error: notReady(error.message) }
  return { briefEmail: !!data?.lexi_brief_email, lastSent: data?.lexi_brief_last_sent ?? null, snoozed: (data?.lexi_snoozed as Record<string, string>) ?? {} }
}

async function saveSettings(u: PortalUser, patch: Record<string, unknown>): Promise<string | null> {
  const { error } = await sb.from('user_settings').upsert({ user_id: u.id, ...patch }, { onConflict: 'user_id' })
  return error ? notReady(error.message) : null
}

export const setBriefEmail = (u: PortalUser, on: boolean) => saveSettings(u, { lexi_brief_email: on })

export async function snoozeNudge(u: PortalUser, key: string, days: number): Promise<string | null> {
  if (!/^[a-z_-]+:[0-9a-f-]{36}$/i.test(key)) return 'Bad item.'
  const s = await getLexiSettings(u.id)
  if (s.error) return s.error
  const now = Date.now()
  // Keep the map small: drop expired snoozes while we're here.
  const next = Object.fromEntries(Object.entries(s.snoozed).filter(([, until]) => Date.parse(until) > now))
  next[key] = new Date(now + Math.max(1, Math.min(30, days)) * 86400000).toISOString()
  return saveSettings(u, { lexi_snoozed: next })
}

const notReady = (m: string) => (/lexi_(brief|snoozed)/.test(m) && /does not exist|schema cache|column/i.test(m) ? 'Lexi’s brief settings aren’t set up yet — run migration 201.' : m)

// ── Nudges ───────────────────────────────────────────────────────────────────
export async function computeNudges(ctx: LexiCtx, opts: { includeSnoozed?: boolean } = {}): Promise<{ nudges: Nudge[]; counts: Record<string, number> }> {
  const [brief, inbox, settings] = await Promise.all([
    runReadTool('daily_brief', {}, ctx),
    runReadTool('waiting_on_me', { days: 21, limit: 20 }, ctx),
    getLexiSettings(ctx.user.id),
  ])
  const d = brief.data as Row
  const waiting = (((inbox.data as Row)?.waiting ?? []) as Row[])
  const out: (Nudge & { rank: number })[] = []

  for (const w of (d.jobs_overdue ?? []) as Row[]) out.push({ rank: 1, key: `job-late:${w.id}`, tone: 'red', kind: 'Late job', title: [w.number, w.title].filter(Boolean).join(' · ') || 'Work order', detail: `${w.site ?? 'No site'} · was due ${nice(w.scheduled)}${w.tech ? ` · ${w.tech}` : ' · no tech'}`, ask: `${w.number ?? 'This job'} at ${w.site ?? 'the site'} is late (was due ${nice(w.scheduled)}). What should I do — reschedule it, reassign it, or call the customer?`, href: `/maintenance/${w.id}` })
  for (const i of (d.open_incidents ?? []) as Row[]) out.push({ rank: 2, key: `incident:${i.id}`, tone: 'red', kind: 'System problem', title: i.title ?? 'Open incident', detail: [i.severity, i.status].filter(Boolean).join(' · '), ask: `Tell me about the open incident "${i.title}" and what we should do.` })
  const lateIds = new Set(((d.jobs_overdue ?? []) as Row[]).map(w => w.id)) // a late job already says "no tech"
  for (const w of (d.jobs_needing_a_tech ?? []) as Row[]) if ((w.age_days ?? 0) >= 1 && !lateIds.has(w.id)) out.push({ rank: 3, key: `job-notech:${w.id}`, tone: 'orange', kind: 'Needs a tech', title: [w.number, w.title].filter(Boolean).join(' · ') || 'Work order', detail: `${w.site ?? 'No site'} · waiting ${w.age_days} day${w.age_days === 1 ? '' : 's'} for a tech`, ask: `${w.number ?? 'This job'} at ${w.site ?? 'the site'} has no tech after ${w.age_days} days. Who should take it?`, href: `/maintenance/${w.id}` })
  for (const m of waiting) if ((m.waiting_days ?? 0) >= 2) out.push({ rank: 4, key: `email:${m.id}`, tone: 'orange', kind: 'Email you owe', title: m.subject ?? '(no subject)', detail: `${m.from} · waiting ${m.waiting_days} days`, ask: `Draft a reply to ${m.from} about "${m.subject}" (thread ${m.id}).`, href: '/messages' })
  for (const t of (d.my_tasks_due_or_overdue ?? []) as Row[]) if (t.id && t.due && t.due < dayStr()) out.push({ rank: 5, key: `task:${t.id}`, tone: 'orange', kind: 'Overdue task', title: t.title, detail: `was due ${nice(t.due)}${t.linked ? ` · ${t.linked}` : ''}`, ask: `My task "${t.title}" is overdue (was due ${nice(t.due)}). Help me finish it or move it to a better day.`, href: `/?task=${t.id}` })
  for (const q of (d.proposals_expiring_this_week ?? []) as Row[]) out.push({ rank: 6, key: `proposal:${q.id}`, tone: 'blue', kind: 'Proposal expiring', title: q.title ?? 'Proposal', detail: `expires ${nice(q.valid_until)}`, ask: `The proposal "${q.title}" expires ${nice(q.valid_until)}. Who should I follow up with, and what should I say?` })
  for (const s of (d.deals_stalled ?? []) as Row[]) out.push({ rank: 7, key: `deal:${s.id}`, tone: 'blue', kind: 'Quiet deal', title: s.name || s.account || 'Deal', detail: `${s.stage}${s.value ? ` · ${s.value}` : ''} · quiet ${s.days_since_update} days`, ask: `The deal "${s.name || s.account}" has been quiet ${s.days_since_update} days in ${s.stage}. What's the best next step to move it?`, href: `/?tab=opps&deal=${s.id}` })

  const now = Date.now()
  const live = out.filter(n => opts.includeSnoozed || !(settings.snoozed[n.key] && Date.parse(settings.snoozed[n.key]) > now))
  live.sort((a, b) => a.rank - b.rank)
  const counts = { lateJobs: (d.jobs_overdue ?? []).length, needTech: (d.jobs_needing_a_tech ?? []).length, todayJobs: (d.jobs_scheduled_today ?? []).length, stalledDeals: (d.deals_stalled ?? []).length, tasks: (d.my_tasks_due_or_overdue ?? []).length, emailsOwed: waiting.length, incidents: (d.open_incidents ?? []).length, expiring: (d.proposals_expiring_this_week ?? []).length }
  return { nudges: live.slice(0, 12).map(({ rank: _r, ...n }) => n), counts }
}

// ── Morning brief email ──────────────────────────────────────────────────────
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const TONE: Record<string, string> = { red: '#D70015', orange: '#B25000', blue: '#0071E3' }

async function writeIntro(first: string, counts: Record<string, number>, nudges: Nudge[]): Promise<string> {
  const fallback = nudges.length ? `Here’s what needs you today, ${first}. Start with the first item below.` : `Nothing urgent this morning, ${first}. A good day to move a deal forward.`
  if (!process.env.ANTHROPIC_API_KEY) return fallback
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const r = await Promise.race([
      anthropic.messages.create({
        model: FAST_MODEL, max_tokens: 160,
        messages: [{ role: 'user', content: `You are Lexi, the assistant inside Gate Guard's Nexus software. Write a 2–3 sentence morning note to ${first}: what matters most today and the one thing to do first. Plain, warm, no greeting line, no lists, no emojis, no invented facts.\nNumbers: ${JSON.stringify(counts)}\nTop items: ${JSON.stringify(nudges.slice(0, 6).map(n => `${n.kind}: ${n.title} — ${n.detail}`))}` }],
      }),
      new Promise<null>(res => setTimeout(() => res(null), 8000)),
    ])
    const t = r && 'content' in r ? r.content.map(b => (b.type === 'text' ? b.text : '')).join('').trim() : ''
    return t ? t.slice(0, 600) : fallback
  } catch { return fallback }
}

export async function buildBriefEmail(u: PortalUser): Promise<{ subject: string; html: string; count: number }> {
  const ctx = await lexiCtx(u)
  const { nudges, counts } = await computeNudges(ctx)
  const first = u.name.split(' ')[0] || 'there'
  const intro = await writeIntro(first, counts, nudges)
  const base = APP_URL()
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/New_York' })
  const stat = (l: string, v: number, warn = false, last = false) => `<td style="padding:10px 12px;border-right:${last ? '0' : '1px solid #EEF0F4'};text-align:left;vertical-align:top"><div style="font-size:12px;color:#6E6E73">${l}</div><div style="font-size:22px;font-weight:600;color:${warn && v ? '#D70015' : '#1D1D1F'}">${v}</div></td>`
  const rows = nudges.slice(0, 8).map(n => `<tr><td style="padding:12px 0;border-top:1px solid #EEF0F4">
      <div style="font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:${TONE[n.tone]}">${esc(n.kind)}</div>
      <div style="font-size:15px;font-weight:600;color:#1D1D1F;margin-top:2px">${n.href ? `<a href="${esc(base + n.href)}" style="color:#1D1D1F;text-decoration:none">${esc(n.title)}</a>` : esc(n.title)}</div>
      <div style="font-size:13px;color:#6E6E73;margin-top:2px">${esc(n.detail)}</div></td></tr>`).join('')
  const html = `<!doctype html><html><body style="margin:0;background:#EEF2F7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',Inter,Segoe UI,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF2F7"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
    <tr><td style="background:#0E1726;border-radius:16px 16px 0 0;padding:22px 24px">
      <div style="color:#8EC1FF;font-size:13px">${esc(date)}</div>
      <div style="color:#fff;font-size:24px;font-weight:600;margin-top:4px">Good morning, ${esc(first)}</div>
    </td></tr>
    <tr><td style="background:#fff;padding:20px 24px;border-radius:0 0 16px 16px">
      <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#1D1D1F">${esc(intro)}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F8FA;border-radius:12px;margin-bottom:8px"><tr>
        ${stat('Late jobs', counts.lateJobs, true)}${stat('Need a tech', counts.needTech)}${stat('Jobs today', counts.todayJobs)}${stat('Emails owed', counts.emailsOwed)}${stat('Quiet deals', counts.stalledDeals, false, true)}
      </tr></table>
      ${rows ? `<div style="font-size:13px;font-weight:600;color:#6E6E73;margin:18px 0 0">I noticed</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>` : `<p style="font-size:14px;color:#6E6E73">Nothing needs you right now.</p>`}
      <div style="margin-top:20px"><a href="${esc(base)}/?tab=lexi" style="display:inline-block;background:#0071E3;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:12px">Open Lexi</a></div>
      <p style="margin:20px 0 0;font-size:12px;color:#8E8E93">You get this because you turned on the morning brief in Lexi. Turn it off there anytime.</p>
    </td></tr>
  </table></td></tr></table></body></html>`
  const subject = nudges.length ? `Your day: ${nudges.length} thing${nudges.length === 1 ? '' : 's'} need you${counts.lateJobs ? ` · ${counts.lateJobs} late job${counts.lateJobs === 1 ? '' : 's'}` : ''}` : 'Your day: nothing urgent'
  return { subject, html, count: nudges.length }
}

/** Build + send. force=true sends even if one already went out today (the "send me one now" button). */
export async function sendMorningBrief(u: PortalUser, opts: { force?: boolean } = {}): Promise<{ ok: boolean; skipped?: string; error?: string }> {
  if (!u.email) return { ok: false, error: 'No email address on this account.' }
  const today = dayStr()
  if (!opts.force) {
    const s = await getLexiSettings(u.id)
    if (s.error) return { ok: false, error: s.error }
    if (s.lastSent === today) return { ok: true, skipped: 'already sent today' }
  }
  const mail = await buildBriefEmail(u)
  const r = await sendEmail({ to: u.email, subject: mail.subject, html: mail.html })
  if (!r.success) return { ok: false, error: r.error ?? 'Email didn’t send.' }
  const err = await saveSettings(u, { lexi_brief_last_sent: today })
  if (err) console.error('[lexi/brief] mark sent failed:', err)
  return { ok: true }
}
