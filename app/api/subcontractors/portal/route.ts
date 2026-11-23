import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// POST /api/subcontractors/portal — RETIRED (Nov 23 2026).
// The old access-code portal handed a vendor every column of every job assigned to them
// (customer, billing, internal notes). Vendors now get one private link per job
// (/v/<secret>, lib/vendor-jobs.ts, migration 239) that shows only what they need.
export async function POST() {
  return NextResponse.json({ error: 'This page has moved. Gate Guard now sends each job as its own link by text or email — use the latest link you were sent.' }, { status: 410 })
}
