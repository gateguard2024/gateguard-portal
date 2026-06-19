/**
 * GET  /api/playbooks            list global + org playbooks
 * POST /api/playbooks            create a playbook (org-private by default)
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth }            from '@clerk/nextjs/server'
import { createClient }    from '@supabase/supabase-js'
import { getCurrentUser }  from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'

function serviceDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let query = serviceDb().from('playbooks').select('*').eq('is_active', true).order('title')

  // Catalog model: everyone sees global (org_id null); dealers also see own; corporate all.
  const scope = await resolveOrgScope(await getCurrentUser())
  if (!scope.all) {
    const ids = scope.ids.filter(Boolean)
    query = ids.length > 0 ? query.or(`org_id.is.null,org_id.in.(${ids.join(',')})`) : query.is('org_id', null)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ playbooks: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const title = String(body.title ?? '').trim()
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })

  const user = await getCurrentUser()
  // global flag only honoured for corporate; everyone else gets org-private
  const makeGlobal = body.global === true && user.isCorporate
  const org_id = makeGlobal ? null : (user.org_id ?? null)

  // steps: accept array of strings or {title}
  const rawSteps = Array.isArray(body.steps) ? body.steps : []
  const steps = rawSteps
    .map((s: unknown) => typeof s === 'string' ? s.trim() : String((s as { title?: string })?.title ?? '').trim())
    .filter(Boolean)

  const { data, error } = await serviceDb()
    .from('playbooks')
    .insert({ org_id, title, category: body.category ?? null, description: body.description ?? null, steps, created_by: user.id })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ playbook: data }, { status: 201 })
}
