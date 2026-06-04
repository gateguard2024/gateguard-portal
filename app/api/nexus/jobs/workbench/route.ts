import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const WO_CARD_SELECT = `
  id, wo_number, org_id, site_id, property_id,
  assigned_to, assignee_id, assignee_name,
  title, description, priority, status, job_type, category,
  customer_name, notes, location,
  scheduled_date, due_date, completed_at, created_at, updated_at
`.trim()

async function safe<T>(promise: PromiseLike<{ data: T | null; error: unknown }>, fallback: T): Promise<T> {
  try {
    const { data, error } = await promise
    if (error || !data) return fallback
    return data
  } catch {
    return fallback
  }
}

function clean(value: string | null): string {
  return (value ?? '').trim()
}

function escapeLike(value: string): string {
  return value.replace(/[%_]/g, m => `\\${m}`)
}

async function resolveProfileId(clerkUserId: string): Promise<string | null> {
  if (!clerkUserId || clerkUserId === 'system') return null
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', clerkUserId)
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()

  if (!user.canViewWOs) {
    return NextResponse.json({ success: false, message: 'Work order access denied.' }, { status: 403 })
  }

  const [scope, profileId] = await Promise.all([
    resolveOrgScope(user),
    resolveProfileId(user.id),
  ])

  const { searchParams } = new URL(req.url)
  const q = clean(searchParams.get('q'))

  if (q) {
    const term = escapeLike(q)
    let query = supabase.from('work_orders').select(WO_CARD_SELECT)
    query = applyOrgScope(query, scope)
    const jobs = await safe(
      query
        .or(`title.ilike.%${term}%,wo_number.ilike.%${term}%,customer_name.ilike.%${term}%,description.ilike.%${term}%,location.ilike.%${term}%,assignee_name.ilike.%${term}%,notes.ilike.%${term}%`)
        .order('updated_at', { ascending: false })
        .limit(20),
      []
    )
    return NextResponse.json({ success: true, q, jobs })
  }

  const today = new Date().toISOString().slice(0, 10)

  const myJobsSection = async () => {
    if (!profileId) return []
    let query = supabase.from('work_orders').select(WO_CARD_SELECT)
    query = applyOrgScope(query, scope)
    return safe(
      query
        .eq('assigned_to', profileId)
        .not('status', 'in', '(completed,cancelled)')
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(20),
      []
    )
  }

  const needsAttentionSection = async () => {
    let query = supabase.from('work_orders').select(WO_CARD_SELECT)
    query = applyOrgScope(query, scope)
    return safe(
      query
        .in('status', ['open', 'in_progress', 'scheduled'])
        .or(`due_date.lte.${today},priority.in.(high,urgent,critical)`)
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(20),
      []
    )
  }

  const scheduledTodaySection = async () => {
    let query = supabase.from('work_orders').select(WO_CARD_SELECT)
    query = applyOrgScope(query, scope)
    return safe(
      query
        .eq('scheduled_date', today)
        .not('status', 'in', '(completed,cancelled)')
        .order('created_at', { ascending: false })
        .limit(20),
      []
    )
  }

  const openJobsSection = async () => {
    let query = supabase.from('work_orders').select(WO_CARD_SELECT)
    query = applyOrgScope(query, scope)
    return safe(
      query
        .not('status', 'in', '(completed,cancelled)')
        .order('updated_at', { ascending: false })
        .limit(30),
      []
    )
  }

  const recentlyUpdatedSection = async () => {
    let query = supabase.from('work_orders').select(WO_CARD_SELECT)
    query = applyOrgScope(query, scope)
    return safe(query.order('updated_at', { ascending: false }).limit(20), [])
  }

  const [myJobs, needsAttention, scheduledToday, openJobs, recentlyUpdated] = await Promise.all([
    myJobsSection(),
    needsAttentionSection(),
    scheduledTodaySection(),
    openJobsSection(),
    recentlyUpdatedSection(),
  ])

  return NextResponse.json({
    success: true,
    stats: {
      myJobs: (myJobs as unknown[]).length,
      needsAttention: (needsAttention as unknown[]).length,
      scheduledToday: (scheduledToday as unknown[]).length,
      openJobs: (openJobs as unknown[]).length,
      recentlyUpdated: (recentlyUpdated as unknown[]).length,
    },
    myJobs,
    needsAttention,
    scheduledToday,
    openJobs,
    recentlyUpdated,
  })
}
