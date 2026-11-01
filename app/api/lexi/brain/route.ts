/**
 * /api/lexi/brain — Lexi's Brain (migration 200).
 *   GET              → { company: [...], personal: [...], canEditCompany }
 *   POST { body, title?, category?, scope: 'company'|'personal' } → { row }
 *   DELETE ?id=<uuid> → { ok: true }
 * Company rows: everyone in the caller's company sees them; admins/supervisors
 * edit them. Personal rows: owner only. All checks live in lib/lexi/brain.ts.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { LEXI_OFF_MESSAGE, lexiAccess } from '@/lib/lexi/access'
import { isSignedIn } from '@/lib/assistant-executor'
import { addBrain, canEditCompanyBrain, deleteBrain, loadBrain, notReady } from '@/lib/lexi/brain'

export const dynamic = 'force-dynamic'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function caller() {
  const user = await getCurrentUser()
  if (!isSignedIn(user)) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if ((await lexiAccess(user)) === 'none') return { error: NextResponse.json({ error: LEXI_OFF_MESSAGE }, { status: 403 }) }
  return { user }
}

export async function GET() {
  const c = await caller(); if (c.error) return c.error
  const b = await loadBrain(c.user)
  if (b.error) return NextResponse.json({ error: notReady(b.error) }, { status: 500 })
  return NextResponse.json({ company: b.company, personal: b.personal, canEditCompany: canEditCompanyBrain(c.user) })
}

export async function POST(req: NextRequest) {
  const c = await caller(); if (c.error) return c.error
  const body = await req.json().catch(() => ({}))
  const r = await addBrain(c.user, { body: body?.body, title: body?.title, category: body?.category, scope: body?.scope })
  if (r.error) return NextResponse.json({ error: r.error }, { status: /Only admins/.test(r.error) ? 403 : /Tell me/.test(r.error) ? 400 : 500 })
  return NextResponse.json({ row: r.row })
}

export async function DELETE(req: NextRequest) {
  const c = await caller(); if (c.error) return c.error
  const id = req.nextUrl.searchParams.get('id') ?? ''
  if (!UUID.test(id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 })
  const r = await deleteBrain(c.user, id)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === 'Not found.' ? 404 : r.error?.startsWith('You can') ? 403 : 500 })
  return NextResponse.json({ ok: true })
}
