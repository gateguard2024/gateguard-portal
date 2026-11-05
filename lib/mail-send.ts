// lib/mail-send.ts
// Shared outbound-email helpers for the Nexus Messages connectors.
//   • SMTP  — sends through a user-configured SMTP server via nodemailer
//   • Gmail — sends through the Gmail REST API using a stored OAuth refresh token
//
// Both paths take a normalized OutboundEmail and return a SendResult so the
// /api/nexus/messages/send route can record the outbound message uniformly.

export interface MailAttachment {
  filename: string
  content: Buffer | string // Buffer, or a base64 string when isBase64 is true
  contentType?: string     // defaults to application/octet-stream
  isBase64?: boolean       // true when content is already a base64 string
}

export interface OutboundEmail {
  to: string
  subject: string
  text?: string
  html?: string
  fromName?: string
  fromAddress?: string // the connector's own address; required for SMTP envelope
  cc?: string[]        // optional carbon-copy recipients
  bcc?: string[]       // optional blind-copy recipients (Gmail only)
  attachments?: MailAttachment[]
  // Reply threading (Gmail): keeps a reply in the same conversation for us AND the
  // customer — Gmail needs the threadId, every mail app needs In-Reply-To/References.
  gmailThreadId?: string
  inReplyTo?: string   // RFC Message-ID of the message being answered, e.g. <abc@mail.gmail.com>
  references?: string  // space-separated Message-IDs of the conversation so far
}

export interface SmtpConfig {
  host: string
  port: number
  secure?: boolean // true for 465, false for 587/STARTTLS
  user: string
  pass: string
}

export interface SendResult {
  ok: boolean
  externalId?: string // provider message id when available
  threadId?: string   // provider thread id when available (Gmail)
  error?: string
}

// ─── SMTP (nodemailer) ────────────────────────────────────────────────────────
// nodemailer is a runtime dependency (added to package.json). It is required
// lazily with `as any` so type-checking does not depend on node_modules being
// present in every environment — mirrors the project's lucide require() pattern.
export async function sendViaSmtp(cfg: SmtpConfig, email: OutboundEmail): Promise<SendResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodemailer = require('nodemailer') as any
    const transport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure ?? cfg.port === 465,
      auth: { user: cfg.user, pass: cfg.pass },
    })
    const from = email.fromName
      ? `"${email.fromName}" <${email.fromAddress ?? cfg.user}>`
      : (email.fromAddress ?? cfg.user)
    const info = await transport.sendMail({
      from,
      to: email.to,
      cc: email.cc && email.cc.length ? email.cc : undefined,
      subject: email.subject,
      text: email.text,
      html: email.html ?? (email.text ? undefined : ' '),
      attachments: (email.attachments ?? []).map(a => ({
        filename: a.filename,
        content: a.isBase64 ? Buffer.from(String(a.content), 'base64') : a.content,
        contentType: a.contentType,
      })),
    })
    return { ok: true, externalId: info?.messageId }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'SMTP send failed' }
  }
}

// ─── Gmail (REST + OAuth refresh token) ────────────────────────────────────────
// Exchanges the stored refresh token for a short-lived access token. Reuses the
// same Google OAuth client as the Calendar integration (GOOGLE_CALENDAR_CLIENT_*).
// Access tokens last ~1 hour; the live sync runs every minute, so keep them per
// refresh token instead of asking Google for a new one each time.
const tokenCache = new Map<string, { token: string; exp: number }>()

export async function getGmailAccessToken(refreshToken: string): Promise<{ token?: string; error?: string }> {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET
  if (!clientId || !clientSecret) return { error: 'Google OAuth not configured' }
  const hit = tokenCache.get(refreshToken)
  if (hit && hit.exp > Date.now()) return { token: hit.token }
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    })
    if (!res.ok) return { error: `token refresh failed: ${await res.text()}` }
    const data = (await res.json()) as { access_token?: string; expires_in?: number }
    if (!data.access_token) return { error: 'no access_token returned' }
    tokenCache.set(refreshToken, { token: data.access_token, exp: Date.now() + Math.max(60, (data.expires_in ?? 3600) - 120) * 1000 })
    return { token: data.access_token }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'token refresh exception' }
  }
}

// True when Google says the saved login is no good any more (revoked, expired —
// Google ends logins after 7 days while the OAuth app is in "Testing").
export function isReconnectError(err?: string | null): boolean {
  return !!err && /invalid_grant|invalid_token|unauthorized_client|Token has been expired or revoked|insufficient|PERMISSION_DENIED|401/i.test(err)
}

