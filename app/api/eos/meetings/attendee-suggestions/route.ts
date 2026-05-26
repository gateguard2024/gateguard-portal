import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveEosOrgId } from '@/lib/eos-org'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface AttendeeSuggestion {
  id: string
  name: string
  email: string
  source: 'technician' | 'organization' | 'custom'
  role?: string
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    const orgId = await resolveEosOrgId(user)

    const results: AttendeeSuggestion[] = []

    // Fetch technicians (org-scoped)
    const { data: techs } = await supabase
      .from('technicians')
      .select('id, name, email, role')
      .eq('org_id', orgId)
      .not('email', 'is', null)
      .limit(50)

    if (techs) {
      for (const t of techs) {
        if (t.email) {
          results.push({
            id: t.id,
            name: t.name ?? 'Unknown',
            email: t.email,
            source: 'technician',
            role: t.role ?? undefined,
          })
        }
      }
    }

    // Fetch organizations (org-scoped by parent or self)
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name, primary_email, org_tier')
      .not('primary_email', 'is', null)
      .limit(50)

    if (orgs) {
      for (const o of orgs) {
        if (o.primary_email) {
          results.push({
            id: o.id,
            name: o.name ?? 'Unknown Org',
            email: o.primary_email,
            source: 'organization',
            role: o.org_tier ?? undefined,
          })
        }
      }
    }

    // Dedupe by email, sort by name, cap at 50
    const seen = new Set<string>()
    const deduped: AttendeeSuggestion[] = []
    for (const r of results) {
      const key = r.email.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        deduped.push(r)
      }
    }

    deduped.sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json(deduped.slice(0, 50))
  } catch (err) {
    console.error('[/api/eos/meetings/attendee-suggestions]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
