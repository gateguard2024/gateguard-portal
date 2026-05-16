/**
 * lib/sensitive-fields.ts
 *
 * Controls which fields are returned based on the caller's role and org tier.
 *
 * Sensitive field tiers:
 *   TECH_FIELDS    — gate codes, access notes, parking notes (for on-site techs)
 *                    Visible to: admin, supervisor, agent, dealer
 *                    Also via: x-tech-code header (field techs, no Clerk)
 *
 *   CONTACT_FIELDS — personal phone numbers (not for sales reps or clients)
 *                    Visible to: admin, supervisor, agent, dealer
 *
 *   FINANCIAL      — billing amounts, commission details
 *                    Visible to: admin, supervisor (and the org that owns the data)
 *
 * Usage:
 *   const user = await getCurrentUser()
 *   const site = await fetchSite(id)
 *   return stripSensitiveFields(site, user)
 */

import type { PortalUser } from './current-user'
import { createClient } from '@supabase/supabase-js'

// Fields stripped from LIST endpoints entirely (never sent in bulk)
export const SITE_LIST_STRIP = [
  'gate_code',
  'parking_notes',
  'access_notes',
  'primary_contact_phone',
  'pm_phone',
] as const

// Fields stripped from DETAIL endpoint for insufficient role
export const SITE_SENSITIVE = [
  'gate_code',
  'parking_notes',
  'access_notes',
] as const

export const CONTACT_SENSITIVE = [
  'primary_contact_phone',
  'pm_phone',
] as const

type AnyRecord = Record<string, unknown>

/**
 * Strip sensitive fields from a site record returned to a list endpoint.
 * These fields are NEVER included in paginated lists — only in the detail view.
 */
export function stripForList(record: AnyRecord): AnyRecord {
  const out = { ...record }
  for (const field of SITE_LIST_STRIP) {
    delete out[field]
  }
  return out
}

/**
 * Apply field-level access control to a single site detail record.
 * Returns the record with sensitive fields removed if the caller lacks permission.
 * Also optionally logs access to sensitive fields for audit.
 */
export function applyFieldAccess(
  record: AnyRecord,
  user: PortalUser,
  options?: {
    isTechCode?: boolean       // request came via x-tech-code (field tech, no Clerk)
    logAccess?: boolean        // write to sensitive_field_access_log
    recordId?: string
    tableName?: string
  }
): AnyRecord {
  const out = { ...record }
  const opts = options ?? {}

  // Tech-code requests (field techs) can see site access info but NOT financials
  const isTech = opts.isTechCode === true

  // Gate codes + access notes: techs and dealer-tier users
  const canSeeSiteAccess =
    isTech || user.canViewSensitive

  if (!canSeeSiteAccess) {
    for (const field of SITE_SENSITIVE) {
      out[field] = '••••'  // mask rather than delete so the client knows a value exists
    }
  }

  // Personal phone numbers: dealer tier and above, not sales reps or clients
  const canSeeContacts = user.canViewSensitive
  if (!canSeeContacts) {
    for (const field of CONTACT_SENSITIVE) {
      out[field] = null
    }
  }

  return out
}

/**
 * Log access to sensitive fields for audit trail.
 * Fire-and-forget — does not block the response.
 */
export function logSensitiveAccess({
  user,
  tableName,
  recordId,
  fields,
  ipAddress,
}: {
  user:      PortalUser
  tableName: string
  recordId:  string
  fields:    string[]
  ipAddress?: string
}): void {
  if (!user.org_id && !user.isCorporate) return  // anonymous or broken state — skip

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Non-blocking — we don't await this
  supabase.from('sensitive_field_access_log').insert({
    user_id:    user.id,
    org_id:     user.org_id ?? null,
    table_name: tableName,
    record_id:  recordId,
    fields,
    ip_address: ipAddress ?? null,
  }).then(() => {})
}

/**
 * Strip financial fields from records when the caller can't see financials.
 * Applies to quotes, invoices, commission records.
 */
export const FINANCIAL_FIELDS = [
  'amount', 'subtotal', 'tax', 'total', 'balance_due',
  'mrr', 'arr', 'commission_amount', 'commission_rate',
  'invoice_amount', 'paid_amount',
] as const

export function applyFinancialAccess(record: AnyRecord, user: PortalUser): AnyRecord {
  if (user.canViewFinancials) return record
  const out = { ...record }
  for (const field of FINANCIAL_FIELDS) {
    if (field in out) out[field] = null
  }
  return out
}
