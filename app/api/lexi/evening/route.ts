/**
 * /api/lexi/evening — Lexi's nightly "Close out today, plan tomorrow" (opt-in).
 *   GET                       → { review, settings }   (the review screen)
 *   GET ?view=settings        → { settings }           (cheap: for the Lexi home card)
 *   POST { action: 'settings', on?, time?, days?, phone?, email? }
 *   POST { action: 'bring', bringAlways: string[] }    → the "always bring" list
 *   POST { action: 'commit', for: 'YYYY-MM-DD', items: [{ title, task_id }] }  → tomorrow's top 3
 *   POST { action: 'send_now' }                        → text/email me the link now (a test)
 * Task moves / done happen through /api/todos/[id] (its own permission checks).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { isSignedIn } from '@/lib/assistant-executor'
import { LEXI_OFF_MESSAGE, lexiAccess } from '@/lib/lexi/access'
import { buildEveningReview, getEveningSettings, saveEveningSettings, sendEveningNudge, type EveningSettings } from '@/lib/lexi/evening'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function caller() {
  const user = await getCurrentUser()
  if (!isSignedIn(user)) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if ((await lexiAccess(user)) === 'none') return { error: NextResponse.json({ error: LEXI_OFF_MESSAGE }, { status: 403 }) }
  return { user }
}
// The phone is the person's own, but only show its last 4 back.
const publicSettings = (s: EveningSettings, email: string) => ({ on: s.on, time: s.time, days: s.days, phoneLast4: s.phone ? s.phone.slice(-4) : null, email: s.email, emailAddress: email, bringAlways: s.bringAlways, lastSent: s.lastSent, ...(s.error ? { error: s.error } : {}) })

export async function GET(req: NextRequest) {
  const c = await caller(); if (c.error) return c.error
  const s = await getEveningSettings(c.user.id)
  if (req.nextUrl.searchParams.get('view') === 'settings') return NextResponse.json({ settings: publicSettings(s, c.user.email) })
  try {
    const review = await buildEveningReview(c.user)
    return NextResponse.json({ review, settings: publicSettings(s, c.user.email) })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not build tonight’s review.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const c = await caller(); if (c.error) return c.error
  const body = await req.json().catch(() => ({}))
  const action = String(body?.action ?? '')
  if (action === 'send_now') {
    const r = await sendEveningNudge(c.user)
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 })
    return NextResponse.json({ ok: true, sent: r.sent, ...(r.error ? { warning: r.error } : {}) })
  }
  let patch: Record<string, unknown>
  if (action === 'settings') patch = { on: body.on, time: body.time, days: body.days, phone: body.phone, email: body.email }
  else if (action === 'bring') patch = { bringAlways: body.bringAlways }
  else if (action === 'commit') patch = { top3: { for: body.for, items: body.items } }
  else return NextResponse.json({ error: 'Nothing to do.' }, { status: 400 })
  for (const k of Object.keys(patch)) if (patch[k] === undefined) delete patch[k]
  const err = await saveEveningSettings(c.user, patch)
  if (err) return NextResponse.json({ error: err }, { status: /migration 211/.test(err) ? 500 : 400 })
  return NextResponse.json({ ok: true, settings: publicSettings(await getEveningSettings(c.user.id), c.user.email) })
}
