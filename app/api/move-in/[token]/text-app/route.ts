/**
 * POST /api/move-in/{token}/text-app — "Text me the app link" on the Done screen.
 * Texts the mobile number the resident confirmed in step 1. Only after setup is complete,
 * at most 3 times per link.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getInvite, updateInvite } from '@/lib/move-in'
import { sendText } from '@/lib/sms'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const r = await getInvite(params.token)
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.error === 'not_found' ? 404 : 410 })
  const { invite } = r
  if (invite.status !== 'complete') return NextResponse.json({ error: 'Finish setup first.' }, { status: 400 })
  if (!invite.phone) return NextResponse.json({ error: 'We don’t have a mobile number for you.' }, { status: 400 })
  const sentBefore = Number((invite as unknown as { app_texts_sent?: number }).app_texts_sent ?? 0)
  if (sentBefore >= 3) return NextResponse.json({ error: 'We’ve already texted you the link. Check your messages.' }, { status: 429 })

  const link = `${req.nextUrl.origin}/app`
  const res = await sendText(invite.phone, `GateGuard: your key for ${r.propertyName} is ready. Get the app: ${link} — then sign in with ${invite.email}. No password needed.`)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 502 })
  await updateInvite(invite.id, { app_texts_sent: sentBefore + 1 })
  return NextResponse.json({ ok: true })
}
