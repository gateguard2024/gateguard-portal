import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// GET /api/playbooks — list runs
export async function GET(req: NextRequest) {
  try {
    const user  = await getCurrentUser()
    const scope = await resolveOrgScope(user)
    const { searchParams } = new URL(req.url)
    const type   = searchParams.get('type')   // 'site_job' | 'dev_rd'
    const status = searchParams.get('status')
    const phase  = searchParams.get('phase')

    let query = supabase
      .from('playbook_runs')
      .select('*')
      .order('created_at', { ascending: false })

    query = applyOrgScope(query, scope, 'org_id')
    if (type)   query = query.eq('type', type)
    if (status) query = query.eq('status', status)
    if (phase)  query = query.eq('phase', phase)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ runs: data ?? [] })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ runs: [], error: msg }, { status: 500 })
  }
}

// POST /api/playbooks — create a new run
export async function POST(req: NextRequest) {
  try {
    const user  = await getCurrentUser()
    const scope = await resolveOrgScope(user)
    const body  = await req.json()

    const {
      template_id, type, name, site_id,
      project_name, project_repo, phase,
      assignee, due_date, notes,
    } = body

    if (!type || !name) {
      return NextResponse.json({ error: 'type and name are required' }, { status: 400 })
    }

    // If a template was selected, pull its steps to seed step_progress keys
    let step_progress: Record<string, { done: boolean }> = {}
    if (template_id) {
      const { data: tmpl } = await supabase
        .from('playbook_templates')
        .select('steps')
        .eq('id', template_id)
        .single()
      if (tmpl?.steps && Array.isArray(tmpl.steps)) {
        for (const step of tmpl.steps as Array<{ id: string }>) {
          step_progress[step.id] = { done: false }
        }
      }
    }

    const org_id = scope.own_id ?? '00000000-0000-0000-0000-000000000001'

    const { data, error } = await supabase
      .from('playbook_runs')
      .insert({
        org_id,
        template_id: template_id ?? null,
        type,
        name,
        site_id:      site_id      ?? null,
        project_name: project_name ?? null,
        project_repo: project_repo ?? null,
        phase:        phase        ?? null,
        status:       'active',
        assignee:     assignee     ?? null,
        due_date:     due_date     ?? null,
        notes:        notes        ?? null,
        step_progress,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ run: data }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
