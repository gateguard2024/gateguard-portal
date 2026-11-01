/**
 * /api/lexi/nudges — Lexi's "I noticed…" list.
 *   GET                       → { nudges: [{ key, tone, kind, title, detail, ask, href }] }
 *   POST { key, days }        → hide that item for N days (1–30)
 * Scoped like everything else in Lexi (lib/lexi/tools.ts). Corporate-only for now.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { isSignedIn } from '@/lib/assistant-executor'
import { lexiCtx } from '@/lib/lexi/tools'
import { computeNudges, snoozeNudge } from '@/lib/lexi/proactive'

export const dynamic = 'force-dynamic'

async function caller() {
  const user = await getCurrentUser()
  if (!isSignedIn(user)) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (!user.isCorporate) return { error: NextResponse.json({ error: 'Lexi is in early access for Gate Guard corporate.' }, { status: 403 }) }
  return { user }
}

export async function GET() {
  const c = await caller(); if (c.error) return c.error
  try {
    const { nudges } = await computeNudges(await lexiCtx(c.user))
    return NextResponse.json({ nudges })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Couldn’t load suggestions.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const c = await caller(); if (c.error) return c.error
  const body = await req.json().catch(() => ({}))
  const key = typeof body?.key === 'string' ? body.key : ''
  const days = Number(body?.days) || 1
  const err = await snoozeNudge(c.user, key, days)
  if (err) return NextResponse.json({ error: err }, { status: err === 'Bad item.' ? 400 : 500 })
  return NextResponse.json({ ok: true })
}
