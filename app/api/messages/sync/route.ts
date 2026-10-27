/**
 * POST /api/messages/sync
 *
 * Pulls the caller's recent Gmail inbox threads into the EXISTING
 * message_threads / messages tables so the /messages inbox shows real mail.
 * Reuses the same Gmail OAuth refresh as the sender (lib/mail-send) — one token
 * path, no new tables, no parallel system.
 */
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { createServiceClient } from '@/lib/supabase'
import { getGmailAccessToken, listInboxThreadIds, getThreadMeta } from '@/lib/gmail-read'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const user = await getCurrentUser()
    if (!user?.id || user.id === 'anonymous') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const supabase = createServiceClient()

    // The caller's active Gmail channel (the one the sender already uses).
    const { data: channel } = await supabase
      .from('message_channels')
      .select('id, oauth_refresh_token, org_id')
      .eq('user_id', user.id)
      .eq('channel_type', 'gmail')
      .eq('is_active', true)
      .not('oauth_refresh_token', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!channel?.oauth_refresh_token) {
      return NextResponse.json(
        { error: 'No connected Gmail account. Connect Gmail in Settings first.', needsConnect: true },
        { status: 400 },
      )
    }

    const { token, error: tErr } = await getGmailAccessToken(channel.oauth_refresh_token)
    if (!token) {
      return NextResponse.json(
        { error: `Gmail authorization failed: ${tErr ?? 'no token'}. Try reconnecting Gmail.` },
        { status: 502 },
      )
    }

    let ids: string[] = []
    try {
      ids = await listInboxThreadIds(token, 25)
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Gmail list failed' }, { status: 502 })
    }

    let synced = 0
    for (const threadId of ids) {
      let meta
      try {
        meta = await getThreadMeta(token, threadId)
      } catch {
        continue
      }
      if (!meta) continue

      const participants = [
        { name: meta.fromName || undefined, address: meta.fromAddress },
        ...meta.to,
      ]

      // Upsert thread, keyed by (user, channel, external thread id).
      const { data: existing } = await supabase
        .from('message_threads')
        .select('id')
        .eq('user_id', user.id)
        .eq('channel_id', channel.id)
        .eq('external_thread_id', threadId)
        .maybeSingle()

      let threadRowId = existing?.id as string | undefined
      if (threadRowId) {
        const { error: upErr } = await supabase
          .from('message_threads')
          .update({
            subject: meta.subject,
            participants,
            last_message_at: meta.date,
            unread_count: meta.unread ? 1 : 0,
            updated_at: new Date().toISOString(),
          })
          .eq('id', threadRowId)
        if (upErr) continue
      } else {
        const { data: ins, error: insErr } = await supabase
          .from('message_threads')
          .insert({
            user_id: user.id,
            org_id: channel.org_id ?? null,
            channel_id: channel.id,
            external_thread_id: threadId,
            subject: meta.subject,
            participants,
            last_message_at: meta.date,
            unread_count: meta.unread ? 1 : 0,
          })
          .select('id')
          .single()
        if (insErr || !ins) continue
        threadRowId = ins.id
      }

      // Insert the latest message once (dedupe on external_message_id).
      const { data: existingMsg } = await supabase
        .from('messages')
        .select('id')
        .eq('thread_id', threadRowId)
        .eq('external_message_id', meta.externalMessageId)
        .maybeSingle()
      if (!existingMsg) {
        await supabase.from('messages').insert({
          thread_id: threadRowId,
          channel_id: channel.id,
          external_message_id: meta.externalMessageId,
          direction: 'inbound',
          source_type: 'gmail',
          from_address: meta.fromAddress,
          from_name: meta.fromName || null,
          to_addresses: meta.to,
          subject: meta.subject,
          body: meta.snippet,
          status: 'delivered',
          sent_at: meta.date,
        })
      }
      synced++
    }

    await supabase
      .from('message_channels')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', channel.id)

    return NextResponse.json({ success: true, synced })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Sync failed' }, { status: 500 })
  }
}
