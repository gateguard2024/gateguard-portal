import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { gmailInlineImage } from '@/lib/mail-fetch'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const IMAGE = /^image\/(png|jpe?g|gif|webp|bmp)$/i

// GET /api/nexus/messages/inline?m=<message id>&cid=<content id>
// A picture inside an email (signature logo, icons) that Gmail sent inside the message
// rather than as an attachment. Only the mailbox owner can get it; images only.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  const sp = new URL(req.url).searchParams
  const mid = sp.get('m') ?? ''
  const cid = (sp.get('cid') ?? '').slice(0, 300)
  if (!/^[0-9a-f-]{36}$/i.test(mid) || !cid) return NextResponse.json({ error: 'Bad link.' }, { status: 400 })

  const { data: msg } = await supabase.from('messages').select('id, thread_id, channel_id, external_message_id').eq('id', mid).maybeSingle()
  if (!msg?.external_message_id) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  const { data: thread } = await supabase.from('message_threads').select('user_id').eq('id', msg.thread_id).maybeSingle()
  if (!thread || thread.user_id !== user.id) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  const { data: ch } = await supabase.from('message_channels').select('*').eq('id', msg.channel_id).maybeSingle()
  if (!ch || !ch.oauth_refresh_token || ch.user_id !== user.id) return NextResponse.json({ error: 'Mailbox not connected.' }, { status: 409 })

  const r = await gmailInlineImage(ch, msg.external_message_id, cid)
  if (!r.data) return NextResponse.json({ error: r.error ?? 'Could not get the picture.' }, { status: 404 })
  if (!IMAGE.test(r.mime ?? '')) return NextResponse.json({ error: 'Not a picture.' }, { status: 415 })
  return new NextResponse(new Uint8Array(r.data), {
    headers: {
      'Content-Type': r.mime!,
      'Content-Security-Policy': "sandbox; default-src 'none'",
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=86400',
    },
  })
}
