/**
 * PATCH  /api/permits/[id]   — update permit fields
 * DELETE /api/permits/[id]   — soft delete (is_active = false)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const caller = await getCurrentUser()
  const allowed = caller.isCorporate ||
    caller.org_tier === 'master_dealer' ||
    caller.org_tier === 'full_dealer'

  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()

  // Allowlist updatable fields
  const updatable = [
    'type', 'label', 'permit_number', 'issued_by',
    'issue_date', 'expiry_date', 'document_url', 'notes', 'site_id',
  ]
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of updatable) {
    if (key in body) updates[key] = body[key]
  }

  const { data, error } = await supabase
    .from('permits')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ permit: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const caller = await getCurrentUser()
  const allowed = caller.isCorporate ||
    caller.org_tier === 'master_dealer' ||
    caller.org_tier === 'full_dealer'

  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase
    .from('permits')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
