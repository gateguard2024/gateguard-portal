/**
 * Event email merge fields — shared by the send route and the page preview.
 * {{first_name}} {{name}} {{company}} {{property}} {{event_title}} {{event_date}}
 * {{event_time}} {{venue}} {{venue_address}} {{booth}} {{host_name}}
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

export const MERGE_FIELDS = ['first_name', 'company', 'property', 'event_date', 'event_time', 'venue', 'booth', 'host_name'] as const

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
export function fillMerge(tpl: string, evt: Row, guest: Row | null, hostName: string, html = true) {
  const vars: Record<string, string> = {
    first_name: guest?.name ? String(guest.name).split(/\s+/)[0] : 'there',
    name: guest?.name ?? '', company: guest?.company ?? '',
    property: evt.property_name || evt.title || '', event_title: evt.title ?? '',
    event_date: niceDate(evt.event_date), event_time: niceTime(evt.start_time),
    venue: evt.venue || evt.property_name || '', venue_address: evt.venue_address ?? '',
    booth: evt.booth_number || 'TBD', host_name: hostName,
    rsvp_link: '#',
  }
  return tpl.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_m, k: string) => html ? esc(vars[k] ?? '') : (vars[k] ?? ''))
}

