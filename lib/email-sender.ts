/**
 * GateGuard centralized email sender.
 * Always sends from: GateGuard <noreply@gateguard.co>
 * Uses Resend via the HTTP API (same pattern as permit-reminders cron).
 * Never throws — returns { success: false, error } on any failure.
 */

export interface EmailAttachment {
  filename: string
  content: string // base64-encoded content
}

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  replyTo?: string
  attachments?: EmailAttachment[]
}

export interface SendEmailResult {
  success: boolean
  id?: string
  error?: string
}

export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email-sender] RESEND_API_KEY not set — email not sent')
    return { success: false, error: 'RESEND_API_KEY not configured' }
  }

  const toAddresses = Array.isArray(opts.to) ? opts.to : [opts.to]

  try {
    const payload: Record<string, unknown> = {
      from: 'GateGuard <noreply@gateguard.co>',
      to: toAddresses,
      subject: opts.subject,
      html: opts.html,
    }
    if (opts.replyTo) {
      payload.reply_to = opts.replyTo
    }
    if (opts.attachments && opts.attachments.length > 0) {
      payload.attachments = opts.attachments
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      const errMsg = (data as any)?.message ?? `Resend HTTP ${res.status}`
      console.error('[email-sender] Resend error:', errMsg)
      return { success: false, error: errMsg }
    }

    return { success: true, id: (data as any)?.id }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown send error'
    console.error('[email-sender] Unexpected error:', message)
    return { success: false, error: message }
  }
}
