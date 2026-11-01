'use client'
/**
 * Events — shared types, labels, look and helpers for the Events list and the
 * event page. Light look (same tokens as Catalog / Tasks / Operations).
 */
import { BORDER, BRAND, FONT, GREEN, LINE, MUTED, ORANGE, RED, SHADOW, TEXT } from '@/components/nexus/catalog/shared'

export { BORDER, BRAND, FONT, GREEN, LINE, MUTED, ORANGE, RED, SHADOW, TEXT }

// ── Types ────────────────────────────────────────────────────────────────────
export interface RunItem { offset_min: number; item: string; owner?: string }
export interface EventStats { done: number; total: number; late: number; yes: number; invited: number; checkedIn: number; spent: number }
export interface EventRow {
  id: string; title: string; event_type: string; status: string
  event_date?: string | null; start_time?: string | null; end_time?: string | null
  venue?: string | null; venue_address?: string | null; venue_contact?: string | null; venue_phone?: string | null; booth_number?: string | null
  property_name?: string | null; site_id?: string | null; opportunity_id?: string | null
  host_name?: string | null; goal?: string | null
  expected_attendance?: number | null; actual_attendance?: number | null
  budget?: number | null; actual_cost?: number | null; outcome_notes?: string | null
  run_of_show?: RunItem[] | null; template_id?: string | null; org_id?: string | null
  stats?: EventStats
}
export interface TemplateRow {
  id: string; name: string; event_type: string; description?: string | null
  default_budget?: number | null; default_duration_min?: number | null; is_starter?: boolean; org_id?: string | null
  counts?: { tasks: number; supplies: number; emails: number }
  canEdit?: boolean
}
export interface ChecklistItem { id: string; category?: string | null; title: string; owner_name?: string | null; due_date?: string | null; status?: string | null }
export interface Supply { id: string; category?: string | null; item: string; qty?: number | null; vendor?: string | null; cost?: number | null; needed_by?: string | null; status?: string | null }
export interface CampaignStep { id: string; step: string; audience?: string | null; send_at?: string | null; status?: string | null; email_subject?: string | null; email_html?: string | null; sort_order?: number | null; sent_guest_ids?: string[] | null; sent_at?: string | null; auto_send?: boolean | null }
export interface Guest { id: string; name?: string | null; email?: string | null; phone?: string | null; company?: string | null; rsvp?: string | null; lead_id?: string | null; notes?: string | null; checked_in_at?: string | null }
export interface Detail {
  event: EventRow; checklist: ChecklistItem[]; supplies: Supply[]; campaign: CampaignStep[]; guests: Guest[]
  site?: { id: string; name: string; city?: string | null; state?: string | null } | null
  deal?: { id: string; name: string; stage?: string | null } | null
}

// ── Labels ───────────────────────────────────────────────────────────────────
export const EVENT_TYPES = [
  { id: 'launch_party', label: 'Property launch' },
  { id: 'association_show', label: 'Apartment association show' },
  { id: 'home_show', label: 'Home show' },
  { id: 'office_presentation', label: 'Office presentation' },
  { id: 'lunch_learn', label: 'Lunch & learn' },
  { id: 'trade_show', label: 'Trade show' },
  { id: 'open_house', label: 'Open house' },
  { id: 'meet_greet', label: 'Meet & greet' },
  { id: 'other', label: 'Other' },
] as const
export const TYPE_LABEL: Record<string, string> = Object.fromEntries(EVENT_TYPES.map(t => [t.id, t.label]))
export const BOOTH_TYPES = new Set(['association_show', 'home_show', 'trade_show'])

/** Status path, in order. Delayed / cancelled sit outside it. */
export const FLOW = [
  { id: 'planning', label: 'Planning', next: 'Start promoting' },
  { id: 'promoting', label: 'Promoting', next: 'Mark confirmed' },
  { id: 'confirmed', label: 'Confirmed', next: 'Mark held' },
  { id: 'held', label: 'Held', next: 'Start follow-up' },
  { id: 'follow_up', label: 'Follow-up', next: 'Mark complete' },
  { id: 'complete', label: 'Complete', next: '' },
] as const
export const STATUS_LABEL: Record<string, string> = { ...Object.fromEntries(FLOW.map(f => [f.id, f.label])), delayed: 'On hold', cancelled: 'Cancelled' }
export const STATUS_COLOR: Record<string, string> = { planning: '#6E6E73', promoting: BRAND, confirmed: '#5E5CE6', held: GREEN, follow_up: ORANGE, complete: GREEN, delayed: ORANGE, cancelled: RED }

