/**
 * Business-day dates. Gate Guard runs on Eastern time, but servers run in UTC —
 * so "today" from new Date().toISOString() flips to tomorrow around 7–8 PM ET.
 * Use these helpers anywhere a route decides what is "today", "late" or "due".
 */
export const TZ = 'America/New_York'

/** Today as YYYY-MM-DD in Eastern time. */
export const todayET = (now = new Date()) => now.toLocaleDateString('en-CA', { timeZone: TZ })

/** Add whole days to a YYYY-MM-DD date (calendar math, no timezone drift). */
export function addDaysISO(ymd: string, days: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10)
}

/** Whole days from a to b (both YYYY-MM-DD). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000)
}

/** Minutes Eastern time is offset from UTC at this instant (e.g. -300 or -240). */
function etOffsetMin(at: Date): number {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(at).filter(x => x.type !== 'literal').map(x => [x.type, Number(x.value)]))
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return Math.round((asUTC - at.getTime()) / 60000)
}

/** The UTC instant of midnight Eastern on a YYYY-MM-DD date. */
export function etMidnight(ymd: string): Date {
  const guess = new Date(`${ymd}T00:00:00Z`)
  const first = new Date(guess.getTime() - etOffsetMin(guess) * 60000)
  // Re-check across a DST change.
  return new Date(guess.getTime() - etOffsetMin(first) * 60000)
}

/** YYYY-MM-DD (Eastern) of an ISO timestamp. */
export const etDateOf = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ })
/** HH:MM (24h, Eastern) of an ISO timestamp. */
export const etTimeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
