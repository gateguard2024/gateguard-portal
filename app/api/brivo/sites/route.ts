import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { allowedBrivoSites } from '@/lib/brivo-scope'

export const dynamic = 'force-dynamic'

// GET /api/brivo/sites — Brivo sites this caller may view (scoped by org).
export async function GET() {
  try {
    const user = await getCurrentUser()
    const sites = await allowedBrivoSites(user)
    return NextResponse.json({ sites })
  } catch (e) {
    return NextResponse.json({ sites: [], error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}
