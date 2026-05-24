/**
 * GateGuard Monthly Client Report PDF Generator
 * Uses pdfkit to produce a US Letter portrait PDF for each site.
 * Returns a Buffer — call from the cron route and attach to Resend email.
 */
import PDFDocument from 'pdfkit'

/* ─── Types ──────────────────────────────────────────────────────────── */

export interface ReportWorkOrder {
  id: string
  completed_at: string | null
  tech_name: string | null
  work_type: string | null
  status: string | null
}

export interface ReportInvoice {
  id: string
  invoice_number: string | null
  status: string
  total: number | null
  due_date: string | null
}

export interface ReportPermit {
  id: string
  permit_type: string | null
  status: string | null
  expiry_date: string | null
}

export interface ReportAsset {
  id: string
  device_name: string | null
  warranty_expires_at: string | null
}

export interface ReportData {
  siteName: string
  siteAddress: string
  orgName: string
  month: string          // e.g. "May 2026"
  reportPeriodStart: string  // e.g. "2026-05-01"
  reportPeriodEnd: string    // e.g. "2026-05-31"
  workOrders: ReportWorkOrder[]
  invoices: ReportInvoice[]
  permits: ReportPermit[]
  assets: ReportAsset[]
}

/* ─── Color palette ──────────────────────────────────────────────────── */
const NAVY   = '#0B1728'
const BRAND  = '#6B7EFF'
const WHITE  = '#FFFFFF'
const GRAY   = '#94a3b8'
const DARK   = '#1e293b'
const BORDER = '#e2e8f0'
const LIGHT  = '#f8fafc'

