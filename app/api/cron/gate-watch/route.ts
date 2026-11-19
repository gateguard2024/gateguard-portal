import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { runDueGates } from '@/lib/gate-watch'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Gate Watch backup runner — the same pass as the Inngest job `nexus-gate-watch`.
 * Vercel Cron calls it every minute (vercel.json) with `Authorization: Bearer $CRON_SECRET`,
 * so gates keep being checked if Inngest stops. Safe alongside Inngest: runDueGates claims
 * each due gate first, so two runners never check the same gate.
 * A signed-in corporate user can open it to run a pass now.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const viaCron = !!secret && req.headers.get('authorization') === `Bearer ${secret}`
  if (!viaCron) {
    const user = await getCurrentUser().catch(() => null)
    if (!user?.isCorporate) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const r = await runDueGates(40)
    if (r.errors.length) console.error('[gate-watch cron]', r.errors.slice(0, 10))
    return NextResponse.json({ ok: true, via: viaCron ? 'cron' : 'manual', ...r })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gate Watch run failed' }, { status: 500 })
  }
}
