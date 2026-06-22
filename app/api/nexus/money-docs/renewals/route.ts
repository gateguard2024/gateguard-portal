import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// The legacy `customers` / `companies` / `properties` tables were retired in the
// June 2026 database audit (they were never written to). Contract renewals will be
// rebuilt on the canonical sites + site-lifecycle model. Until then this returns an
// empty list so the Money/Docs renewals panel renders cleanly with no dead reads.
export async function GET() {
  return NextResponse.json({ success: true, renewals: [] })
}
