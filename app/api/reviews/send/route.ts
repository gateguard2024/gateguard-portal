import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// POST /api/reviews/send — create review request + send SMS
// Called fire-and-forget from maintenance PATCH on completion
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      work_order_id, org_id, technician_id,
      reviewer_name, reviewer_phone,
      wo_number, property_name,
    } = body

    if (!work_order_id) {
      return NextResponse.json({ error: 'work_order_id required' }, { status: 400 })
    }

    // Create the review record
    const { data: review, error: insertErr } = await supabase
      .from('work_order_reviews')
      .insert({
        work_order_id,
        org_id:        org_id ?? null,
        technician_id: technician_id ?? null,
        reviewer_name: reviewer_name ?? null,
        reviewer_phone: reviewer_phone ?? null,
        sms_sent_at:   reviewer_phone ? new Date().toISOString() : null,
      })
      .select()
      .single()

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    // Send SMS via Twilio (if configured and phone is available)
    const twilioSid   = process.env.TWILIO_ACCOUNT_SID
    const twilioAuth  = process.env.TWILIO_AUTH_TOKEN
    const twilioFrom  = process.env.TWILIO_FROM_NUMBER
    const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.gateguard.co'

    if (twilioSid && twilioAuth && twilioFrom && reviewer_phone) {
      const name        = reviewer_name ?? 'there'
      const reviewLink  = `${appUrl}/reviews/respond/${review.id}`
      const message     = `Hi ${name}, your recent service${wo_number ? ` (${wo_number})` : ''}${property_name ? ` at ${property_name}` : ''} by GateGuard is complete. How did we do? Reply 1-5 to rate your experience or visit: ${reviewLink}`

      try {
        const formData = new URLSearchParams()
        formData.set('From', twilioFrom)
        formData.set('To', reviewer_phone)
        formData.set('Body', message)

        const twilioRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
          {
            method:  'POST',
            headers: {
              'Authorization': 'Basic ' + Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64'),
              'Content-Type':  'application/x-www-form-urlencoded',
            },
            body: formData.toString(),
          }
        )

        if (twilioRes.ok) {
          const twilioData = await twilioRes.json() as { sid?: string }
          // Update record with SMS SID
          await supabase
            .from('work_order_reviews')
            .update({ sms_sid: twilioData.sid ?? null })
            .eq('id', review.id)
        }
      } catch (_) { /* SMS failure is non-fatal */ }
    }

    return NextResponse.json({ review }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