/* ─── Helpers ────────────────────────────────────────────────────────── */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtCurrency(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function capitalize(s: string | null | undefined): string {
  if (!s) return '—'
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')
}

function daysUntil(iso: string | null | undefined): number {
  if (!iso) return 999
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

/* ─── Main generator ─────────────────────────────────────────────────── */
export async function generateMonthlyReport(data: ReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 50, bufferPages: true })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const W   = doc.page.width    // 612
    const M   = 50                // margin
    const CW  = W - M * 2        // content width = 512

    /* ── Header ──────────────────────────────────────────────────────── */
    const [nr, ng, nb] = hexToRgb(NAVY)
    doc.rect(0, 0, W, 80).fill([nr, ng, nb] as unknown as string)

    // "GateGuard" wordmark
    doc.font('Helvetica-Bold').fontSize(20).fillColor(WHITE)
    doc.text('Gate', M, 24, { continued: true })
    const [br, bg, bb] = hexToRgb(BRAND)
    doc.fillColor([br, bg, bb] as unknown as string).text('Guard', { continued: false })

    // Subtitle — month
    doc.font('Helvetica').fontSize(10).fillColor(GRAY)
    doc.text(`Monthly Client Report  ·  ${data.month}`, M, 52)

    // Move past header
    doc.y = 100

    /* ── Property Info ───────────────────────────────────────────────── */
    doc.font('Helvetica-Bold').fontSize(14).fillColor(DARK)
    doc.text(data.siteName, M, doc.y)
    doc.font('Helvetica').fontSize(10).fillColor(GRAY)
    doc.text(data.siteAddress || 'Address not on file', M, doc.y + 2)
    doc.text(`Report period: ${fmtDate(data.reportPeriodStart)} – ${fmtDate(data.reportPeriodEnd)}`, M, doc.y + 2)
    doc.text(`Prepared for: ${data.orgName}`, M, doc.y + 2)

    doc.moveDown(1.2)
    drawDivider(doc, M, CW, BORDER)
    doc.moveDown(0.8)

    /* ── Section 1: Service Summary ─────────────────────────────────── */
    sectionHeading(doc, '1  Service Summary', BRAND, M)

    if (data.workOrders.length === 0) {
      doc.font('Helvetica').fontSize(10).fillColor(GRAY)
      doc.text('No service visits this month.', M + 8, doc.y)
    } else {
      // Table header
      const cols = [
        { label: 'Date',    x: M + 8,   w: 90  },
        { label: 'Tech',    x: M + 108, w: 130 },
        { label: 'Type',    x: M + 248, w: 140 },
        { label: 'Status',  x: M + 398, w: 110 },
      ]
      tableHeader(doc, cols, doc.y, LIGHT, GRAY)

      for (const wo of data.workOrders) {
        const rowY = doc.y
        ensureSpace(doc, 20)
        doc.font('Helvetica').fontSize(9).fillColor(DARK)
        doc.text(fmtDate(wo.completed_at), cols[0].x, doc.y, { width: cols[0].w, lineBreak: false })
        doc.text(wo.tech_name || '—',      cols[1].x, doc.y, { width: cols[1].w, lineBreak: false })
        doc.text(capitalize(wo.work_type), cols[2].x, doc.y, { width: cols[2].w, lineBreak: false })
        doc.text(capitalize(wo.status),    cols[3].x, doc.y, { width: cols[3].w, lineBreak: false })
        doc.moveDown(0.7)
        drawDivider(doc, M + 8, CW - 8, BORDER)
      }
    }

    doc.moveDown(1)
    drawDivider(doc, M, CW, BORDER)
    doc.moveDown(0.8)

    /* ── Section 2: Asset Health ────────────────────────────────────── */
    sectionHeading(doc, '2  Asset Health', BRAND, M)

    const totalAssets = data.assets.length
    const expiringWarranty = data.assets.filter(a => {
      const d = daysUntil(a.warranty_expires_at)
      return d >= 0 && d <= 90
    })

    doc.font('Helvetica').fontSize(10).fillColor(DARK)
    doc.text(`Total installed assets: ${totalAssets}`, M + 8, doc.y)

    if (expiringWarranty.length > 0) {
      doc.moveDown(0.5)
      const [wr, wg, wb] = hexToRgb('#f59e0b')
      doc.font('Helvetica-Bold').fontSize(9).fillColor([wr, wg, wb] as unknown as string)
      doc.text(`⚠  ${expiringWarranty.length} asset(s) with warranty expiring within 90 days:`, M + 8, doc.y)
      doc.font('Helvetica').fontSize(9).fillColor(DARK)
      for (const a of expiringWarranty) {
        doc.text(`• ${a.device_name || 'Device'} — expires ${fmtDate(a.warranty_expires_at)}`, M + 16, doc.y + 2)
      }
    } else if (totalAssets > 0) {
      doc.font('Helvetica').fontSize(9).fillColor(GRAY)
      doc.text('All asset warranties are current (no expirations within 90 days).', M + 8, doc.y)
    }

    doc.moveDown(1)
    drawDivider(doc, M, CW, BORDER)
    doc.moveDown(0.8)

    /* ── Section 3: Compliance ──────────────────────────────────────── */
    sectionHeading(doc, '3  Compliance', BRAND, M)

    const totalPermits   = data.permits.length
    const expiringPermits = data.permits.filter(p => {
      const d = daysUntil(p.expiry_date)
      return d >= 0 && d <= 60
    })
    const expiredPermits = data.permits.filter(p => {
      const d = daysUntil(p.expiry_date)
      return d < 0
    })

    doc.font('Helvetica').fontSize(10).fillColor(DARK)
    doc.text(`Total permits on file: ${totalPermits}`, M + 8, doc.y)

    if (expiredPermits.length > 0) {
      doc.moveDown(0.4)
      const [rr, rg, rb] = hexToRgb('#ef4444')
      doc.font('Helvetica-Bold').fontSize(9).fillColor([rr, rg, rb] as unknown as string)
      doc.text(`✗  ${expiredPermits.length} EXPIRED permit(s) require immediate action:`, M + 8, doc.y)
      doc.font('Helvetica').fontSize(9).fillColor(DARK)
      for (const p of expiredPermits) {
        doc.text(`• ${capitalize(p.permit_type)} — expired ${fmtDate(p.expiry_date)}`, M + 16, doc.y + 2)
      }
    }

    if (expiringPermits.length > 0) {
      doc.moveDown(0.4)
      const [wr, wg, wb] = hexToRgb('#f59e0b')
      doc.font('Helvetica-Bold').fontSize(9).fillColor([wr, wg, wb] as unknown as string)
      doc.text(`⚠  ${expiringPermits.length} permit(s) expiring within 60 days:`, M + 8, doc.y)
      doc.font('Helvetica').fontSize(9).fillColor(DARK)
      for (const p of expiringPermits) {
        doc.text(`• ${capitalize(p.permit_type)} — expires ${fmtDate(p.expiry_date)}`, M + 16, doc.y + 2)
      }
    }

    if (expiredPermits.length === 0 && expiringPermits.length === 0 && totalPermits > 0) {
      doc.font('Helvetica').fontSize(9).fillColor(GRAY)
      doc.text('All permits are current.', M + 8, doc.y)
    }

    if (totalPermits === 0) {
      doc.font('Helvetica').fontSize(9).fillColor(GRAY)
      doc.text('No permits on file for this property.', M + 8, doc.y)
    }

    doc.moveDown(1)
    drawDivider(doc, M, CW, BORDER)
    doc.moveDown(0.8)

    /* ── Section 4: Billing Summary ─────────────────────────────────── */
    sectionHeading(doc, '4  Billing Summary', BRAND, M)

    const openInvoices = data.invoices.filter(i => ['sent', 'overdue'].includes(i.status))
    const totalOwed    = openInvoices.reduce((s, i) => s + (i.total ?? 0), 0)
    const nextDue      = openInvoices
      .filter(i => i.due_date)
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())[0]

    doc.font('Helvetica').fontSize(10).fillColor(DARK)

    if (openInvoices.length === 0) {
      doc.font('Helvetica').fontSize(10).fillColor(GRAY)
      doc.text('No outstanding invoices.', M + 8, doc.y)
    } else {
      const billingCols = [
        { label: 'Invoice #', x: M + 8,   w: 110 },
        { label: 'Status',   x: M + 128,  w: 90  },
        { label: 'Amount',   x: M + 228,  w: 100 },
        { label: 'Due Date', x: M + 338,  w: 130 },
      ]
      tableHeader(doc, billingCols, doc.y, LIGHT, GRAY)

      for (const inv of openInvoices) {
        ensureSpace(doc, 20)
        doc.font('Helvetica').fontSize(9).fillColor(DARK)
        doc.text(inv.invoice_number || inv.id.slice(0, 8), billingCols[0].x, doc.y, { width: billingCols[0].w, lineBreak: false })
        doc.text(capitalize(inv.status),   billingCols[1].x, doc.y, { width: billingCols[1].w, lineBreak: false })
        doc.text(fmtCurrency(inv.total),   billingCols[2].x, doc.y, { width: billingCols[2].w, lineBreak: false })
        doc.text(fmtDate(inv.due_date),    billingCols[3].x, doc.y, { width: billingCols[3].w, lineBreak: false })
        doc.moveDown(0.7)
        drawDivider(doc, M + 8, CW - 8, BORDER)
      }

      doc.moveDown(0.5)
      doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK)
      doc.text(`Total outstanding: ${fmtCurrency(totalOwed)}`, M + 8, doc.y)

      if (nextDue) {
        doc.font('Helvetica').fontSize(9).fillColor(GRAY)
        doc.text(`Next due date: ${fmtDate(nextDue.due_date)}`, M + 8, doc.y + 2)
      }
    }

    doc.moveDown(1.5)

    /* ── Footer on each page ─────────────────────────────────────────── */
    const range = doc.bufferedPageRange()
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i)
      const footerY = doc.page.height - 40
      const [gr, gg, gb] = hexToRgb(GRAY)
      doc.font('Helvetica').fontSize(8).fillColor([gr, gg, gb] as unknown as string)
      doc.text(
        `Generated by GateGuard Nexus  ·  portal.gateguard.co  ·  Page ${i - range.start + 1} of ${range.count}`,
        M,
        footerY,
        { width: CW, align: 'center' }
      )
    }

    doc.end()
  })
}

