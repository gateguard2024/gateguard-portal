import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Webhook } from 'svix'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Resend uses Svix for webhook signing — verify with RESEND_WEBHOOK_SECRET
// Set this in Vercel env vars after creating the webhook in resend.com/webhooks
const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET ?? ''

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()

    // Verify webhook signature if secret is configured
    if (WEBHOOK_SECRET) {
      const svix_id        = req.headers.get('svix-id') ?? ''
      const svix_timestamp = req.headers.get('svix-timestamp') ?? ''
      const svix_signature = req.headers.get('svix-signature') ?? ''

      if (!svix_id || !svix_timestamp || !svix_signature) {
        return NextResponse.json({ error: 'Missing Svix headers' }, { status: 400 })
      }

      try {
        const wh = new Webhook(WEBHOOK_SECRET)
        wh.verify(body, {
          'svix-id':        svix_id,
          'svix-timestamp': svix_timestamp,
          'svix-signature': svix_signature,
        })
      } catch {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const event = JSON.parse(body)
    const { type, data } = event

    // data.email_id = Resend message ID, matches campaign_sends.resend_message_id
    const messageId: string | undefined = data?.email_id

    if (!messageId) {
      return NextResponse.json({ ok: true, skipped: 'no email_id' })
    }

    const now = new Date().toISOString()

    switch (type) {
      case 'email.delivered': {
        await supabase
          .from('campaign_sends')
          .update({ delivered_at: now, status: 'delivered' })
          .eq('resend_message_id', messageId)
          .eq('status', 'sent')  // only upgrade from sent → delivered
        break
      }

      case 'email.opened': {
        // Increment open count, set first open time if not already set, upgrade status
        const { data: existing } = await supabase
          .from('campaign_sends')
          .select('open_count, opened_at, show_lead_id, campaign_name')
          .eq('resend_message_id', messageId)
          .single()

        if (existing) {
          await supabase
            .from('campaign_sends')
            .update({
              status:     'opened',
              opened_at:  existing.opened_at ?? now,
              open_count: (existing.open_count ?? 0) + 1,
            })
            .eq('resend_message_id', messageId)

          // ── SCOUT: update lead scout_status so NEXUS can alert the rep ──
          if (existing.show_lead_id && existing.campaign_name === 'scout_aria') {
            const { data: lead } = await supabase
              .from('show_leads')
              .select('scout_opened_at')
              .eq('id', existing.show_lead_id)
              .single()

            // Only set scout_opened_at on first open
            if (lead && !lead.scout_opened_at) {
              await supabase
                .from('show_leads')
                .update({
                  scout_status:    'opened',
                  scout_opened_at: now,
                })
                .eq('id', existing.show_lead_id)
            }
          }
        }
        break
      }

      case 'email.clicked': {
        await supabase
          .from('campaign_sends')
          .update({ clicked_at: now })
          .eq('resend_message_id', messageId)
          .is('clicked_at', null)  // only set first click
        break
      }

      case 'email.bounced': {
        await supabase
          .from('campaign_sends')
          .update({ bounced_at: now, status: 'bounced' })
          .eq('resend_message_id', messageId)
        break
      }

      case 'email.complained': {
        await supabase
          .from('campaign_sends')
          .update({ complained_at: now, status: 'complained' })
          .eq('resend_message_id', messageId)
        break
      }

      default:
        // Unknown event type — ignore
        break
    }

    return NextResponse.json({ ok: true, type })
  } catch (err: any) {
    console.error('[campaign/webhook]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