/** Plan categories, in the order a planner works through them. */
export const PLAN_CATS = [
  { id: 'venue', label: 'Venue & setup' },
  { id: 'food', label: 'Food & catering' },
  { id: 'print', label: 'Printing & collateral' },
  { id: 'presentation', label: 'Presentation & demo' },
  { id: 'booth', label: 'Booth & giveaways' },
  { id: 'marketing', label: 'Invites & marketing' },
  { id: 'staffing', label: 'Staffing & travel' },
  { id: 'logistics', label: 'Shipping & packing' },
  { id: 'followup', label: 'Follow-up' },
] as const
export const PLAN_LABEL: Record<string, string> = { ...Object.fromEntries(PLAN_CATS.map(c => [c.id, c.label])), supplies: 'Booth & giveaways', ops: 'Presentation & demo' }
export const planCat = (c?: string | null) => (c === 'supplies' ? 'booth' : c === 'ops' ? 'presentation' : c && PLAN_LABEL[c] ? c : 'logistics')

export const SUPPLY_CATS = [
  { id: 'print', label: 'Printing & collateral' },
  { id: 'food', label: 'Food & drinks' },
  { id: 'giveaways', label: 'Giveaways & swag' },
  { id: 'booth', label: 'Booth & display' },
  { id: 'presentation', label: 'Presentation & AV' },
  { id: 'venue', label: 'Venue fees' },
  { id: 'rental', label: 'Rentals' },
  { id: 'logistics', label: 'Shipping' },
  { id: 'staffing', label: 'Travel & staff' },
  { id: 'other', label: 'Other' },
] as const
export const SUPPLY_LABEL: Record<string, string> = Object.fromEntries(SUPPLY_CATS.map(c => [c.id, c.label]))
export const SUPPLY_STATUS = [{ id: 'needed', label: 'To order' }, { id: 'ordered', label: 'Ordered' }, { id: 'received', label: 'Received' }, { id: 'packed', label: 'Packed' }] as const

export const STEP_LABEL: Record<string, string> = {
  save_the_date: 'Save the date', invite: 'Invitation', pre_show: 'Pre-show email', meeting_ask: 'Meeting request',
  reminder: 'Reminder', confirmation: 'Day-before', thank_you: 'Thank-you', follow_up: 'Follow-up',
}
export const stepLabel = (s: string) => STEP_LABEL[s] ?? s.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
export const AUDIENCES = [
  { id: 'all', label: 'Everyone (not declined)' }, { id: 'invited', label: 'No reply yet' }, { id: 'yes', label: 'Said yes' },
  { id: 'attended', label: 'Attended' }, { id: 'no_show', label: 'Said yes, didn’t come' },
] as const
export const RSVPS = [{ id: 'invited', label: 'Invited' }, { id: 'yes', label: 'Yes' }, { id: 'maybe', label: 'Maybe' }, { id: 'no', label: 'No' }, { id: 'attended', label: 'Came' }] as const

