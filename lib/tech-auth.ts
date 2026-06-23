/**
 * lib/tech-auth.ts
 *
 * Shared helper for authenticating /tech field tool requests.
 * Accepts either:
 *   1. The global TECH_ACCESS_CODE env var  (admin / fallback)
 *   2. A per-tech code stored in technicians.tech_code  (per-tech login)
 *
 * Import and use in every /api/kb/* route that guards with x-tech-code.
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest }  from 'next/server'

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Returns true if the x-tech-code header matches either:
 * - The global TECH_ACCESS_CODE env var, OR
 * - A tech_code value in the technicians table.
 */
export async function isTechAuthed(req: NextRequest): Promise<boolean> {
  const code = req.headers.get('x-tech-code')
  if (!code) return false

  // 1. Global env var check (fast, no DB round-trip)
  if (process.env.TECH_ACCESS_CODE && code === process.env.TECH_ACCESS_CODE) return true

  // 2. Per-tech code check
  const { data } = await serviceDb()
    .from('technicians')
    .select('id')
    .eq('tech_code', code)
    .maybeSingle()

  return !!data
}

/**
 * Resolve WHICH technician a code belongs to.
 * - A per-tech code (technicians.tech_code) → that technician { id, name, initials }.
 * - The global TECH_ACCESS_CODE (or unknown) → null (caller must pick an identity).
 * This is what makes a per-tech login open the right person's jobs, instead of
 * trusting a stale identity left in the browser by a previous tech.
 */
export async function resolveTechByCode(
  code: string | null
): Promise<{ id: string; name: string; initials: string | null } | null> {
  if (!code) return null
  if (process.env.TECH_ACCESS_CODE && code === process.env.TECH_ACCESS_CODE) return null
  const { data } = await serviceDb()
    .from('technicians')
    .select('id, name, initials')
    .eq('tech_code', code)
    .maybeSingle()
  return (data as { id: string; name: string; initials: string | null } | null) ?? null
}
