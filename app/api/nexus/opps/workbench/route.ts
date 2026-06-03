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
