/**
 * GET /api/lexi/brief — the numbers and top items for Lexi's home cards.
 * No AI: the same scoped reads Lexi's daily_brief tool uses.
 */
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { isSignedIn } from '@/lib/assistant-executor'
import { lexiCtx, briefCounts } from '@/lib/lexi/tools'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getCurrentUser()
  if (!isSignedIn(user)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.isCorporate) return NextResponse.json({ error: 'Lexi is in early access for Gate Guard corporate.' }, { status: 403 })
  try {
    const counts = await briefCounts(await lexiCtx(user))
    return NextResponse.json({ ...counts, name: user.name.split(' ')[0] })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not load your brief.' }, { status: 500 })
  }
}