// ── Helpers ──────────────────────────────────────────────────────────────────
export const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
export function daysUntil(d?: string | null): number | null {
  if (!d) return null
  const a = Date.parse(`${d}T00:00:00Z`), b = Date.parse(`${todayISO()}T00:00:00Z`)
  return isNaN(a) ? null : Math.round((a - b) / 86400000)
}
export function countdown(d?: string | null) {
  const n = daysUntil(d)
  if (n == null) return 'No date'
  if (n === 0) return 'Today'
  if (n === 1) return 'Tomorrow'
  if (n === -1) return 'Yesterday'
  return n > 0 ? `In ${n} days` : `${-n} days ago`
}
export function fmtDate(d?: string | null, long = false) {
  if (!d) return 'No date'
  const x = new Date(`${d}T12:00:00`)
  return isNaN(x.getTime()) ? d : x.toLocaleDateString('en-US', long ? { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' } : { weekday: 'short', month: 'short', day: 'numeric' })
}
export function fmtTime(t?: string | null) {
  if (!t) return ''
  const m = /^(\d{1,2}):(\d{2})/.exec(t); if (!m) return t
  const h = +m[1]; return `${((h + 11) % 12) + 1}:${m[2]} ${h >= 12 ? 'PM' : 'AM'}`
}
export const money = (n?: number | null) => (n == null || !isFinite(Number(n)) ? '—' : `$${Math.round(Number(n)).toLocaleString()}`)
export const lineTotal = (s: Supply) => (Number(s.cost) || 0) * (Number(s.qty) || 1)
/** Clock time for a run-of-show row: event start + offset minutes. */
export function clockAt(start: string | null | undefined, offsetMin: number) {
  const m = /^(\d{1,2}):(\d{2})/.exec(start ?? '')
  if (!m) return offsetMin === 0 ? 'Start' : `${offsetMin > 0 ? '+' : '−'}${Math.abs(offsetMin)} min`
  let t = (+m[1] * 60 + +m[2] + offsetMin) % 1440; if (t < 0) t += 1440
  return fmtTime(`${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`)
}
/** Minutes from start for a typed clock time (HH:MM). */
export function offsetFor(start: string | null | undefined, clock: string) {
  const a = /^(\d{1,2}):(\d{2})/.exec(start ?? ''), b = /^(\d{1,2}):(\d{2})/.exec(clock)
  if (!a || !b) return 0
  return (+b[1] * 60 + +b[2]) - (+a[1] * 60 + +a[2])
}
export const toHHMM = (start: string | null | undefined, offsetMin: number) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(start ?? ''); if (!m) return ''
  let t = (+m[1] * 60 + +m[2] + offsetMin) % 1440; if (t < 0) t += 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/** Email bodies are stored as simple HTML; people edit them as plain text with two
 *  shortcuts that survive a round trip: **bold** and [link text](https://… or {{rsvp_link}}). */
export function htmlToText(html?: string | null) {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>\s*<p[^>]*>/gi, '\n\n').replace(/<\/?p[^>]*>/gi, '')
    .replace(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, (_m, href: string, t: string) => `[${t}](${href.replace(/&amp;/g, '&')})`)
    .replace(/<a[^>]*>(.*?)<\/a>/gi, '$1')
    .replace(/<(strong|b)>(.*?)<\/\1>/gi, '**$2**').replace(/<\/?(em|i)>/gi, '').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim()
}
export function textToHtml(text: string) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const inline = (p: string) => esc(p)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^)\s]+|\{\{\s*rsvp_link\s*\}\})\)/g, '<a href="$2">$1</a>')
    .replace(/\n/g, '<br>')
  return text.trim().split(/\n{2,}/).map(p => `<p>${inline(p)}</p>`).join('')
}

export const eventHref = (id: string) => `/?tab=events&event=${id}`

/** Split one pasted line / CSV row into guest fields (name, email, company, phone in any order). */
export function parseGuestLine(line: string) {
  const parts = line.split(/[,\t;]/).map(s => s.trim()).filter(Boolean)
  const out: { name?: string; email?: string; phone?: string; company?: string } = {}
  const rest: string[] = []
  for (const p of parts) {
    if (!out.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p)) out.email = p
    else if (!out.phone && /^[+()\d][\d\s().-]{6,}$/.test(p)) out.phone = p
    else rest.push(p)
  }
  if (rest[0]) out.name = rest[0]
  if (rest[1]) out.company = rest[1]
  return out
}

