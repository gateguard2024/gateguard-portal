/**
 * Nexus steel palette — the single source of truth for text + state colors.
 *
 * The rule (Russel): text is only WHITE, LIGHT, or ICE-BLUE — never muted grey on a
 * grey surface. Green / amber / red are reserved for alarms + status ONLY.
 *
 * New components should import INK / STATE / SURFACE instead of hardcoding hex, so
 * the whole site stays consistent. Existing components are being migrated to these.
 */

// ── Text ("ink") ────────────────────────────────────────────────────────────
export const INK = {
  heading:   '#ffffff',   // names, hero headings ("Hi Russel")
  primary:   '#eaf2fb',   // titles, primary body text
  secondary: '#c3d3e2',   // secondary / supporting text — legible, NOT grey
  label:     '#5FB8E0',   // UPPERCASE section labels + accent
  labelSoft: '#9FD8EC',   // softer label / accent (use this where you'd reach for grey)
} as const

// ── State / alarm colors ────────────────────────────────────────────────────
export const STATE = {
  ok:      '#7ee0a8',   // green  — on track / active / success
  due:     '#fbbf24',   // amber  — due soon / warning
  overdue: '#f87171',   // red    — overdue / alarm / error (unified site-wide)
  info:    '#5FB8E0',   // ice    — neutral status
} as const

// ── Surfaces / borders (already consistent across the steel surfaces) ───────
export const SURFACE = {
  frame:  'linear-gradient(180deg,#1d2a39,#141d28)',
  tile:   'linear-gradient(180deg,#2b3c52,#1e2a3a)',
  well:   'linear-gradient(180deg,#22303f,#1a2532)',
  input:  '#16232f',
  border: 'rgba(140,170,200,0.22)',
} as const

// Helper for "due-state" text/dot color from a due date.
export function dueColor(dueISO?: string | null): string {
  if (!dueISO) return STATE.info
  const due = new Date(dueISO)
  if (isNaN(due.getTime())) return STATE.info
  const now = new Date()
  if (due < now) return STATE.overdue
  const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  return due <= soon ? STATE.due : STATE.info
}
