// lib/gmail.ts — RFC 2822 MIME helpers for Gmail reply/forward sends.
//
// Adapted to Nexus's stack: no `googleapis` dependency and no request-body
// tokens. The /api/gmail/send route resolves the user's stored Gmail OAuth
// refresh token from `message_channels` and exchanges it via
// lib/mail-send.getGmailAccessToken. This module only builds the MIME payload.

export interface MimeInput {
  from: string
  to: string
  subject: string
  bodyHtml: string
  inReplyTo?: string | null
  references?: string | null
}

// Build an RFC 2822 message and base64url-encode it for gmail.users.messages.send.
export function createMimeMessage(input: MimeInput): string {
  const headers = [
    `From: ${input.from}`,
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    'Content-Type: text/html; charset="UTF-8"',
    'MIME-Version: 1.0',
  ]
  if (input.inReplyTo) {
    headers.push(`In-Reply-To: ${input.inReplyTo}`)
    headers.push(`References: ${input.references || input.inReplyTo}`)
  }
  const raw = `${headers.join('\r\n')}\r\n\r\n${input.bodyHtml}`
  return Buffer.from(raw).toString('base64url')
}

// Wrap the composed message body + append the user's signature block as HTML.
export function wrapHtmlBody(messageBody: string, signature?: string): string {
  const body = (messageBody ?? '').replace(/\n/g, '<br/>')
  const sig = signature && signature.trim()
    ? `<div style="border-top:1px solid #cbd5e1;padding-top:10px;margin-top:20px;color:#475569;font-size:12px;">${signature.replace(/\n/g, '<br/>')}</div>`
    : ''
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1e293b;font-size:14px;line-height:1.6;">${body}${sig}</div>`
}
