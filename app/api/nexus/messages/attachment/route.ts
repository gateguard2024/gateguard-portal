import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { gmailAttachment } from '@/lib/mail-fetch'
import { isRingCentral, rcFile } from '@/lib/ringcentral'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Only these open in the browser; anything else (HTML, SVG, scripts, Office files…)
// always downloads, so an attachment can never run code on the Nexus site.
const VIEWABLE = /^(image\/(png|jpe?g|gif|webp|heic|bmp)|application\/pdf|text\/plain|video\/mp4|audio\/(mpeg|mp3|mp4|wav|x-wav))$/i

// GET /api/nexus/messages/attachment?m=<message id>&a=<gmail attachment id>[&inline=1]
// Streams one attachment straight from Gmail. Only the mailbox owner can get it.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  const sp = new URL(req.url).searchParams
  const mid = sp.get('m') ?? ''
  const aid = sp.get('a') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(mid) || !aid) return NextResponse.json({ error: 'Bad link.' }, { status: 400 })

  const { data: msg } = await supabase.from('messages').select('id, thread_id, channel_id, external_message_id, attachments').eq('id', mid).maybeSingle()
  if (!msg?.external_message_id) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  const { data: thread } = await supabase.from('message_threads').select('user_id').eq('id', msg.thread_id).maybeSingle()
  if (!thread || thread.user_id !== user.id) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  const meta = ((Array.isArray(msg.attachments) ? msg.attachments : []) as { attachment_id: string; name: string; mime_type: string }[]).find((a) => a.attachment_id === aid)
  if (!meta) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  const { data: ch } = await supabase.from('message_channels').select('*').eq('id', msg.channel_id).maybeSingle()
  if (!ch || (!ch.oauth_refresh_token && !isRingCentral(ch)) || ch.user_id !== user.id) return NextResponse.json({ error: 'Mailbox not connected.' }, { status: 409 })

  // RingCentral voicemail / MMS picture, or a Gmail attachment.
  const rcUri = (meta as { rc_uri?: string }).rc_uri
  const r = rcUri ? await rcFile(ch, rcUri) : await gmailAttachment(ch, msg.external_message_id, aid)
  if (!r.data) return NextResponse.json({ error: r.error ?? 'Could not get the file.' }, { status: 502 })

  const viewable = VIEWABLE.test(meta.mime_type)
  const inline = sp.get('inline') === '1' && viewable
  const safeName = (meta.name || 'attachment').replace(/[^\w.\- ()]/g, '_').slice(0, 150)
  return new NextResponse(new Uint8Array(r.data), {
    headers: {
      'Content-Type': viewable ? meta.mime_type : 'application/octet-stream',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(meta.name || 'attachment')}`,
      // Chrome won't show a PDF under a sandbox policy; PDFs can't run page script anyway.
      ...(meta.mime_type === 'application/pdf' ? {} : { 'Content-Security-Policy': "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'" }),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
