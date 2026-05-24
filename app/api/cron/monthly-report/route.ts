/**
 * GET /api/cron/monthly-report
 * Vercel cron — runs on the 1st of every month at 9am UTC.
 * Generates a PDF monthly report for each site and emails it to the site's org contact.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateMonthlyReport, type ReportData } from '@/lib/monthly-report-pdf'
import { monthlyReportEmail } from '@/lib/email-templates'
import { sendEmail } from '@/lib/email-sender'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  /* ── Auth check ──────────────────────────────────────────────────── */
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  /* ── Date range: prior calendar month ───────────────────────────── */
  const now        = new Date()
  const priorMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const monthStart = new Date(priorMonth.getFullYear(), priorMonth.getMonth(), 1)
  const monthEnd   = new Date(priorMonth.getFullYear(), priorMonth.getMonth() + 1, 0, 23, 59, 59, 999)

  const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const monthSlug  = monthStart.toISOString().slice(0, 7)                // e.g. "2026-04"
  const periodStart = monthStart.toISOString().split('T')[0]
  const periodEnd   = monthEnd.toISOString().split('T')[0]

  console.log(`[monthly-report] Running for ${monthLabel} (${periodStart} – ${periodEnd})`)

  /* ── Fetch all sites with their org info ─────────────────────────── */
  const { data: sites, error: sitesError } = await supabase
    .from('sites')
    .select(`
      id,
      property_name,
      property_address,
      org_id,
      organizations (
        id,
        name,
        contact_email
      )
    `)

  if (sitesError) {
    console.error('[monthly-report] Failed to fetch sites:', sitesError.message)
    return NextResponse.json({ error: 'Failed to fetch sites', detail: sitesError.message }, { status: 500 })
  }

  if (!sites || sites.length === 0) {
    console.log('[monthly-report] No sites found — nothing to do.')
    return NextResponse.json({ ok: true, processed: 0, message: 'No sites found' })
  }

  /* ── Process each site ───────────────────────────────────────────── */
  let successCount = 0
  let errorCount   = 0
  const results: { site_id: string; site_name: string; sent: boolean; reason?: string }[] = []

  for (const site of sites) {
    const siteName    = site.property_name ?? 'Unknown Property'
    const siteAddress = site.property_address ?? ''
    const org         = Array.isArray(site.organizations)
      ? site.organizations[0]
      : site.organizations as { id: string; name: string; contact_email: string | null } | null

    const orgName     = org?.name ?? 'Unknown Organization'
    const contactEmail = org?.contact_email

    if (!contactEmail) {
      console.warn(`[monthly-report] Skipping site ${site.id} (${siteName}) — no contact email on org`)
      results.push({ site_id: site.id, site_name: siteName, sent: false, reason: 'no_contact_email' })
      errorCount++
      continue
    }

    try {
      /* ── Gather site data in parallel ──────────────────────────── */
      const [woResult, invResult, permitResult, assetResult] = await Promise.all([
        supabase
          .from('work_orders')
          .select('id, status, completed_at, tech_name, work_type')
          .eq('site_id', site.id)
          .eq('status', 'completed')
          .gte('completed_at', monthStart.toISOString())
          .lte('completed_at', monthEnd.toISOString()),

        supabase
          .from('invoices')
          .select('id, invoice_number, status, total, due_date')
          .eq('site_id', site.id)
          .in('status', ['sent', 'overdue', 'draft', 'paid']),

        supabase
          .from('permits')
          .select('id, permit_type, status, expiry_date')
          .eq('site_id', site.id),

        supabase
          .from('site_assets')
          .select('id, device_name, warranty_expires_at')
          .eq('site_id', site.id),
      ])

      if (woResult.error)     console.warn(`[monthly-report] WO query error for ${site.id}:`, woResult.error.message)
      if (invResult.error)    console.warn(`[monthly-report] Invoice query error for ${site.id}:`, invResult.error.message)
      if (permitResult.error) console.warn(`[monthly-report] Permit query error for ${site.id}:`, permitResult.error.message)
      if (assetResult.error)  console.warn(`[monthly-report] Asset query error for ${site.id}:`, assetResult.error.message)

      const workOrders = woResult.data     ?? []
      const invoices   = invResult.data    ?? []
      const permits    = permitResult.data ?? []
      const assets     = assetResult.data  ?? []

      /* ── Build summary for email body ──────────────────────────── */
      const openInvoices    = invoices.filter(i => ['sent', 'overdue'].includes(i.status))
      const permitsExpiring = permits.filter(p => {
        if (!p.expiry_date) return false
        const d = Math.ceil((new Date(p.expiry_date).getTime() - Date.now()) / 86_400_000)
        return d >= 0 && d <= 60
      })

      /* ── Generate PDF ──────────────────────────────────────────── */
      const reportData: ReportData = {
        siteName,
        siteAddress,
        orgName,
        month: monthLabel,
        reportPeriodStart: periodStart,
        reportPeriodEnd: periodEnd,
        workOrders,
        invoices,
        permits,
        assets,
      }

      const pdfBuffer = await generateMonthlyReport(reportData)
      const pdfBase64 = pdfBuffer.toString('base64')
      const filename  = `GateGuard-Report-${monthSlug}-${siteName.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`

      /* ── Send email via Resend ─────────────────────────────────── */
      const html = monthlyReportEmail(siteName, monthLabel, {
        wosCompleted:     workOrders.length,
        openInvoices:     openInvoices.length,
        permitsExpiring:  permitsExpiring.length,
      })

      const apiKey = process.env.RESEND_API_KEY
      if (!apiKey) {
        console.warn('[monthly-report] RESEND_API_KEY not set — skipping email send')
        results.push({ site_id: site.id, site_name: siteName, sent: false, reason: 'no_resend_key' })
        errorCount++
        continue
      }

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'GateGuard Reports <reports@gateguard.co>',
          to: [contactEmail],
          subject: `Your GateGuard Monthly Report — ${monthLabel} — ${siteName}`,
          html,
          attachments: [
            {
              filename,
              content: pdfBase64,
            },
          ],
        }),
      })

      if (!emailRes.ok) {
        const errData = await emailRes.json().catch(() => ({}))
        const msg = (errData as { message?: string }).message ?? `HTTP ${emailRes.status}`
        console.error(`[monthly-report] Resend error for ${siteName}:`, msg)
        results.push({ site_id: site.id, site_name: siteName, sent: false, reason: msg })
        errorCount++
      } else {
        console.log(`[monthly-report] ✓ Report sent for ${siteName} → ${contactEmail}`)
        results.push({ site_id: site.id, site_name: siteName, sent: true })
        successCount++
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[monthly-report] Unexpected error for site ${site.id} (${siteName}):`, message)
      results.push({ site_id: site.id, site_name: siteName, sent: false, reason: message })
      errorCount++
    }
  }

  console.log(`[monthly-report] Done — ${successCount} sent, ${errorCount} errors`)

  return NextResponse.json({
    ok: true,
    month: monthLabel,
    period: `${periodStart} – ${periodEnd}`,
    totalSites: sites.length,
    successCount,
    errorCount,
    results,
  })
}
