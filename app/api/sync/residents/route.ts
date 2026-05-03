/**
 * GET /api/sync/residents
 *
 * Brivo → DB → UniFi resident reconciliation.
 *
 * Triggered by Vercel Cron (hourly) or manually by an admin.
 *
 * Auth: Bearer {CRON_SECRET}  (Vercel injects this automatically for cron jobs)
 *       OR Clerk admin session (for manual trigger from the portal UI)
 *
 * Query params:
 *   ?org_id=<uuid>   — sync a single org (omit to sync all)
 *   ?dry_run=1       — report what would change, don't write anything
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth }                      from '@clerk/nextjs/server'
import { syncAllResidents }          from '@/lib/resident-sync'

export const maxDuration = 300  // allow up to 5 min for large portfolios

export async function GET(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader  = req.headers.get('authorization') ?? ''
  const cronSecret  = process.env.CRON_SECRET
  const isCronCall  = cronSecret && authHeader === `Bearer ${cronSecret}`

  if (!isCronCall) {
    // Fall back to Clerk session auth (manual trigger from portal UI)
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const orgIdFilter = req.nextUrl.searchParams.get('org_id') ?? undefined
  const dryRun      = req.nextUrl.searchParams.get('dry_run') === '1'

  if (dryRun) {
    // Dry-run: just return which orgs would be synced
    const { createClient } = await import('@supabase/supabase-js')
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    let q = db
      .from('organizations')
      .select('id, name, brivo_site_id, unifi_host')
      .eq('status', 'active')
      .not('brivo_site_id', 'is', null)
      .not('brivo_username', 'is', null)

    if (orgIdFilter) q = q.eq('id', orgIdFilter)
    const { data: orgs } = await q

    return NextResponse.json({
      dry_run: true,
      would_sync: (orgs ?? []).map(o => ({
        org_id:        o.id,
        org_name:      o.name,
        brivo_site_id: o.brivo_site_id,
        unifi_enabled: !!o.unifi_host,
      })),
    })
  }

  // ── Run sync ──────────────────────────────────────────────────────────────
  const t0      = Date.now()
  const results = await syncAllResidents(orgIdFilter)

  const summary = {
    timestamp:   new Date().toISOString(),
    duration_ms: Date.now() - t0,
    orgs_synced: results.length,
    total: {
      upserted:    results.reduce((s, r) => s + r.upserted,    0),
      deactivated: results.reduce((s, r) => s + r.deactivated, 0),
      unifi_synced:results.reduce((s, r) => s + r.unifiSynced, 0),
      errors:      results.filter(r => r.error).length,
    },
    results,
  }

  console.log('[sync/residents] Complete:', JSON.stringify(summary.total))

  return NextResponse.json(summary, {
    status: summary.total.errors > 0 && results.length === summary.total.errors ? 500 : 200,
  })
}
