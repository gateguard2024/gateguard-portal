// lib/mail-folders.ts — which conversations belong in each Nexus Mail folder.
export type Folder = 'all_inbox' | 'inbox' | 'other' | 'unread' | 'needs_reply' | 'starred' | 'snoozed' | 'phone' | 'sent' | 'linked' | 'archived' | 'trash' | 'all'
export const FOLDERS: Folder[] = ['all_inbox', 'inbox', 'other', 'unread', 'needs_reply', 'starred', 'snoozed', 'phone', 'sent', 'linked', 'archived', 'trash', 'all']

export const LINKED_OR = 'linked_type.not.is.null,linked_opportunity_id.not.is.null,linked_customer_org_id.not.is.null'
export const LIST_COLS = 'id, channel_id, external_thread_id, subject, participants, last_message_at, unread_count, created_at, linked_type, linked_id, linked_label, linked_opportunity_id, linked_customer_org_id, snippet, last_direction, last_from_name, last_from_address, message_count, labels, is_archived, is_starred, is_trashed, is_bulk, has_attachments, snoozed_until'
export const OLD_COLS = 'id, channel_id, subject, participants, last_message_at, unread_count, created_at, linked_type, linked_id, linked_label'

// Keep a search term from breaking the PostgREST filter syntax.
export const term = (q: string) => q.replace(/[,()*%\\:"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyFolder(q: any, folder: Folder, nowIso: string) {
  const notSnoozed = `snoozed_until.is.null,snoozed_until.lte.${nowIso}`
  switch (folder) {
    case 'all_inbox':   return q.eq('is_archived', false).eq('is_trashed', false).or(notSnoozed)
    case 'inbox':       return q.eq('is_archived', false).eq('is_trashed', false).or(notSnoozed).or(`is_bulk.eq.false,${LINKED_OR}`)
    case 'other':       return q.eq('is_archived', false).eq('is_trashed', false).or(notSnoozed).eq('is_bulk', true).is('linked_type', null).is('linked_opportunity_id', null).is('linked_customer_org_id', null)
    case 'unread':      return q.eq('is_trashed', false).eq('is_archived', false).gt('unread_count', 0)
    case 'needs_reply': return q.eq('is_trashed', false).eq('is_archived', false).eq('is_bulk', false).eq('last_direction', 'inbound').or(notSnoozed)
                          .gte('last_message_at', new Date(Date.now() - 14 * 86400_000).toISOString())
    case 'starred':     return q.eq('is_trashed', false).eq('is_starred', true)
    case 'phone':       return q.eq('is_trashed', false).like('external_thread_id', 'rc:%')
    case 'snoozed':     return q.eq('is_trashed', false).gt('snoozed_until', nowIso)
    case 'sent':        return q.eq('is_trashed', false).or('labels.cs.{SENT},last_direction.eq.outbound')
    case 'linked':      return q.eq('is_trashed', false).or(LINKED_OR)
    case 'archived':    return q.eq('is_trashed', false).eq('is_archived', true)
    case 'trash':       return q.eq('is_trashed', true)
    default:            return q.eq('is_trashed', false)
  }
}

