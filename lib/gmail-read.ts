/**
 * lib/gmail-read.ts
 *
 * Inbound Gmail read helpers — the missing half of the mail integration.
 * Reuses getGmailAccessToken() from lib/mail-send.ts (same OAuth refresh the
 * sender already uses) so there is ONE Gmail token path, not two.
 *
 * Nothing here persists; app/api/messages/sync pulls these into the existing
 * message_threads / messages tables.
 */
import { getGmailAccessToken } from '@/lib/mail-send'

const API = 'https://gmail.googleapis.com/gmail/v1/users/me'

export type GmailThreadMeta = {
  threadId: string
  subject: string
  snippet: string
  fromName: string
  fromAddress: string
  to: { name?: string; address: string }[]
  date: string | null // ISO
  unread: boolean
  externalMessageId: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function gfetch(token: string, path: string): Promise<any> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`gmail ${res.status}: ${body.slice(0, 180)}`)
  }
  return res.json()
}

// Recent inbox thread IDs (newest first). Default: last 30 days, capped.
export async function listInboxThreadIds(token: string, max = 25, q = 'in:inbox newer_than:30d'): Promise<string[]> {
  const data = await gfetch(token, `/threads?maxResults=${max}&q=${encodeURIComponent(q)}`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.threads ?? []).map((t: any) => String(t.id))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function header(headers: any[], name: string): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const h = (headers ?? []).find((x: any) => String(x.name).toLowerCase() === name.toLowerCase())
  return h?.value ?? ''
}

function parseAddr(v: string): { name?: string; address: string } {
  const m = v.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/)
  if (m) return { name: m[1].trim() || undefined, address: m[2].trim() }
  return { address: v.trim() }
}

// Thread metadata built from the LATEST message in the thread (what the inbox row shows).
export async function getThreadMeta(token: string, threadId: string): Promise<GmailThreadMeta | null> {
  const data = await gfetch(
    token,
    `/threads/${threadId}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
  )
  const msgs = data.messages ?? []
  if (!msgs.length) return null
  const last = msgs[msgs.length - 1]
  const headers = last.payload?.headers ?? []
  const from = parseAddr(header(headers, 'From'))
  const toRaw = header(headers, 'To')
  const to = toRaw ? toRaw.split(',').map(parseAddr) : []
  const internalMs = Number(last.internalDate)
  const unread = (last.labelIds ?? []).includes('UNREAD')
  return {
    threadId,
    subject: header(headers, 'Subject') || '(no subject)',
    snippet: last.snippet ?? '',
    fromName: from.name ?? '',
    fromAddress: from.address,
    to,
    date: Number.isFinite(internalMs) ? new Date(internalMs).toISOString() : null,
    unread,
    externalMessageId: String(last.id),
  }
}

export { getGmailAccessToken }
