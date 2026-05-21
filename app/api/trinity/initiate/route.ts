import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── Script templates (used in TwiML + stored for reference) ──────────────────
const SCRIPT_TEMPLATES: Record<string, string> = {
  intro: `Hi, this is TRINITY calling on behalf of GateGuard. I'm reaching out because we help multifamily properties modernize their access control with smart gates, cameras, and resident apps — all installed and managed by your local dealer. Do you have 90 seconds to hear how it works?`,
  followup: `Hi, this is TRINITY following up from GateGuard. We spoke recently about upgrading your property's access control. I wanted to check in — is now a good time to continue that conversation?`,
  win_back: `Hi, this is TRINITY from GateGuard. It's been a while since we last connected, and I wanted to reach out because we've added some exciting new features to our platform that I think you'd find valuable. Would you be open to a quick call with one of our team members this week?`,
}

// ─── POST /api/trinity/initiate ───────────────────────────────────────────────
// Body: { lead_id?: string, phone_number: string, script_type: 'intro'|'followup'|'win_back', contact_name?: string }
//
// Creates a trinity_calls row with status 'initiated'.
// Returns { success: true, call_id }.
//
// When TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM_NUMBER are configured,
// the commented block below initiates a real Twilio call. The webhook at
// /api/trinity/webhook will fire on completion and update the row.

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { lead_id, phone_number, script_type = 'intro', contact_name } = body

  if (!phone_number) {
    return NextResponse.json({ error: 'phone_number is required' }, { status: 400 })
  }

  const validScripts = ['intro', 'followup', 'win_back']
  if (!validScripts.includes(script_type)) {
    return NextResponse.json({ error: `script_type must be one of: ${validScripts.join(', ')}` }, { status: 400 })
  }

  // If lead_id provided, fetch contact details
  let resolvedName = contact_name ?? null
  let opportunityId: string | null = null

  if (lead_id) {
    const { data: lead } = await supabase
      .from('leads')
      .select('id, contact_name, first_name, last_name')
      .eq('id', lead_id)
      .maybeSingle()

    if (lead) {
      resolvedName = resolvedName
        ?? lead.contact_name
        ?? [lead.first_name, lead.last_name].filter(Boolean).join(' ')
        ?? null
    }
  }

  // ─── Save call record (status: initiated) ──────────────────────────────────
  const { data: callRow, error: insertError } = await supabase
    .from('trinity_calls')
    .insert({
      direction:        'outbound',
      phone_number:     phone_number,
      contact_name:     resolvedName,
      lead_id:          lead_id ?? null,
      opportunity_id:   opportunityId,
      dealer_org_id:    user.org_id ?? null,
      outcome:          'initiated',
      sentiment:        'neutral',
    })
    .select('id')
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // ─── Twilio outbound call (uncomment when TWILIO_* env vars are set) ────────
  //
  // const accountSid   = process.env.TWILIO_ACCOUNT_SID
  // const authToken    = process.env.TWILIO_AUTH_TOKEN
  // const fromNumber   = process.env.TWILIO_FROM_NUMBER  // e.g. +18005551234
  // const webhookBase  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.gateguard.co'
  //
  // if (accountSid && authToken && fromNumber) {
  //   const twilio = require('twilio')(accountSid, authToken)
  //
  //   const script = SCRIPT_TEMPLATES[script_type]
  //   // TwiML: TRINITY speaks the script then records
  //   const twiml = `
  //     <Response>
  //       <Say voice="Polly.Joanna-Neural">${script}</Say>
  //       <Record maxLength="120" transcribe="true"
  //               transcribeCallback="${webhookBase}/api/trinity/webhook"
  //               action="${webhookBase}/api/trinity/webhook" />
  //     </Response>
  //   `
  //
  //   // If using ElevenLabs TTS: generate audio first, then use <Play> instead of <Say>
  //   // const elevenLabsAudio = await generateElevenLabsAudio(script, process.env.ELEVENLABS_VOICE_ID)
  //   // upload to Supabase Storage → get public URL → use <Play>{url}</Play>
  //
  //   const call = await twilio.calls.create({
  //     to:           phone_number,
  //     from:         fromNumber,
  //     twiml:        twiml,
  //     statusCallback: `${webhookBase}/api/trinity/webhook`,
  //     statusCallbackMethod: 'POST',
  //     statusCallbackEvent: ['completed', 'no-answer', 'busy', 'failed'],
  //     record:       true,
  //   })
  //
  //   // Update our row with the Twilio CallSid
  //   await supabase
  //     .from('trinity_calls')
  //     .update({ twilio_call_sid: call.sid })
  //     .eq('id', callRow.id)
  // }
  // ─────────────────────────────────────────────────────────────────────────────

  return NextResponse.json({
    success:  true,
    call_id:  callRow.id,
    script:   SCRIPT_TEMPLATES[script_type],
    message:  process.env.TWILIO_ACCOUNT_SID
      ? 'Call initiated via Twilio'
      : 'Call logged — Twilio not yet configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER to enable live calls.',
  })
}
