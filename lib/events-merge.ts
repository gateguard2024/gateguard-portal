/**
 * Event email merge fields — shared by the send route and the page preview.
 * {{first_name}} {{name}} {{company}} {{property}} {{event_title}} {{event_date}}
 * {{event_time}} {{venue}} {{venue_address}} {{booth}} {{host_name}}
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

export const MERGE_FIELDS = ['first_name', 'company', 'property', 'event_date', 'event_time', 'venue', 'booth', 'host_name', 'rsvp_link'] as const

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
export function niceDate(d?: string | null) {
  if (!d) return 'TBD'
  const x = new Date(`${d}T12:00:00`)
  return isNaN(x.getTime()) ? d : x.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}
export function niceTime(t?: string | null) {
  if (!t) return ''
  const m = /^(\d{1,2}):(\d{2})/.exec(t); if (!m) return t
  const h = +m[1]; return `${((h + 11) % 12) + 1}:${m[2]} ${h >= 12 ? 'PM' : 'AM'}`
}
/** Fill {{merge_fields}}; values are HTML-escaped when html=true (bodies), raw for subjects. Unknown fields go blank. */
export function fillMerge(tpl: string, evt: Row, guest: Row | null, hostName: string, html = true, extra: Record<string, string> = {}) {
  const vars: Record<string, string> = {
    first_name: guest?.name ? String(guest.name).split(/\s+/)[0] : 'there',
    name: guest?.name ?? '', company: guest?.company ?? '',
    property: evt.property_name || evt.title || '', event_title: evt.title ?? '',
    event_date: niceDate(evt.event_date), event_time: niceTime(evt.start_time),
    venue: evt.venue || evt.property_name || '', venue_address: evt.venue_address ?? '',
    booth: evt.booth_number || 'TBD', host_name: hostName,
    // A reply-to-RSVP link (mailto the host) — set by the sender; blank in previews.
    rsvp_link: '',
    ...extra,
  }
  return tpl.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_m, k: string) => html ? esc(vars[k] ?? '') : (vars[k] ?? ''))
}


// ── HTML cleaning ────────────────────────────────────────────────────────────
const ALLOWED = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'blockquote'])
const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
/** Keep simple formatting and safe links; drop scripts, styles, event handlers and everything else. */
export function sanitizeEmailHtml(html: string | null | undefined): string {
  let s = String(html ?? '')
  s = s.replace(/<(script|style|iframe|object|embed|svg|math|template)[\s\S]*?<\/\1\s*>/gi, '')
  s = s.replace(/<!--[\s\S]*?-->/g, '')
  // Swap allowed tags for placeholders, escape every other < and >, then put the tags back —
  // so a broken or unclosed tag in the text can never turn into markup.
  const kept: string[] = []
  s = s.replace(/<\s*(\/?)\s*([a-zA-Z0-9]+)([^<>]*)>/g, (_m, close: string, tag: string, attrs: string) => {
    const t = tag.toLowerCase()
    let out = ''
    if (ALLOWED.has(t)) {
      if (close) out = t === 'br' ? '' : `</${t}>`
      else if (t === 'a') {
        const m = /href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs)
        const href = (m?.[2] ?? m?.[3] ?? m?.[4] ?? '').trim()
        out = /^(https?:\/\/|mailto:|\{\{\s*rsvp_link\s*\}\})/i.test(href) ? `<a href="${escAttr(href)}">` : '<a>'
      } else out = t === 'br' ? '<br>' : `<${t}>`
    }
    kept.push(out)
    return `\u0000${kept.length - 1}\u0000`
  })
  s = s.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return s.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => kept[Number(i)] ?? '')
}