// ── Look ─────────────────────────────────────────────────────────────────────
export const EV_CSS = `
.ev{color:${TEXT};font-family:${FONT};letter-spacing:-.01em;width:100%;max-width:1360px;margin:0 auto;padding:4px 4px calc(140px + env(safe-area-inset-bottom))}
.ev *,.ep *,.ev-mod *{box-sizing:border-box}
.ev-hd{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;flex-wrap:wrap;margin:6px 0 18px}
.ev-hd h1{margin:0;color:#fff;font-size:30px;font-weight:600;letter-spacing:-.025em}
.ev-hd .sub{color:rgba(255,255,255,.72);font-size:14px;margin-top:4px}
.ev-acts{display:flex;gap:8px;flex-wrap:wrap}
.ev-b{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:36px;padding:0 14px;border-radius:10px;border:0;font:600 13px ${FONT};cursor:pointer;white-space:nowrap;text-decoration:none}
.ev-b.dark{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);color:#fff;font-weight:500}
.ev-b.pri{background:${BRAND};color:#fff}
.ev-b.line{background:#fff;border:1px solid ${BORDER};color:${TEXT};font-weight:500}
.ev-b.sm{height:30px;padding:0 10px;font-size:12.5px}
.ev-b.red{background:#fff;border:1px solid rgba(215,0,21,.3);color:${RED};font-weight:500}
.ev-b:disabled{opacity:.5;cursor:default}
.ev-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:16px}
.ev-kpi{text-align:left;background:#fff;border:0;border-radius:14px;padding:12px 14px;box-shadow:${SHADOW};cursor:pointer;font:inherit;color:inherit}
.ev-kpi[aria-pressed=true]{box-shadow:0 0 0 2px ${BRAND},${SHADOW}}
.ev-kpi .l{display:flex;align-items:center;gap:6px;font-size:12px;color:${MUTED};font-weight:500}
.ev-kpi .v{font-size:24px;font-weight:600;letter-spacing:-.02em;margin-top:2px}
.ev-kpi .s{font-size:12px;color:${MUTED}}
.ev-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex:none}
.ev-card{background:#fff;border-radius:16px;box-shadow:${SHADOW}}
.ev-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:12px 14px;border-bottom:1px solid ${LINE}}
.ev-in{height:36px;border:1px solid ${BORDER};border-radius:10px;padding:0 12px;font:400 14px ${FONT};color:${TEXT};background:#fff;min-width:0}
.ev-in:focus,.ev-ta:focus{outline:2px solid rgba(0,113,227,.35);outline-offset:0}
.ev-ta{width:100%;border:1px solid ${BORDER};border-radius:10px;padding:10px 12px;font:400 14px/1.5 ${FONT};color:${TEXT};background:#fff;resize:vertical}
.ev-chips{display:flex;gap:6px;overflow-x:auto;padding:10px 14px;border-bottom:1px solid ${LINE}}
.ev-chip{flex:none;border:1px solid ${BORDER};background:#fff;border-radius:999px;padding:5px 12px;font:500 13px ${FONT};color:#3A3A3C;cursor:pointer;white-space:nowrap}
.ev-chip[aria-pressed=true]{background:${TEXT};border-color:${TEXT};color:#fff}
.ev-seg{display:flex;gap:2px;padding:3px;border-radius:10px;background:#EEF0F4}
.ev-seg button{border:0;background:none;height:30px;padding:0 12px;border-radius:8px;font:500 13px ${FONT};color:#3A3A3C;cursor:pointer;white-space:nowrap}
.ev-seg button[aria-pressed=true]{background:#fff;color:${TEXT};font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.ev-board{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;padding:14px}
.ev-col{background:#F5F6F8;border-radius:14px;padding:10px;min-height:120px}
.ev-col h3{margin:2px 4px 10px;font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px}
.ev-col h3 .n{color:${MUTED};font-weight:500}
.ev-tile{display:block;width:100%;text-align:left;background:#fff;border:0;border-radius:12px;padding:12px;box-shadow:0 1px 2px rgba(10,20,40,.08);cursor:pointer;font:inherit;color:inherit;margin-bottom:8px}
.ev-tile:hover{box-shadow:0 0 0 1px rgba(0,113,227,.35),0 4px 14px rgba(10,20,40,.10)}
.ev-tile .ty{font-size:11.5px;color:${MUTED};font-weight:500}
.ev-tile .ti{font-size:14.5px;font-weight:600;margin:2px 0 4px;line-height:1.3}
.ev-tile .mt{font-size:12.5px;color:${MUTED};display:flex;gap:8px;flex-wrap:wrap}
.ev-prog{height:4px;border-radius:2px;background:#E8EBF0;overflow:hidden;margin-top:8px}
.ev-prog i{display:block;height:100%;background:${BRAND};border-radius:2px}
.ev-tag{display:inline-flex;align-items:center;gap:4px;padding:1px 8px;border-radius:999px;font-size:11.5px;font-weight:600;white-space:nowrap}
.ev-tbl{width:100%;border-collapse:collapse;font-size:14px}
.ev-tbl th{text-align:left;font-weight:500;color:${MUTED};font-size:12px;padding:8px 10px;border-bottom:1px solid ${LINE};white-space:nowrap;background:#FAFAFB}
.ev-tbl td{padding:9px 10px;border-bottom:1px solid ${LINE};vertical-align:middle}
.ev-tbl tr.click{cursor:pointer}.ev-tbl tr.click:hover td{background:#F7F9FC}
.ev-empty{padding:36px 18px;text-align:center;color:${MUTED};font-size:14px}
.ev-cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border-top:1px solid ${LINE}}
.ev-cal .dow{font-size:12px;color:${MUTED};padding:8px;text-align:left;border-bottom:1px solid ${LINE}}
.ev-cal .cell{min-height:96px;padding:6px;border-right:1px solid ${LINE};border-bottom:1px solid ${LINE};font-size:12px}
.ev-cal .cell:nth-child(7n){border-right:0}
.ev-cal .cell.out{background:#FAFAFB;color:#AEAEB2}
.ev-cal .cell .d{font-weight:500;margin-bottom:4px}
.ev-cal .cell.today .d{color:#fff;background:${BRAND};border-radius:999px;display:inline-block;padding:0 7px}
.ev-cal .pill{display:block;width:100%;text-align:left;border:0;border-radius:6px;padding:3px 6px;margin-bottom:3px;font:500 12px ${FONT};color:${TEXT};background:#FFF1E8;border-left:3px solid #eb6834;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ev-mod{position:fixed;inset:0;z-index:140;background:rgba(10,15,25,.45);display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow-y:auto;font-family:${FONT};color:${TEXT}}
.ev-mod .box{width:100%;max-width:820px;background:#fff;border-radius:18px;box-shadow:0 30px 70px rgba(0,0,0,.3);overflow:hidden}
.ev-mod .box.sm{max-width:560px}
.ev-mod .mh{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:16px 20px;border-bottom:1px solid ${LINE}}
.ev-mod .mh h2{margin:0;font-size:18px;font-weight:600}
.ev-mod .mb{padding:18px 20px}
.ev-mod .mf{display:flex;justify-content:flex-end;gap:8px;padding:14px 20px;border-top:1px solid ${LINE};background:#FAFAFB;flex-wrap:wrap}
.ev-x{border:0;background:#F2F2F7;width:30px;height:30px;border-radius:999px;cursor:pointer;font-size:16px;color:#3A3A3C;flex:none}
.ev-plans{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
.ev-plan{display:flex;flex-direction:column;justify-content:flex-start;text-align:left;border:1px solid ${BORDER};background:#fff;border-radius:14px;padding:12px 14px;cursor:pointer;font:inherit;color:inherit}
.ev-plan[aria-pressed=true]{border-color:${BRAND};box-shadow:0 0 0 2px rgba(0,113,227,.25)}
.ev-plan .n{font-weight:600;font-size:14.5px}
.ev-plan .d{font-size:12.5px;color:${MUTED};margin-top:3px;line-height:1.4}
.ev-plan .c{font-size:12px;color:${MUTED};margin-top:8px}
.ev-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.ev-form .full{grid-column:1/-1}
.ev-lbl{display:block;font-size:12.5px;font-weight:500;color:#3A3A3C;margin-bottom:5px}
.ev-lbl+.ev-in,.ev-lbl+select.ev-in{width:100%}
.ev-note{font-size:12.5px;color:${MUTED}}
.ev-msg{padding:10px 14px;border-radius:10px;background:#EEF4FF;color:#0B4FA0;font-size:13.5px;margin-bottom:12px}
.ev-msg.err{background:#FFF0F0;color:${RED}}
@media (max-width:1000px){.ev-board{grid-template-columns:repeat(2,minmax(0,1fr))}.ev-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:640px){.ev-board{grid-template-columns:minmax(0,1fr)}.ev-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.ev-form{grid-template-columns:minmax(0,1fr)}.ev-hd h1{font-size:26px}.hide-sm{display:none}.ev-cal .cell{min-height:64px;padding:3px}.ev-cal .pill{font-size:10.5px;padding:2px 3px}.ev-mod{padding:0}.ev-mod .box{border-radius:0;min-height:100%}}
`
