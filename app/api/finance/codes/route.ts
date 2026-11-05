/**
 * Finance codes — OWNER ONLY (FINANCE_OWNER_EMAILS), and only while Finance is unlocked.
 *   GET                       → who has a code (email, name, active, last unlock, locked?)
 *   POST   { email, code }    → set or reset that corporate admin's code (their old session ends)
 *   DELETE { email }          → remove their access
 * One exception: an owner with no code yet may POST their OWN email to set a first code.
 */
import { NextRequest, NextResponse } from 'next/server'
import { clientIp, financeStatus, isFinanceOwner, listAccess, removeCode, requireFinance, setCode, setSessionCookie } from '@/lib/finance-auth'

export const dynamic = 'force-dynamic'

const deny = (error: string, status: number) => NextResponse.json({ error }, { status })

export async function GET(req: NextRequest) {
  const gate = await requireFinance(req)
  if (!gate.ok) return deny(gate.error, gate.status)
  if (!gate.owner) return deny('Only the owner can see who has a Finance code.', 403)
  try {
    const res = NextResponse.json({ people: await listAccess() })
    setSessionCookie(res, gate.token, gate.idle)
    return res
  } catch (e) { return deny(e instanceof Error ? e.message : 'Couldn’t load codes.', 500) }
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; code?: unknown }

  // First code for an owner who has none yet — always for their own account.
  const { status, user } = await financeStatus(req)
  if (status.state === 'no_code' && isFinanceOwner(user)) {
    const r = await setCode(user, user.email, body.code, clientIp(req))
    return r.ok ? NextResponse.json({ ok: true, first: true }) : deny(r.error, r.status)
  }

  const email = String(body.email ?? '').trim()
  if (!email) return deny('Enter the person’s email.', 400)

  const gate = await requireFinance(req)
  if (!gate.ok) return deny(gate.error, gate.status)
  if (!gate.owner) return deny('Only the owner can set Finance codes.', 403)
  try {
    const r = await setCode(gate.user, email, body.code, clientIp(req))
    if (!r.ok) return deny(r.error, r.status)
    const res = NextResponse.json({ ok: true })
    // Resetting your own code rotates your session nonce, so that session ends; the page asks for the new code.
    if (email.toLowerCase() !== gate.user.email.toLowerCase()) setSessionCookie(res, gate.token, gate.idle)
    return res
  } catch (e) { return deny(e instanceof Error ? e.message : 'Couldn’t save the code.', 500) }
}

export async function DELETE(req: NextRequest) {
  const gate = await requireFinance(req)
  if (!gate.ok) return deny(gate.error, gate.status)
  if (!gate.owner) return deny('Only the owner can remove Finance codes.', 403)
  const body = (await req.json().catch(() => ({}))) as { email?: string }
  const email = String(body.email ?? '').trim()
  if (!email) return deny('Enter the person’s email.', 400)
  if (email.toLowerCase() === gate.user.email.toLowerCase()) return deny('You can’t remove your own access.', 400)
  try {
    const r = await removeCode(gate.user, email, clientIp(req))
    if (!r.ok) return deny(r.error, r.status)
    const res = NextResponse.json({ ok: true })
    setSessionCookie(res, gate.token, gate.idle)
    return res
  } catch (e) { return deny(e instanceof Error ? e.message : 'Couldn’t remove the code.', 500) }
}
