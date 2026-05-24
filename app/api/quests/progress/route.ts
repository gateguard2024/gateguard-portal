import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Demo progress — will be wired to real Supabase data once quest_progress table is populated
  return NextResponse.json({
    progress: {
      q_surveys_5:    2,
      q_quotes_3:     1,
      q_zero_overdue: 1,   // 1 = on track (no overdue WOs)
      q_certs_2:      1,
      q_five_star_5:  3,
    },
    totalPoints: 850,
  })
}
