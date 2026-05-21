import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ─── Sentiment + outcome analysis via Claude Haiku ────────────────────────────
async function analyzeTranscript(transcript: string): Promise<{
  sentiment: string
  outcome: string
  summary: string
}> {
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: `You are analyzing a sales call transcript for a multifamily access control company.
Return ONLY valid JSON with no markdown, no explanation, no code block.
Schema: { "sentiment": "positive"|"neutral"|"negative"|"interested"|"not_interested", "outcome": "no_answer"|"voicemail"|"callback_requested"|"qualified"|"not_interested"|"transferred", "summary": "<one concise sentence describing the call>" }`,
      messages: [
        {
          role: 'user',
          content: `Analyze this call transcript:\n\n${transcript.slice(0, 4000)}`,
        },
      ],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const parsed = JSON.parse(text)
    return {
      sentiment: parsed.sentiment ?? 'neutral',
      outcome:   parsed.outcome   ?? 'no_answer',
      summary:   parsed.summary   ?? '',
    }
  } catch {
    return { sentiment: 'neutral', outcome: 'no_answer', summary: '' }
  }
}

// ─── POST /api/trinity/webhook ────────────────────────────────────────────────
// Receives POST from Twilio StatusCallback when a call completes.
// Twilio sends application/x-www-form-urlencoded.
//
// Relevant fields:
//   CallSid          — unique call identifier
//   CallStatus       — completed | busy | no-answer | failed | canceled
//   CallDuration     — seconds (string, present on completed)
//   Direction        — inbound | outbound-dial | outbound-api
//   To               — destination number
//   From             — originating number
//   RecordingUrl     — recording URL if recording was enabled (optional)
//   TranscriptionText— Twilio transcription if enabled (optional)
//
// NOTE: No auth check intentionally — Twilio webhook IP validation recommended
// in production. Add X-Twilio-Signature validation via twilio.validateRequest().

export async function POST(req: NextRequest) {
  let body: Record<string, string> = {}

  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await req.text()
    const params = new URLSearchParams(text)
    params.forEach((v, k) => { body[k] = v })
  } else {
    // Also accept JSON (for testing)
    body = await req.json().catch(() => ({}))
  }

  const callSid      = body['CallSid']      ?? body['call_sid']       ?? ''
  const callStatus   = body['CallStatus']   ?? body['call_status']    ?? 'completed'
  const callDuration = parseInt(body['CallDuration'] ?? body['duration'] ?? '0', 10)
  const direction    = body['Direction']    ?? body['direction']      ?? 'outbound'
  const to           = body['To']           ?? body['to']             ?? ''
  const from         = body['From']         ?? body['from']           ?? ''
  const recordingUrl = body['RecordingUrl'] ?? body['recording_url']  ?? null
  const transcript   = body['TranscriptionText'] ?? body['transcript'] ?? null

  if (!callSid) {
    return NextResponse.json({ error: 'Missing CallSid' }, { status: 400 })
  }

  // Determine phone number (outbound → To, inbound → From)
  const normalizedDirection = direction.startsWith('inbound') ? 'inbound' : 'outbound'
  const phoneNumber = normalizedDirection === 'inbound' ? from : to

  // Map Twilio status → our outcome
  const outcomeMap: Record<string, string> = {
    'no-answer': 'no_answer',
    'busy':      'no_answer',
    'failed':    'no_answer',
    'canceled':  'no_answer',
    'completed': 'no_answer', // refined below if transcript available
  }
  let outcome = outcomeMap[callStatus] ?? 'no_answer'
  let sentiment = 'neutral'
  let aiSummary = ''

  // Run AI analysis if we have a transcript
  if (transcript && transcript.trim().length > 20) {
    const analysis = await analyzeTranscript(transcript)
    sentiment = analysis.sentiment
    outcome   = analysis.outcome
    aiSummary = analysis.summary
  } else if (callStatus === 'completed' && callDuration > 5) {
    outcome = 'transferred' // placeholder — real outcome requires transcript
  }

  // Check if a row was pre-created by /api/trinity/initiate (match by CallSid)
  const { data: existing } = await supabase
    .from('trinity_calls')
    .select('id')
    .eq('twilio_call_sid', callSid)
    .maybeSingle()

  if (existing?.id) {
    // Update the existing row with completed call data
    await supabase
      .from('trinity_calls')
      .update({
        duration_seconds: callDuration,
        transcript,
        sentiment,
        outcome,
        ai_summary:    aiSummary,
        recording_url: recordingUrl,
        updated_at:    new Date().toISOString(),
      })
      .eq('id', existing.id)
  } else {
    // Insert a new row (inbound call or outbound not pre-created)
    await supabase
      .from('trinity_calls')
      .insert({
        direction:        normalizedDirection,
        phone_number:     phoneNumber,
        duration_seconds: callDuration,
        transcript,
        sentiment,
        outcome,
        ai_summary:    aiSummary,
        recording_url: recordingUrl,
        twilio_call_sid: callSid,
      })
  }

  // Twilio expects a 200 response (TwiML or plain 200)
  return new NextResponse('<Response></Response>', {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  })
}
