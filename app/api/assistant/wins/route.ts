import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const wins: Array<{ id: string; type: string; title: string; description: string; time: string }> = []

    // Five-star work orders
    try {
      const { data: wos } = await supabase
        .from('work_orders')
        .select('id, title, rating, completed_at')
        .gte('rating', 5)
        .gte('completed_at', since)
        .order('completed_at', { ascending: false })
        .limit(5)
      for (const wo of (wos ?? [])) {
        wins.push({
          id: `wo-${wo.id}`,
          type: 'five_star_wo',
          title: '⭐ 5-star rating received',
          description: wo.title ?? 'Work order completed',
          time: wo.completed_at,
        })
      }
    } catch { /* skip */ }

    // Deals closed won
    try {
      const since14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
      const { data: opps } = await supabase
        .from('opportunities')
        .select('id, name, amount, won_at')
        .eq('stage', 'won')
        .gte('won_at', since14)
        .order('won_at', { ascending: false })
        .limit(3)
      for (const opp of (opps ?? [])) {
        const amt = opp.amount ? ` · $${Number(opp.amount).toLocaleString()}` : ''
        wins.push({
          id: `opp-${opp.id}`,
          type: 'deal_closed',
          title: '🎉 Deal closed won',
          description: `${opp.name}${amt}`,
          time: opp.won_at ?? new Date().toISOString(),
        })
      }
    } catch { /* skip */ }

    // NEXUS wins feed (certs, tier-ups, quest completions)
    try {
      const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data: nexusWins } = await supabase
        .from('nexus_wins')
        .select('id, win_type, title, description, created_at')
        .gte('created_at', since30)
        .order('created_at', { ascending: false })
        .limit(5)
      for (const w of (nexusWins ?? [])) {
        wins.push({
          id: `nw-${w.id}`,
          type: w.win_type,
          title: w.title,
          description: w.description ?? '',
          time: w.created_at,
        })
      }
    } catch { /* skip */ }

    // Sort by time desc, cap at 8
    wins.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    return NextResponse.json({ wins: wins.slice(0, 8) })
  } catch (e) {
    console.error('[wins]', e)
    return NextResponse.json({ wins: [] })
  }
}
