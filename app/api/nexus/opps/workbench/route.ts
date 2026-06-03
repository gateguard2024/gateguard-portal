import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function clean(value: string | null): string {
  return (value ?? '').trim()
}

function escapeLike(value: string): string {
  return value.replace(/[%_]/g, match => `\\${match}`)
}

async function safe<T>(promise: PromiseLike<{ data: T | null; error: unknown }>, fallback: T): Promise<T> {
  try {
    const { data, error } = await promise
    if (error || !data) return fallback
    return data
  } catch {
    return fallback
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = clean(searchParams.get('q'))
  const leadId = clean(searchParams.get('leadId'))

  if (leadId) {
    const lead = await safe(
      supabase
        .from('crm_leads')
        .select('id, name, company, stage, source, notes, created_at')
        .eq('id', leadId)
        .single(),
      null
    )

    const activities = await safe(
      supabase
        .from('crm_activities')
        .select('id, type, subject, body, due_at, completed_at, created_at')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(12),
      []
    )

    const company = typeof lead === 'object' && lead && 'company' in lead ? String(lead.company ?? '') : ''
    const opportunities = company
      ? await safe(
          supabase
            .from('crm_opportunities')
            .select('id, name, account_name, stage, value, notes, created_at')
            .ilike('account_name', `%${escapeLike(company)}%`)
            .order('created_at', { ascending: false })
            .limit(8),
          []
        )
      : []

    return NextResponse.json({
      success: true,
      lead,
      activities,
      opportunities,
      nextBestActions: [
        { title: 'Log Call', subtitle: 'Capture what happened on the call.', action: 'log_call' },
        { title: 'Schedule Follow-Up', subtitle: 'Create the next touch so it does not stall.', action: 'schedule_followup' },
        { title: 'Create Opportunity', subtitle: 'Turn this lead into a real deal.', action: 'convert_lead' },
        { title: 'Run ARIA', subtitle: 'Research the property before outreach.', action: 'run_aria' },
      ],
    })
  }

  if (q) {
    const term = escapeLike(q)
    const leads = await safe(
      supabase
        .from('crm_leads')
        .select('id, name, company, stage, source, notes, created_at')
        .or(`name.ilike.%${term}%,company.ilike.%${term}%,notes.ilike.%${term}%`)
        .order('created_at', { ascending: false })
        .limit(10),
      []
    )

    const opportunities = await safe(
      supabase
        .from('crm_opportunities')
        .select('id, name, account_name, stage, value, notes, created_at')
        .or(`name.ilike.%${term}%,account_name.ilike.%${term}%,notes.ilike.%${term}%`)
        .order('created_at', { ascending: false })
        .limit(10),
      []
    )

    return NextResponse.json({ success: true, q, leads, opportunities })
  }

  const openLeads = await safe(
    supabase
      .from('crm_leads')
      .select('id, name, company, stage, source, notes, created_at')
      .not('stage', 'in', '(converted,dead,lost,closed_lost,won)')
      .order('created_at', { ascending: false })
      .limit(20),
    []
  )

  const needsAttention = await safe(
    supabase
      .from('crm_leads')
      .select('id, name, company, stage, source, notes, created_at')
      .not('stage', 'in', '(converted,dead,lost,closed_lost,won)')
      .order('created_at', { ascending: true })
      .limit(10),
    []
  )

  const openOpportunities = await safe(
    supabase
      .from('crm_opportunities')
      .select('id, name, account_name, stage, value, notes, created_at')
      .not('stage', 'in', '(won,lost,dead,closed_lost)')
      .order('created_at', { ascending: false })
      .limit(20),
    []
  )

  const proposalFollowUps = await safe(
    supabase
      .from('crm_opportunities')
      .select('id, name, account_name, stage, value, notes, created_at')
      .or('stage.ilike.%proposal%,stage.ilike.%propose%,stage.ilike.%negotiat%')
      .order('created_at', { ascending: true })
      .limit(10),
    []
  )

  return NextResponse.json({
    success: true,
    stats: {
      openLeads: openLeads.length,
      needsAttention: needsAttention.length,
      openOpportunities: openOpportunities.length,
      proposalFollowUps: proposalFollowUps.length,
    },
    openLeads,
    needsAttention,
    openOpportunities,
    proposalFollowUps,
  })
}
