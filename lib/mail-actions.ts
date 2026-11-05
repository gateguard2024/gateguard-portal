// lib/mail-actions.ts — read / unread / archive / flag / trash / snooze one conversation,
// here AND in Gmail. Used by one-at-a-time (threads/[id]) and select-many (threads/bulk).
import type { SupabaseClient } from '@supabase/supabase-js'
import { recomputeThread, gmailThreadAction } from '@/lib/mail-fetch'

export type Action = 'read' | 'unread' | 'archive' | 'inbox' | 'star' | 'unstar' | 'trash' | 'untrash' | 'snooze' | 'unsnooze'
export const ACTIONS: Action[] = ['read', 'unread', 'archive', 'inbox', 'star', 'unstar', 'trash', 'untrash', 'snooze', 'unsnooze']

// The same label change Gmail will make, applied to our copy so the folders are right
// immediately (the live sync then confirms it from Gmail).
const LABEL_EDIT: Partial<Record<Action, { add?: string; remove?: string }>> = {
  archive: { remove: 'INBOX' }, inbox: { add: 'INBOX' },
  star: { add: 'STARRED' }, unstar: { remove: 'STARRED' },
  trash: { add: 'TRASH' }, untrash: { remove: 'TRASH' },
}


export type ActionResult = { ok: boolean; status?: number; error?: string; gmail?: { ok: boolean; needs_reconnect?: boolean; error?: string } }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function applyThreadAction(supabase: SupabaseClient, thread: any, action: Action, untilRaw?: string, channels?: Map<string, any>): Promise<ActionResult> {
    const now = new Date().toISOString()
    if (action === 'snooze' || action === 'unsnooze') {
      const until = action === 'snooze' ? (untilRaw ?? '').trim() : ''
      if (action === 'snooze' && (!until || isNaN(Date.parse(until)) || Date.parse(until) < Date.now())) {
        return { ok: false, status: 400, error: 'Pick a time in the future.' }
      }
      const { error } = await supabase.from('message_threads').update({ snoozed_until: action === 'snooze' ? new Date(until).toISOString() : null }).eq('id', thread.id)
      if (error) return { ok: false, error: /column|schema/i.test(error.message) ? 'Snooze needs migration 222.' : error.message }
      return { ok: true, gmail: { ok: true } }
    }

    if (action === 'read' || action === 'unread') {
      if (action === 'read') {
        const { error } = await supabase.from('messages').update({ read_at: now }).eq('thread_id', thread.id).eq('direction', 'inbound').is('read_at', null)
        if (error) return { ok: false, error: error.message }
      } else {
        // Unread = the newest email from them goes back to unread.
        const { data: last } = await supabase.from('messages').select('id').eq('thread_id', thread.id).eq('direction', 'inbound')
          .order('created_at', { ascending: false }).limit(1).maybeSingle()
        if (last) {
          const { error } = await supabase.from('messages').update({ read_at: null }).eq('id', last.id)
          if (error) return { ok: false, error: error.message }
        }
      }
      const { data: msgs } = await supabase.from('messages').select('id, labels').eq('thread_id', thread.id)
      for (const m of msgs ?? []) {
        if (!Array.isArray(m.labels)) continue
        const has = m.labels.includes('UNREAD')
        if (action === 'read' && has) await supabase.from('messages').update({ labels: m.labels.filter((l: string) => l !== 'UNREAD') }).eq('id', m.id)
      }
    } else {
      const edit = LABEL_EDIT[action]!
      const { data: msgs, error } = await supabase.from('messages').select('id, labels').eq('thread_id', thread.id)
      if (!error) {
        for (const m of msgs ?? []) {
          const cur: string[] = Array.isArray(m.labels) ? m.labels : []
          let next = cur
          if (edit.add && !cur.includes(edit.add)) next = [...cur, edit.add]
          if (edit.remove) next = next.filter((l) => l !== edit.remove)
          if (next !== cur) await supabase.from('messages').update({ labels: next }).eq('id', m.id)
        }
      }
      // Works before migration 222 too (no labels yet): set the thread flag directly.
      const flag: Record<string, unknown> =
        action === 'archive' ? { is_archived: true } : action === 'inbox' ? { is_archived: false, is_trashed: false }
        : action === 'star' ? { is_starred: true } : action === 'unstar' ? { is_starred: false }
        : action === 'trash' ? { is_trashed: true } : { is_trashed: false }
      const { error: fErr } = await supabase.from('message_threads').update(flag).eq('id', thread.id)
      if (fErr && /column|schema/i.test(fErr.message)) return { ok: false, error: 'This needs migration 222.' }
    }
    await recomputeThread(supabase, thread.id)
    if (action === 'archive') await supabase.from('message_threads').update({ is_archived: true }).eq('id', thread.id)

    // Same change in Gmail.
    let gmail: { ok: boolean; needs_reconnect?: boolean; error?: string } = { ok: true }
    if (thread.external_thread_id && thread.channel_id) {
      let ch = channels?.get(thread.channel_id)
      if (ch === undefined) {
        const { data } = await supabase.from('message_channels').select('*').eq('id', thread.channel_id).maybeSingle()
        ch = data ?? null
        channels?.set(thread.channel_id, ch)
      }
      if (ch?.channel_type === 'gmail' && ch.oauth_refresh_token) gmail = await gmailThreadAction(ch, thread.external_thread_id, action)
    }
    return { ok: true, gmail }
}
