/**
 * /api/lexi/brief — Lexi's home cards + the morning-brief setting.
 *   GET                         → counts for the home cards, name, emailBrief (on/off), email
 *   POST { emailBrief: bool }   → turn the weekday 6:30am email on/off
 *   POST { action: 'send' }     → email me today's brief now
 * No AI in GET: the same scoped reads Lexi's daily_brief tool uses.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { canRunAssistantActions, LEXI_OFF_MESSAGE, lexiAccess } from '@/lib/lexi/access'
import { isSignedIn } from '@/lib/assistant-executor'
import { lexiCtx, briefCounts } from '@/lib/lexi/tools'
import { getLexiSettings, sendMorningBrief, setBriefEmail } from '@/lib/lexi/proactive'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function caller() {
  const user = await getCurrentUser()
  if (!isSignedIn(user)) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if ((await lexiAccess(user)) === 'none') return { error: NextResponse.json({ error: LEXI_OFF_MESSAGE }, { status: 403 }) }
  return { user }
}

export async function GET() {
  const c = await caller(); if (c.error) return c.error
  try {
    const [counts, settings, may] = await Promise.all([briefCounts(await lexiCtx(c.user)), getLexiSettings(c.user.id), canRunAssistantActions(c.user)])
    const canAct = may.ok && (await lexiAccess(c.user)) === 'edit'
    return NextResponse.json({ ...counts, canAct, name: c.user.name.split(' ')[0], email: c.user.email, emailBrief: settings.briefEmail, ...(settings.error ? { settingsError: settings.error } : {}) })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not load your brief.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const c = await caller(); if (c.error) return c.error
  const body = await req.json().catch(() => ({}))
  if (body?.action === 'send') {
    const r = await sendMorningBrief(c.user, { force: true })
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 })
    return NextResponse.json({ ok: true, sentTo: c.user.email })
  }
  if (typeof body?.emailBrief === 'boolean') {
    const err = await setBriefEmail(c.user, body.emailBrief)
    if (err) return NextResponse.json({ error: err }, { status: 500 })
    return NextResponse.json({ ok: true, emailBrief: body.emailBrief })
  }
  return NextResponse.json({ error: 'Nothing to do.' }, { status: 400 })
}
