/**
 * lib/eos-org.ts
 *
 * Resolves the effective org_id for all EOS data operations.
 *
 * Corporate users (rfeldman@gateguard.co and any future corporate admins)
 * may not have `org_id` set in their Clerk publicMetadata because they were
 * onboarded before the org-id system existed.  When `user.org_id` is null,
 * we look up the corporate org from Supabase so EOS inserts don't fail the
 * FK constraint on `eos_rocks.org_id → organizations.id`.
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function resolveEosOrgId(
  user: { org_id: string | null }
): Promise<string> {
  if (user.org_id) return user.org_id

  // Look up the corporate org — this handles users whose Clerk metadata
  // predates the org_id requirement (i.e. the GateGuard admin account).
  const { data } = await supabase
    .from('organizations')
    .select('id')
    .eq('org_tier', 'corporate')
    .maybeSingle()

  // Final fallback: use the well-known GateGuard corporate seed UUID.
  // If organizations table is empty or not yet seeded, the fallback UUID
  // is used — in that case run `supabase/migrations/010_eos_tables.sql` and
  // ensure a corporate org row exists.
  return data?.id ?? '00000000-0000-0000-0000-000000000001'
}
