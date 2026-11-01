import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { revertAction, isSignedIn, RevertPayload } from '@/lib/assistant-executor'
import { resolveOrgScope } from '@/lib/org-scope'
import { canRunAssistantActions } from '@/lib/lexi/access'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // getCurrentUser() never throws (signed-out = anonymous user), so check it.
  const user = await getCurrentUser()
  if (!isSignedIn(user)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const may = await canRunAssistantActions(user)
  if (!may.ok) return NextResponse.json({ success: false, error: may.error }, { status: 403 })
  const ctx = { user, scope: await resolveOrgScope(user) }

  let body: { revertPayload: RevertPayload }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { revertPayload } = body

  if (!revertPayload || typeof revertPayload !== 'object') {
    return NextResponse.json({ error: 'revertPayload is required' }, { status: 400 })
  }
  if (!revertPayload.operation || !revertPayload.table || !revertPayload.id) {
    return NextResponse.json(
      { error: 'revertPayload must include operation, table, and id' },
      { status: 400 }
    )
  }

  try {
    const result = await revertAction(revertPayload, ctx)
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true, message: 'Action reverted successfully.' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[assistant/revert]', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
