import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// POST /api/billing/send-reminder
// Stub — logs the reminder request. Wire to Resend email when ready.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { invoice_id, invoice_number, client_name, amount } = body

  console.log('[send-reminder] Reminder requested', { invoice_id, invoice_number, client_name, amount })

  // TODO: wire to Resend email template when RESEND_API_KEY is configured
  // import { sendEmail } from '@/lib/email-sender'
  // import { generateInvoiceEmail } from '@/lib/email-templates'
  // await sendEmail({ to: clientEmail, subject: ..., html: ... })

  return NextResponse.json({ ok: true, message: 'Reminder queued (stub)' })
}
