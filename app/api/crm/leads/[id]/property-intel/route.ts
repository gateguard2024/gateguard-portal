/**
 * PATCH /api/crm/leads/[id]/property-intel
 * Update property_intel on a lead — rep corrections/verifications during sales cycle.
 * Merges with existing intel rather than replacing it.
 * Sets property_intel_source to 'rep_verified' and updates timestamp.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const updates = await req.json()

  // Tolerant strip of any legacy show_ prefix — leads use plain UUIDs now
  const uuid = params.id.replace(/^show_/, '')

  // Fetch existing intel
  const { data: lead } = await supabase
    .from('leads')
    .select('property_intel')
    .eq('id', uuid)
    .single()

  const merged = { ...(lead?.property_intel ?? {}), ...updates, updated_by: userId, updated_at: new Date().toISOString() }

  const { error } = await supabase
    .from('leads')
    .update({
      property_intel: merged,
      property_intel_updated_at: new Date().toISOString(),
      property_intel_source: 'rep_verified',
    })
    .eq('id', uuid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, property_intel: merged })
}
