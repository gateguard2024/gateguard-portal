/**
 * GET  /api/jobs  — list all jobs for the caller's org
 * POST /api/jobs  — create a new job + seed tracker groups/items
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── Stage templates seeded on job creation ───────────────────────────────────
const JOB_TEMPLATES: Record<string, Array<{ group: string; color: string; tasks: string[] }>> = {
  new_install: [
    {
      group: 'Deposit & Contract', color: '#6B7EFF',
      tasks: ['Collect deposit / down payment', 'Send & execute customer agreement', 'Confirm project scope with client'],
    },
    {
      group: 'Procurement', color: '#0891B2',
      tasks: ['Create purchase order', 'Order equipment from supplier', 'Confirm order receipt & inspection'],
    },
    {
      group: 'Staging & Assembly', color: '#7C3AED',
      tasks: ['Stage and pre-configure equipment', 'Label and kit all components', 'Load & prepare field vehicle'],
    },
    {
      group: 'Installation', color: '#059669',
      tasks: ['Schedule install date with client', 'Complete on-site installation', 'Run cable, mount devices, test all access points'],
    },
    {
      group: 'QC & Handoff', color: '#D97706',
      tasks: ['Conduct QC walkthrough', 'Train client on system operation', 'Obtain client sign-off', 'Upload as-built documentation'],
    },
    {
      group: 'Final Billing', color: '#DC2626',
      tasks: ['Send final invoice', 'Confirm payment received', 'Close job & update CRM'],
    },
  ],
  service: [
    {
      group: 'Assessment', color: '#6B7EFF',
      tasks: ['Confirm SLA terms with client', 'Schedule site assessment', 'Complete site assessment & document findings'],
    },
    {
      group: 'Activation', color: '#059669',
      tasks: ['Activate monitoring schedule', 'Confirm client emergency contacts', 'Set up recurring visit calendar'],
    },
    {
      group: 'Ongoing', color: '#0891B2',
      tasks: ['Monthly system check', 'Preventive maintenance visit', 'Client check-in call'],
    },
  ],
  small_install_to_service: [
    {
      group: 'Install', color: '#6B7EFF',
      tasks: ['Collect payment', 'Order & stage equipment', 'Complete installation', 'Client handoff & sign-off'],
    },
    {
      group: 'Service Transition', color: '#059669',
      tasks: ['Activate service agreement', 'Set up monitoring schedule', 'Send welcome packet to client'],
    },
  ],
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const site_id = url.searchParams.get('site_id')

    let q = supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false })

    if (!user.isCorporate && user.org_id) q = q.eq('org_id', user.org_id)
    if (status) q = q.eq('status', status)
    if (site_id) q = q.eq('site_id', site_id)

    const { data, error } = await q.limit(200)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ jobs: data ?? [] })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const {
      title, job_type = 'new_install', opportunity_id, site_id,
      start_date, target_completion_date, total_value, notes,
      assigned_tech_id, assigned_tech_name, site_name, opportunity_name,
    } = body

    if (!title?.trim()) return NextResponse.json({ error: 'title is required' }, { status: 400 })

    const org_id = user.isCorporate ? (body.org_id ?? user.org_id) : user.org_id

    // 1. Create the job record
    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .insert({
        title:                 title.trim(),
        job_type,
        status:                'active',
        opportunity_id:        opportunity_id ?? null,
        site_id:               site_id        ?? null,
        org_id,
        assigned_tech_id:      assigned_tech_id   ?? null,
        assigned_tech_name:    assigned_tech_name ?? null,
        total_value:           total_value    ?? null,
        start_date:            start_date     ?? null,
        target_completion_date: target_completion_date ?? null,
        notes:                 notes          ?? null,
        site_name:             site_name      ?? null,
        opportunity_name:      opportunity_name ?? null,
        created_by_user_id:    user.id,
      })
      .select()
      .single()

    if (jobErr || !job) {
      return NextResponse.json({ error: jobErr?.message ?? 'Failed to create job' }, { status: 500 })
    }

    // 2. Seed tracker groups + items from template
    const template = JOB_TEMPLATES[job_type] ?? JOB_TEMPLATES.new_install
    let groupPosition = 0

    for (const tmpl of template) {
      const { data: group, error: gErr } = await supabase
        .from('tracker_groups')
        .insert({
          name:        tmpl.group,
          color:       tmpl.color,
          position:    groupPosition++,
          org_id,
          entity_type: 'job',
          entity_id:   job.id,
        })
        .select()
        .single()

      if (gErr || !group) continue

      const items = tmpl.tasks.map((taskTitle, idx) => ({
        group_id:   group.id,
        title:      taskTitle,
        type:       'task' as const,
        status:     'new' as const,
        position:   idx,
        org_id,
        start_date: start_date ?? null,
        due_date:   target_completion_date ?? null,
      }))

      await supabase.from('tracker_items').insert(items)
    }

    return NextResponse.json({ job }, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown' }, { status: 500 })
  }
}
