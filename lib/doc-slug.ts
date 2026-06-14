/**
 * lib/doc-slug.ts
 *
 * Public document slug + secure token generation for the Nexus Document Portal.
 *
 * Public slug is for READABILITY only (e.g. acme-gate-services-100626-00481293).
 * The token (64-char) remains the true credential — never rely on the slug or
 * the 8-digit number alone for access control.
 *
 * Public links are served at nexus.gateguard.co/document/[slug].
 */
import { randomBytes } from 'crypto'

export const PUBLIC_DOC_BASE = (process.env.NEXT_PUBLIC_NEXUS_URL ?? 'https://nexus.gateguard.co').replace(/\/$/, '')

/** Full public URL for a document slug. */
export function publicDocUrl(slug: string): string {
  return `${PUBLIC_DOC_BASE}/document/${slug}`
}

/** Cryptographically secure 64-char hex token — the real access credential. */
export function generateSecureToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Readable public slug: normalized-company-ddmmyy-00000000
 * The trailing 8-digit number is rolling/random for readability, NOT security.
 */
export function generatePublicSlug(companyOrOrg: string | null | undefined, when: Date = new Date()): string {
  const base =
    (companyOrOrg ?? 'document')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'document'

  const dd = String(when.getDate()).padStart(2, '0')
  const mm = String(when.getMonth() + 1).padStart(2, '0')
  const yy = String(when.getFullYear()).slice(2)
  const rolling = String(Math.floor(Math.random() * 100_000_000)).padStart(8, '0')

  return `${base}-${dd}${mm}${yy}-${rolling}`
}
