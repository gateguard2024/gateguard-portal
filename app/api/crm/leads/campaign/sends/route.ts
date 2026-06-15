import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

// GET /api/crm/leads/campaign/sends
// Returns the latest campaign_sends record per lead so the CRM list can show
// sent / opened / bounced / failed badges
export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUser()
    // Campaign history over the GLOBAL show-lead pool — corporate only.
    if (!user.isCorporate) return NextResponse.json({ error: 'Campaigns are run by the corporate marketing team.' }, { status: 403 })

    // One row per lead — latest send record
    const { data, error } = await supabase
      .from('campaign_sends')
      .select('show_lead_id, status, sent_at, opened_at, open_count, bounced_at, error_message, resend_message_id')
      .eq('campaign_name', 'show_follow_up')
      .order('sent_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Deduplicate: keep the most-interesting record per lead
    // Priority: opened > delivered > sent > failed > bounced
    const priority: Record<string, number> = {
      opened:     5,
      clicked:    4,
      delivered:  3,
      sent:       2,
      failed:     1,
      bounced:    0,
      complained: 0,
    }

    const best = new Map<string, any>()
    for (const row of (data || [])) {
      if (!row.show_lead_id) continue
      const existing = best.get(row.show_lead_id)
      const rowPri   = priority[row.status] ?? 0
      const exPri    = existing ? (priority[existing.status] ?? 0) : -1
      if (rowPri > exPri) best.set(row.show_lead_id, row)
    }

    return NextResponse.json(Object.fromEntries(best))
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
