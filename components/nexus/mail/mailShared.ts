// Shared bits for Nexus Mail: types, look, small helpers, API calls.

export type Folder = 'all_inbox' | 'inbox' | 'other' | 'needs_reply' | 'awaiting' | 'unread' | 'starred' | 'snoozed' | 'phone' | 'sent' | 'linked' | 'archived' | 'trash' | 'all'

export type Person = { name?: string | null; address?: string | null }

export type ThreadRow = {
  id: string
  channel: 'email' | 'text' | 'call'
  contact_name: string
  contact_address: string | null
  participants: Person[]
  subject: string
  preview: string
  last_at: string
  last_from_me: boolean
  unread: boolean
  unread_count: number
  needs_reply: boolean
  starred: boolean
  archived: boolean
  trashed: boolean
  bulk: boolean
  has_attachments: boolean
  message_count: number | null
  snoozed_until: string | null
  channel_id: string | null
  linked_type: string | null
  linked_id: string | null
  linked_label: string | null
}

export type MailAttachment = { name: string; mime_type: string; size: number; url: string | null; view_url: string | null }
export type MailMessage = {
  id: string
  direction: 'in' | 'out'
  channel: 'email' | 'text' | 'call'
  from_name: string | null
  from_address: string | null
  to: Person[]
  cc: Person[]
  subject: string
  body: string
  body_html: string
  snippet: string | null
  at: string
  unread: boolean
  failed: boolean
  error: string | null
  bulk: boolean
  attachments: MailAttachment[]
}
export type ThreadDetail = {
  thread: {
    id: string; subject: string; participants: Person[]; channel_id: string | null
    starred: boolean; archived: boolean; trashed: boolean; snoozed_until: string | null
    linked_type: string | null; linked_id: string | null; linked_label: string | null
  }
  messages: MailMessage[]
}
export type Counts = { all_inbox: number; inbox: number; other: number; needs_reply: number; awaiting?: number; snoozed: number; unread: number }
export type Account = { id: string; email: string; last_synced_at: string | null; last_error: string | null; can_modify: boolean; live: boolean; gmail_inbox_unread?: number | null; checked_at?: string | null; provider?: 'gmail' | 'ringcentral'; sms_from?: string | null }

// ── Look (Apple-grade: graphite on white, one blue, hairlines) ──────────────────
export const M = {
  ink: '#1D1D1F',
  ink2: '#3A3A3C',
  ink3: '#6E6E73',
  ink4: '#A1A1A6',
  line: 'rgba(0,0,0,0.08)',
  lineStrong: 'rgba(0,0,0,0.14)',
  side: '#F5F5F7',
  hover: 'rgba(0,0,0,0.035)',
  sel: 'rgba(0,113,227,0.09)',
  blue: '#0071E3',
  blueSoft: 'rgba(0,113,227,0.10)',
  red: '#D70015',
  green: '#248A3D',
  orange: '#C93400',
  star: '#F5A623',
  flag: '#FF9500',
  font: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif',
}

// Nexus chrome (the navy frame the rest of Nexus uses) + the brand gradient.
export const N = {
  bg: 'radial-gradient(900px 600px at 0% -10%, rgba(30,150,230,0.18), transparent 60%),' +
      'radial-gradient(900px 700px at 100% 120%, rgba(107,126,255,0.16), transparent 55%),' +
      'linear-gradient(180deg, #141d2e 0%, #0e1521 55%, #0b111b 100%)',
  ink: '#eaf2fb',
  ink2: '#c3d3e2',
  label: '#5FB8E0',
  line: 'rgba(140,170,200,0.16)',
  hover: 'rgba(255,255,255,0.06)',
  sel: 'linear-gradient(90deg, rgba(74,140,255,0.30), rgba(74,140,255,0.10))',
  pill: 'rgba(255,255,255,0.10)',
  brand: 'linear-gradient(135deg,#19C8F5 0%,#4A8CFF 52%,#8A5CFF 100%)',
  accent: '#4A8CFF',
  canvas: '#EDF1F7',
  card: '#FFFFFF',
  cardLine: 'rgba(15,23,42,0.08)',
  cardShadow: '0 1px 2px rgba(15,23,42,0.05), 0 2px 10px -4px rgba(15,23,42,0.10)',
}
// Each folder gets its own color so the list reads at a glance.
export const FOLDER_COLOR: Record<string, string> = {
  all_inbox: '#4A8CFF', inbox: '#A78BFA', other: '#94A3B8', needs_reply: '#F5A524', awaiting: '#14B8A6',
  unread: '#38BDF8', starred: '#FF9500', snoozed: '#C084FC', phone: '#34D399',
  sent: '#22D3EE', linked: '#818CF8', archived: '#8FA3B8', trash: '#F87171', all: '#4A8CFF',
}

