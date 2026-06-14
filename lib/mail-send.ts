// lib/mail-send.ts
// Shared outbound-email helpers for the Nexus Messages connectors.
//   • SMTP  — sends through a user-configured SMTP server via nodemailer
//   • Gmail — sends through the Gmail REST API using a stored OAuth refresh token
//
// Both paths take a normalized OutboundEmail and return a SendResult so the
// /api/nexus/messages/send route can record the outbound message uniformly.

export interface OutboundEmail {
  to: string
  subject: string
  text?: string
  html?: string
  fromName?: string
  fromAddress?: string // the connector's own address; required for SMTP envelope
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
      subject: email.subject,
      text: email.text,
      html: email.html ?? (email.text ? undefined : ' '),
    })
    return { ok: true, externalId: info?.messageId }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'SMTP send failed' }
  }
}

// ─── Gmail (REST + OAuth refresh token) ────────────────────────────────────────
// Exchanges the stored refresh token for a short-lived access token. Reuses the
// same Google OAuth client as the Calendar integration (GOOGLE_CALENDAR_CLIENT_*).
export async function getGmailAccessToken(refreshToken: string): Promise<{ token?: string; error?: string }> {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET
  if (!clientId || !clientSecret) return { error: 'Google OAuth not configured' }
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
    const data = (await res.json()) as { access_token?: string }
    if (!data.access_token) return { error: 'no access_token returned' }
    return { token: data.access_token }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'token refresh exception' }
  }
}

// Builds an RFC 5322 message and base64url-encodes it for the Gmail API.
function buildMime(email: OutboundEmail, fromAddress: string): string {
  const from = email.fromName ? `${email.fromName} <${fromAddress}>` : fromAddress
  const headers = [
    `From: ${from}`,
    `To: ${email.to}`,
    `Subject: ${email.subject}`,
    'MIME-Version: 1.0',
  ]
  let bodyPart: string
  if (email.html) {
    headers.push('Content-Type: text/html; charset="UTF-8"')
    bodyPart = email.html
  } else {
    headers.push('Content-Type: text/plain; charset="UTF-8"')
    bodyPart = email.text ?? ''
  }
  const raw = `${headers.join('\r\n')}\r\n\r\n${bodyPart}`
  return Buffer.from(raw).toString('base64url')
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
      body: JSON.stringify({ raw: buildMime(email, fromAddress) }),
    })
    if (!res.ok) return { ok: false, error: `Gmail send failed: ${await res.text()}` }
    const data = (await res.json()) as { id?: string; threadId?: string }
    return { ok: true, externalId: data.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Gmail send exception' }
  }
}