/* ─── Layout helpers ─────────────────────────────────────────────────── */

function sectionHeading(doc: PDFKit.PDFDocument, title: string, color: string, x: number): void {
  const [r, g, b] = hexToRgb(color)
  doc.font('Helvetica-Bold').fontSize(11).fillColor([r, g, b] as unknown as string)
  doc.text(title, x, doc.y)
  doc.moveDown(0.6)
}

function drawDivider(doc: PDFKit.PDFDocument, x: number, w: number, color: string): void {
  const [r, g, b] = hexToRgb(color)
  doc.moveTo(x, doc.y).lineTo(x + w, doc.y).strokeColor([r, g, b] as unknown as string).lineWidth(0.5).stroke()
}

interface TableCol { label: string; x: number; w: number }

function tableHeader(doc: PDFKit.PDFDocument, cols: TableCol[], y: number, bgColor: string, textColor: string): void {
  const totalW = cols[cols.length - 1].x + cols[cols.length - 1].w - cols[0].x
  const [br, bg, bb] = hexToRgb(bgColor)
  doc.rect(cols[0].x, y, totalW, 18).fill([br, bg, bb] as unknown as string)

  const [tr, tg, tb] = hexToRgb(textColor)
  doc.font('Helvetica-Bold').fontSize(8).fillColor([tr, tg, tb] as unknown as string)
  for (const col of cols) {
    doc.text(col.label.toUpperCase(), col.x + 2, y + 5, { width: col.w - 4, lineBreak: false })
  }
  doc.y = y + 22
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  const bottomMargin = 60
  if (doc.y + needed > doc.page.height - bottomMargin) {
    doc.addPage()
    doc.y = 50
  }
}
