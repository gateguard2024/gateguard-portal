/**
 * GateGuard centralized email sender.
 * Always sends from: GateGuard <noreply@gateguard.co>
 * Uses Resend via the HTTP API (same pattern as permit-reminders cron).
 * Never throws — returns { success: false, error } on any failure.
 */

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  replyTo?: string
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

export interface BatchEmail { to: string; subject: string; html: string; replyTo?: string }
export interface BatchResult { sent: { index: number; id?: string }[]; failed: { index: number; error: string }[] }

/**
 * Send up to 100 separate emails in ONE Resend call (/emails/batch) — each
 * recipient gets their own message. `idempotencyKey` makes a retried call a
 * no-op on Resend's side (so a timeout + retry never double-sends).
 * Never throws.
 */
export async function sendEmailBatch(emails: BatchEmail[], idempotencyKey?: string): Promise<BatchResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { sent: [], failed: emails.map((_, index) => ({ index, error: 'RESEND_API_KEY not configured' })) }
  if (!emails.length) return { sent: [], failed: [] }
  if (emails.length > 100) throw new Error('sendEmailBatch: max 100 per call')
  try {
    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey.slice(0, 256) } : {}),
      },
      body: JSON.stringify(emails.map(e => ({ from: 'GateGuard <noreply@gateguard.co>', to: [e.to], subject: e.subject, html: e.html, ...(e.replyTo ? { reply_to: e.replyTo } : {}) }))),
      signal: AbortSignal.timeout(20000),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json().catch(() => ({}))
    if (!res.ok) {
      const msg = data?.message ?? `Resend HTTP ${res.status}`
      console.error('[email-sender] batch error:', msg)
      return { sent: [], failed: emails.map((_, index) => ({ index, error: msg })) }
    }
    const ids: { id?: string }[] = Array.isArray(data?.data) ? data.data : []
    return { sent: emails.map((_, index) => ({ index, id: ids[index]?.id })), failed: [] }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown send error'
    console.error('[email-sender] batch failed:', message)
    return { sent: [], failed: emails.map((_, index) => ({ index, error: message })) }
  }
}
