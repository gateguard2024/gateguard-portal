import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser()
  const { id } = params

  // Allow caller to supply acknowledged_by (e.g. user's full name), else derive from user
  let acknowledgedBy: string
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    acknowledgedBy = typeof body.acknowledged_by === 'string' && body.acknowledged_by.trim()
      ? body.acknowledged_by.trim()
      : (user?.fullName ?? user?.email ?? 'Unknown')
  } catch {
    acknowledgedBy = user?.fullName ?? user?.email ?? 'Unknown'
  }

  const { data, error } = await supabase
    .from('incidents')
    .update({
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: acknowledgedBy,
    })
    .eq('id', id)
    .select('id, acknowledged_at, acknowledged_by')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ incident: data })
}