export const FOLDERS: { id: Folder; label: string; hint: string }[] = [
  { id: 'all_inbox', label: 'Inbox', hint: 'Everything in your Gmail inbox' },
  { id: 'inbox', label: 'Priority', hint: 'Just people and customers' },
  { id: 'other', label: 'Other', hint: 'Newsletters, receipts, notifications' },
  { id: 'needs_reply', label: 'Waiting on you', hint: 'They wrote last — you owe a reply' },
  { id: 'awaiting', label: 'Waiting on them', hint: 'You wrote last — no answer yet' },
  { id: 'unread', label: 'Unread', hint: '' },
  { id: 'starred', label: 'Flagged', hint: 'Flagged in Nexus = starred in Gmail' },
  { id: 'snoozed', label: 'Snoozed', hint: 'Comes back later' },
  { id: 'phone', label: 'Texts & calls', hint: 'Your RingCentral number' },
  { id: 'sent', label: 'Sent', hint: '' },
  { id: 'linked', label: 'Linked to records', hint: 'Deals, customers, jobs' },
  { id: 'archived', label: 'Archived', hint: '' },
  { id: 'trash', label: 'Trash', hint: '' },
]

export const RECORD_BADGE: Record<string, { label: string; color: string }> = {
  lead: { label: 'Lead', color: '#B25000' },
  customer: { label: 'Customer', color: '#248A3D' },
  opportunity: { label: 'Deal', color: '#5E5CE6' },
  contact: { label: 'Contact', color: '#0071E3' },
  job: { label: 'Job', color: '#0E7C86' },
  dealer: { label: 'Dealer', color: '#0071E3' },
}

// ── helpers ────────────────────────────────────────────────────────────────────
export const initials = (name: string) =>
  (name || '').replace(/<.*>/, '').split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?'
const TINTS = ['#0071E3', '#248A3D', '#C93400', '#5E5CE6', '#0E7C86', '#AF52DE', '#B25000', '#3A3A3C']
export const tintFor = (s: string) => TINTS[[...(s || '?')].reduce((a, c) => a + c.charCodeAt(0), 0) % TINTS.length]

