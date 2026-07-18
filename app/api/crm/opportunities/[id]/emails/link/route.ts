// POST /api/crm/opportunities/[id]/emails/link
// Manually attach or detach an email thread on this opportunity.
// Body: { thread_id, action: 'link' | 'unlink' }
// Manual decisions set link_source='manual' so the auto-matcher won't undo them.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { opportunityInScope } from '@/lib/crm-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await opportunityInScope(params.id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { thread_id, action } = body ?? {}
  if (!thread_id || !['link', 'unlink'].includes(action)) {
    return NextResponse.json({ error: 'thread_id and action (link|unlink) required' }, { status: 400 })
  }

  const patch =
    action === 'link'
      ? { linked_opportunity_id: params.id, link_source: 'manual' }
      : { linked_opportunity_id: null, link_source: 'manual' }

  const { error } = await supabase.from('message_threads').update(patch).eq('id', thread_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
