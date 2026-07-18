// POST /api/crm/opportunities/[id]/emails/send
// In-portal Gmail compose for an opportunity. Sends through the current user's
// Gmail connector, records the outbound message in message_threads/messages
// with the thread linked to this opportunity, and logs a crm_activities email
// row so the Activity timeline stays complete.
//
// Body: { to, subject, text, html?, thread_id? }

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { opportunityInScope } from '@/lib/crm-scope'
import { sendViaGmail, type OutboundEmail } from '@/lib/mail-send'
import { autoLinkThread } from '@/lib/email-match'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await opportunityInScope(params.id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const user = await getCurrentUser()

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { to, subject, text, html, thread_id } = body ?? {}
  if (!to || !String(to).includes('@')) {
    return NextResponse.json({ error: 'A valid "to" address is required' }, { status: 400 })
  }

  // The user's active Gmail connector.
  const { data: channel } = await supabase
    .from('message_channels')
    .select('*')
    .eq('user_id', user.id)
    .eq('channel_type', 'gmail')
    .eq('is_active', true)
    .not('oauth_refresh_token', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!channel) {
    return NextResponse.json(
      { error: 'No Gmail connected. Connect your Gmail in Messages → Settings first.' },
      { status: 409 },
    )
  }

  const cfg = channel.config ?? {}
  const fromAddress: string = cfg.from_address ?? user.email

  // Append the user's saved signature (same behavior as Nexus Messages send).
  const { data: sig } = await supabase
    .from('user_settings')
    .select('email_signature')
    .eq('user_id', user.id)
    .maybeSingle()
  const signature = (sig?.email_signature ?? '').trim()
  const textWithSig = signature ? `${text ?? ''}\n\n${signature}` : (text ?? '')
  const htmlWithSig = html
    ? signature
      ? `${html}<br><br>${signature.replace(/\n/g, '<br>')}`
      : html
    : undefined

  const email: OutboundEmail = {
    to,
    subject: subject || '(no subject)',
    text: textWithSig,
    html: htmlWithSig,
    fromName: user.name,
    fromAddress,
  }
  const result = await sendViaGmail(channel.oauth_refresh_token, fromAddress, email)

  // Find or create the linked thread.
  let threadId: string | null = thread_id ?? null
  if (!threadId) {
    const { data: thread, error: thErr } = await supabase
      .from('message_threads')
      .insert({
        user_id: user.id,
        org_id: channel.org_id ?? user.org_id,
        channel_id: channel.id,
        subject: email.subject,
        participants: [{ name: '', address: to }],
        linked_opportunity_id: params.id,
        link_source: 'manual', // sent FROM this opportunity — a deliberate link
        last_message_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (thErr) return NextResponse.json({ error: thErr.message }, { status: 500 })
    threadId = thread.id
  }

  const now = new Date().toISOString()
  const { error: msgErr } = await supabase.from('messages').insert({
    thread_id: threadId,
    channel_id: channel.id,
    external_message_id: result.externalId ?? null,
    direction: 'outbound',
    source_type: 'gmail',
    from_address: fromAddress,
    from_name: user.name,
    to_addresses: [{ name: '', address: to }],
    subject: email.subject,
    body: text ?? '',
    body_html: html ?? null,
    status: result.ok ? 'sent' : 'failed',
    sent_at: result.ok ? now : null,
    error_message: result.ok ? null : result.error,
  })
  if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 })

  // Keep the Activity timeline complete (same shape as /api/crm/email/send logs).
  if (result.ok) {
    const { error: actErr } = await supabase.from('crm_activities').insert({
      opportunity_id: params.id,
      type: 'email',
      subject: email.subject,
      body: text ?? '',
      direction: 'outbound',
      to_email: to,
      from_email: fromAddress,
      email_status: 'sent',
      completed_at: now,
      created_by_name: user.name,
    })
    if (actErr) console.error('emails/send: activity log failed:', actErr.message)

    // If replying on an existing thread, make sure it's linked to this opp too.
    if (thread_id) {
      await autoLinkThread(supabase, thread_id, [String(to)], fromAddress)
      await supabase
        .from('message_threads')
        .update({ linked_opportunity_id: params.id, link_source: 'manual' })
        .eq('id', thread_id)
        .is('linked_opportunity_id', null)
    }
  }

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error, thread_id: threadId }, { status: 502 })
  }
  return NextResponse.json({ ok: true, thread_id: threadId, external_id: result.externalId })
}
