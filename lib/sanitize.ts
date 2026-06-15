// lib/sanitize.ts
// Make a user-supplied search term safe to interpolate into a PostgREST
// `.or("col.ilike.%TERM%,...")` filter. PostgREST splits these on commas and
// groups with parentheses, so a comma/paren in the term could alter the filter.
// We strip the characters that have meaning in that mini-grammar plus ilike
// wildcards, leaving a plain substring to match.
export function sanitizeSearch(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw.replace(/[,()%*\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
}
