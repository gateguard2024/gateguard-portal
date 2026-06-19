/**
 * PATCH  /api/playbooks/[id]   update a playbook (own-org or corporate)
 * DELETE /api/playbooks/[id]   soft-delete (is_active=false)
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth }           from '@clerk/nextjs/server'
import { createClient }   from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

function serviceDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
export const dynamic = 'force-dynamic'

async function canEdit(id: string) {
  const user = await getCurrentUser()
  const { data } = await serviceDb().from('playbooks').select('org_id').eq('id', id).single()
  if (!data) return { ok: false as const }
  // corporate edits anything; others only their own org's playbooks (not global)
  if (user.isCorporate) return { ok: true as const }
  return { ok: !!data.org_id && data.org_id === user.org_id }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perm = await canEdit(params.id)
  if (!perm.ok) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.title === 'string') patch.title = body.title.trim()
  if ('category' in body) patch.category = body.category
  if ('description' in body) patch.description = body.description
  if (Array.isArray(body.steps)) patch.steps = body.steps.map((s: unknown) => typeof s === 'string' ? s.trim() : String((s as { title?: string })?.title ?? '').trim()).filter(Boolean)

  const { data, error } = await serviceDb().from('playbooks').update(patch).eq('id', params.id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ playbook: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perm = await canEdit(params.id)
  if (!perm.ok) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })

  const { error } = await serviceDb().from('playbooks').update({ is_active: false }).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