export function listTime(iso: string): string {
  const d = new Date(iso), n = new Date()
  if (d.toDateString() === n.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const y = new Date(n); y.setDate(n.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return 'Yesterday'
  if (n.getTime() - d.getTime() < 6 * 86400_000) return d.toLocaleDateString([], { weekday: 'short' })
  if (d.getFullYear() === n.getFullYear()) return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  return d.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: '2-digit' })
}
export function fullTime(iso: string): string {
  return new Date(iso).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
export function ago(iso: string | null): string {
  if (!iso) return 'not yet'
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000))
  if (s < 50) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return `${Math.round(s / 86400)} d ago`
}
export const fileSize = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`)
export const personLabel = (p: Person) => (p.name ? `${p.name} <${p.address}>` : p.address ?? '')
export const firstName = (s: string) => (s || '').replace(/<.*>/, '').trim().split(/\s+/)[0] ?? ''

// Snooze choices (Eastern time is the user's clock; the browser's local time is used).
export function snoozeOptions(): { label: string; at: Date }[] {
  const now = new Date()
  const at = (d: Date, h: number) => { const x = new Date(d); x.setHours(h, 0, 0, 0); return x }
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
  const opts: { label: string; at: Date }[] = []
  const laterToday = new Date(now.getTime() + 3 * 3600_000)
  if (laterToday.getDate() === now.getDate() && laterToday.getHours() < 21) opts.push({ label: `Later today · ${laterToday.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`, at: laterToday })
  opts.push({ label: 'Tomorrow · 8:00 AM', at: at(tomorrow, 8) })
  const mon = new Date(now); mon.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7))
  if (now.getDay() >= 1 && now.getDay() <= 4) { const sat = new Date(now); sat.setDate(now.getDate() + (6 - now.getDay())); opts.push({ label: 'This weekend · Sat 9:00 AM', at: at(sat, 9) }) }
  opts.push({ label: `Next week · ${mon.toLocaleDateString([], { weekday: 'short' })} 8:00 AM`, at: at(mon, 8) })
  const nm = new Date(now); nm.setDate(now.getDate() + 30)
  opts.push({ label: 'In a month', at: at(nm, 8) })
  return opts
}

// Email HTML goes in a sandboxed frame (no scripts, links open in a new tab), so a
// message can't run code or restyle Nexus. Text-only emails get a readable layout.
export function emailDoc(html: string, text: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const linkify = (s: string) => esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')
  const cleanText = (s: string) => s
    .replace(/\[https?:\/\/[^\]]+\]/g, '')
    .replace(/<https?:\/\/[^>]+>/g, '')
    .replace(/[​-‍﻿­]/g, '')
    .replace(/\n{3,}/g, '\n\n').trim()
  const body = html && html.trim()
    ? html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '')
    : `<div class="gg-text">${linkify(cleanText(text || ''))}</div>`
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
html,body{margin:0;padding:0;background:#fff;color:#1D1D1F;font:14.5px/1.55 -apple-system,BlinkMacSystemFont,"SF Pro Text",Inter,system-ui,sans-serif;overflow-wrap:anywhere}
body{padding:2px 2px 8px}
img{max-width:100%!important;height:auto!important}
table{max-width:100%!important}
a{color:#0071E3}
blockquote,.gmail_quote{margin:8px 0 0;padding-left:12px;border-left:2px solid rgba(0,0,0,.12);color:#6E6E73}
.gg-text{white-space:pre-wrap}
pre{white-space:pre-wrap}
</style></head><body>${body}</body></html>`
}

// Hide the quoted history at the bottom of a reply ("On … wrote:"), like Apple Mail.
export function splitQuoted(html: string): { main: string; quoted: string } {
  if (!html) return { main: '', quoted: '' }
  const markers = [/<div class="gmail_quote[\s\S]*$/i, /<blockquote[^>]*type="cite"[\s\S]*$/i, /<div id="appendonsend"[\s\S]*$/i, /<div[^>]*class="?OutlookMessageHeader[\s\S]*$/i, /<hr[^>]*id="?stopSpelling[\s\S]*$/i]
  for (const m of markers) {
    const hit = html.match(m)
    if (hit && hit.index && hit.index > 40) return { main: html.slice(0, hit.index), quoted: hit[0] }
  }
  return { main: html, quoted: '' }
}
export function splitQuotedText(text: string): { main: string; quoted: string } {
  const lines = (text || '').split('\n')
  const i = lines.findIndex((l, k) => k > 1 && (/^On .{6,140}wrote:\s*$/.test(l.trim()) || /^-{2,}\s*Original Message/i.test(l.trim()) || /^From: .+/.test(l.trim())))
  if (i > 0) return { main: lines.slice(0, i).join('\n').trimEnd(), quoted: lines.slice(i).join('\n') }
  return { main: text, quoted: '' }
}

// ── API ────────────────────────────────────────────────────────────────────────
export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      ...init,
      headers: init?.json !== undefined ? { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } : init?.headers,
      body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    })
    const data = (await res.json().catch(() => ({}))) as T & { error?: string }
    return { ok: res.ok, status: res.status, data }
  } catch (e) {
    return { ok: false, status: 0, data: { error: e instanceof Error ? e.message : 'Network error' } as T & { error?: string } }
  }
}

export function fileToBase64(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(f)
  })
}