// RFC 2047 — a subject or name with accents / emoji / smart quotes must be encoded,
// or it shows up as garbage in the customer's mail app.
function encodeHeader(v: string): string {
  // eslint-disable-next-line no-control-regex
  return /^[\x00-\x7F]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, 'utf8').toString('base64')}?=`
}
const stripHtml = (h: string) => h.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|tr|h\d)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\n{3,}/g, '\n\n').trim()

// Builds an RFC 5322 message and base64url-encodes it for the Gmail API.
function buildMime(email: OutboundEmail, fromAddress: string): string {
  const from = email.fromName ? `${encodeHeader(email.fromName)} <${fromAddress}>` : fromAddress
  const headers = [
    `From: ${from}`,
    `To: ${email.to}`,
  ]
  if (email.cc && email.cc.length) headers.push(`Cc: ${email.cc.join(', ')}`)
  if (email.bcc && email.bcc.length) headers.push(`Bcc: ${email.bcc.join(', ')}`)
  headers.push(`Subject: ${encodeHeader(email.subject)}`, 'MIME-Version: 1.0')
  if (email.inReplyTo) headers.push(`In-Reply-To: ${email.inReplyTo}`)
  if (email.references || email.inReplyTo) headers.push(`References: ${(email.references || email.inReplyTo)!.trim()}`)

  const wrap76 = (s: string) => s.replace(/(.{76})/g, '$1\r\n')
  const b64 = (s: string) => wrap76(Buffer.from(s, 'utf8').toString('base64'))
  const atts = email.attachments ?? []

  // The readable body: HTML + a plain-text copy (multipart/alternative) so every mail
  // app — and spam filters — get what they expect. Plain text only when there's no HTML.
  const textPart = email.text ?? (email.html ? stripHtml(email.html) : '')
  const altBoundary = 'ggalt_' + Math.random().toString(36).slice(2)
  const bodyBlock = (): { ct: string; content: string } => {
    if (!email.html) return { ct: 'text/plain; charset="UTF-8"\r\nContent-Transfer-Encoding: base64', content: b64(textPart) }
    const inner =
      `--${altBoundary}\r\nContent-Type: text/plain; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64(textPart)}\r\n` +
      `--${altBoundary}\r\nContent-Type: text/html; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64(email.html)}\r\n` +
      `--${altBoundary}--`
    return { ct: `multipart/alternative; boundary="${altBoundary}"`, content: inner }
  }

  // No attachments → just the body.
  if (atts.length === 0) {
    const b = bodyBlock()
    headers.push(`Content-Type: ${b.ct}`)
    return Buffer.from(`${headers.join('\r\n')}\r\n\r\n${b.content}`).toString('base64url')
  }

  // Attachments → multipart/mixed. Body first, then each file as base64.
  const boundary = 'ggmix_' + Math.random().toString(36).slice(2)
  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`)
  const b = bodyBlock()
  const parts: string[] = [`--${boundary}\r\nContent-Type: ${b.ct}\r\n\r\n${b.content}`]
  for (const a of atts) {
    const data = a.isBase64 ? String(a.content) : Buffer.from(a.content as Buffer).toString('base64')
    const ct = a.contentType || 'application/octet-stream'
    const name = encodeHeader(a.filename.replace(/["\r\n]/g, ''))
    parts.push(
      `--${boundary}\r\nContent-Type: ${ct}; name="${name}"\r\n` +
      `Content-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename="${name}"\r\n\r\n` +
      wrap76(data.replace(/\s/g, ''))
    )
  }
  const bodyAll = parts.join('\r\n') + `\r\n--${boundary}--`
  return Buffer.from(`${headers.join('\r\n')}\r\n\r\n${bodyAll}`).toString('base64url')
}

export async function sendViaGmail(
  refreshToken: string,
  fromAddress: string,
  email: OutboundEmail,
): Promise<SendResult> {
  const { token, error } = await getGmailAccessToken(refreshToken)
  if (!token) return { ok: false, error: error ?? 'no Gmail access token' }
  try {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: buildMime(email, fromAddress), ...(email.gmailThreadId ? { threadId: email.gmailThreadId } : {}) }),
    })
    if (!res.ok) return { ok: false, error: `Gmail send failed: ${await res.text()}` }
    const data = (await res.json()) as { id?: string; threadId?: string }
    return { ok: true, externalId: data.id, threadId: data.threadId }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Gmail send exception' }
  }
}
