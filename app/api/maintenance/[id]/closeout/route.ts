import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { guardWorkOrder } from '@/lib/ops-scope'
import { closeoutStatus, saveCloseout } from '@/lib/job-closeout'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export const dynamic = 'force-dynamic'

// GET /api/maintenance/[id]/closeout → what this job still needs before it can be
// completed (time on site, parts or "No parts used").
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await guardWorkOrder(req, params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(await closeoutStatus(params.id))
}

// POST { arrive?, leave?, technician_name?, technician_id?, parts_none? }
// Saves the close-out answers (an arrive/leave entry and/or the parts answer) and
// returns the new status. Completing the job is still the normal status change.
// Works for the portal (Clerk) and the field app (x-tech-code).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await guardWorkOrder(req, params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  let user: { id?: string; name?: string; email?: string; org_id?: string | null } | null = null
  try { user = await getCurrentUser() } catch { user = null }
  const signedIn = !!user && user.id !== 'anonymous'
  // Hours belong to the tech on the job unless the caller names one (a dispatcher
  // filling in for the tech shouldn't get the hours).
  const { data: job } = await supabase.from('work_orders').select('assignee_id, assignee_name').eq('id', params.id).maybeSingle()
  const r = await saveCloseout(params.id, {
    arrive: (body.arrive as string) ?? null,
    leave: (body.leave as string) ?? null,
    technician_name: (body.technician_name as string) || job?.assignee_name || (signedIn ? user!.name : null) || null,
    technician_id: (body.technician_id as string) || job?.assignee_id || (signedIn ? user!.id : null) || null,
    org_id: signedIn ? user!.org_id ?? null : null,
    parts_none: typeof body.parts_none === 'boolean' ? body.parts_none : null,
    who: (body.technician_name as string) || (signedIn ? user!.name || user!.email : null) || null,
  })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json(await closeoutStatus(params.id))
}
