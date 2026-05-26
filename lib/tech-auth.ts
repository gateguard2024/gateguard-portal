/**
 * tech-auth.ts
 * Validates the x-tech-code header used by /tech field tool API routes.
 *
 * Priority order:
 *  1. Per-tech code  → technicians.tech_code  → returns techId + orgId + techName
 *  2. Per-org code   → organizations.tech_code → returns orgId
 *  3. Global env var → TECH_ACCESS_CODE        → returns valid:true (backward compat)
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface TechAuthResult {
  valid: boolean
  /** Set when code matches a specific technician */
  techId?: string
  techName?: string
  /** Set when code matches a technician or organization */
  orgId?: string
  /** "tech" | "org" | "global" — which level matched */
  level?: 'tech' | 'org' | 'global'
}

export async function validateTechCode(code: string | null): Promise<TechAuthResult> {
  if (!code) return { valid: false }

  // 1. Check per-tech code
  const { data: tech } = await supabase
    .from('technicians')
    .select('id, name, org_id')
    .eq('tech_code', code)
    .maybeSingle()

  if (tech) {
    return {
      valid: true,
      techId: tech.id,
      techName: tech.name,
      orgId: tech.org_id ?? undefined,
      level: 'tech',
    }
  }

  // 2. Check per-org code
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('tech_code', code)
    .maybeSingle()

  if (org) {
    return {
      valid: true,
      orgId: org.id,
      level: 'org',
    }
  }

  // 3. Fall back to global env var (backward compatibility)
  const globalCode = process.env.TECH_ACCESS_CODE
  if (globalCode && code === globalCode) {
    return { valid: true, level: 'global' }
  }

  return { valid: false }
}

/**
 * Generates a unique 8-character tech code.
 * Uses the same character set as the SQL generate_tech_code() function:
 * A-Z 0-9 excluding O, 0, I, 1, L (to avoid visual ambiguity).
 */
export function generateTechCodeLocal(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}
