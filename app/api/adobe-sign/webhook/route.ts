/**
 * Adobe Acrobat Sign webhook. Adobe verifies the endpoint by expecting the
 * X-AdobeSign-ClientId header echoed back (on both the registration GET/POST and
 * every event). On an event we update the matching esign_agreements row.
 * No Clerk auth — Adobe calls this; verified via the client-id echo.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizeAdobeStatus } from '@/lib/adobe-sign'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const CLIENT_ID = () => process.env.ADOBE_SIGN_WEBHOOK_CLIENT_ID || ''

function echo() {
  // Adobe requires the client id echoed back in this header with a 2xx.
  return new NextResponse(JSON.stringify({ xAdobeSignClientId: CLIENT_ID() }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'X-AdobeSign-ClientId': CLIENT_ID() },
  })
}

// Registration verification handshake.
export async function GET() { return echo() }

export async function POST(req: NextRequest) {
  // Registration POST verification also expects the echo (no body / intent header).
  const body = await req.json().catch(() => null)
  if (!body || body.event === undefined) {
    // Verification ping — just echo the client id.
    return echo()
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = body
    const agreementId = b.agreement?.id ?? b.agreementId ?? b.resource?.id
    const rawStatus = b.agreement?.status ?? b.event ?? b.eventType
    if (agreementId) {
      const status = normalizeAdobeStatus(rawStatus)
      await supabase.from('esign_agreements')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('agreement_id', String(agreementId))
    }
  } catch { /* never fail the webhook */ }

  return echo()
}
