/**
 * lib/partnership-agreement-pdf.ts — SERVER-ONLY. Renders the partnership service
 * agreement to a PDF Buffer (for email attachment) via pdfkit.
 *
 * Kept separate from lib/partnership-agreement.ts on purpose: that module is
 * imported by a client component (PartnershipAgreement.tsx), and pulling pdfkit
 * (which needs Node's `fs`) into the client bundle breaks the webpack build.
 * Only server routes may import this file.
 */
import PDFDocument from 'pdfkit'
import { buildPartnershipAgreement } from '@/lib/partnership-agreement'
import { resolvePartnership, money, type PartnershipConfig } from '@/lib/partnership-proposal'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Quote = Record<string, any>

const NAVY = '#12233b', MUT = '#5a6c84', BODY = '#27364a', CYAN = '#2f7fb8', INK = '#1a2432', LINE = '#e5ebf1'

export async function agreementPdfBuffer(quote: Quote, cfg: PartnershipConfig = {}): Promise<Buffer> {
  const doc = buildPartnershipAgreement(quote, cfg)
  const r = resolvePartnership(quote, cfg)
  const resident = r.billingMode === 'resident'
  const dateStr = new Date(quote?.sent_at || quote?.created_at || Date.now())
    .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  return await new Promise<Buffer>((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'LETTER', margin: 54 })
    const chunks: Buffer[] = []
    pdf.on('data', (c: Buffer) => chunks.push(c))
    pdf.on('end', () => resolve(Buffer.concat(chunks)))
    pdf.on('error', reject)

    const L = pdf.page.margins.left
    const R = pdf.page.width - pdf.page.margins.right
    const W = R - L
    const rule = (color: string, w = 1) => { const y = pdf.y; pdf.moveTo(L, y).lineTo(R, y).strokeColor(color).lineWidth(w).stroke(); pdf.y = y + 1 }

    // Letterhead
    const top = pdf.y
    pdf.font('Helvetica-Bold').fontSize(18).fillColor(NAVY).text('GATEGUARD', L, top)
    pdf.font('Helvetica').fontSize(8.5).fillColor(MUT).text(
      'Gate Guard, LLC · 980 Hammond Drive, Ste. 200 · Atlanta, GA 30328\n844-4MY-GATE | (770) 776-8095 · rfeldman@gateguard.co',
      L, top + 1, { align: 'right', width: W }
    )
    pdf.moveDown(0.6)
    rule(CYAN, 2)
    pdf.moveDown(0.8)

    // Title block
    pdf.font('Helvetica').fontSize(9).fillColor(MUT).text(dateStr)
    pdf.moveDown(0.2)
    pdf.font('Helvetica-Bold').fontSize(16).fillColor(NAVY).text(doc.title)
    pdf.moveDown(0.1)
    pdf.font('Helvetica').fontSize(10).fillColor(MUT).text(doc.subtitle)
    pdf.moveDown(0.6)

    // Terms summary strip (3 cells), mirrors the proposal.
    const ty = pdf.y, cw = (W - 20) / 3
    const strip = (x: number, label: string, big: string, sub: string, dark: boolean) => {
      pdf.roundedRect(x, ty, cw, 54, 6).lineWidth(1)
      if (dark) pdf.fillAndStroke(NAVY, NAVY); else pdf.fillAndStroke('#ffffff', LINE)
      pdf.font('Helvetica-Bold').fontSize(7.5).fillColor(dark ? '#7fc4ec' : CYAN).text(label.toUpperCase(), x + 10, ty + 9, { width: cw - 20, characterSpacing: 0.5 })
      pdf.font('Helvetica-Bold').fontSize(16).fillColor(dark ? '#ffffff' : NAVY).text(big, x + 10, ty + 20, { width: cw - 20 })
      pdf.font('Helvetica').fontSize(7.5).fillColor(dark ? '#b9c6d6' : MUT).text(sub, x + 10, ty + 40, { width: cw - 20 })
    }
    strip(L, 'One-time set-up', money(r.setupFee), `${money(r.deposit)} signing · ${money(r.goLive)} Go-Live`, false)
    strip(L + cw + 10, 'Ongoing to property', resident ? '$0' : money(r.propertyMonthly) + '/mo', resident ? 'No monthly fee' : 'Billed in bulk', false)
    strip(L + (cw + 10) * 2, r.residentFeeLabel, resident ? money(r.residentFee) : '$0', resident ? 'Per unit · signing + renewal' : '', true)
    pdf.y = ty + 54
    pdf.moveDown(0.8)

    // Sections — first (plain English) as a tinted lead card; numbered sections get a chip.
    doc.sections.forEach((s, i) => {
      const m = s.h.match(/^(\d+)\.\s*(.*)$/)
      if (i === 0) {
        const startY = pdf.y
        pdf.font('Helvetica-Bold').fontSize(9).fillColor(CYAN).text(s.h.toUpperCase(), L + 12, startY + 10, { width: W - 24 })
        pdf.moveDown(0.2)
        pdf.font('Helvetica').fontSize(9.5).fillColor(BODY).text(s.p, L + 12, pdf.y, { width: W - 24, lineGap: 2 })
        const endY = pdf.y + 10
        pdf.roundedRect(L, startY, W, endY - startY, 8).lineWidth(1).stroke(LINE)
        pdf.y = endY + 10
        return
      }
      if (m) {
        const hy = pdf.y
        pdf.roundedRect(L, hy, 18, 14, 4).fill(CYAN)
        pdf.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff').text(m[1], L, hy + 3, { width: 18, align: 'center' })
        pdf.font('Helvetica-Bold').fontSize(11).fillColor(NAVY).text(m[2], L + 24, hy + 1, { width: W - 24 })
        pdf.y = Math.max(pdf.y, hy + 16)
      } else {
        pdf.font('Helvetica-Bold').fontSize(11).fillColor(NAVY).text(s.h)
      }
      pdf.moveDown(0.2)
      pdf.font('Helvetica').fontSize(9.5).fillColor(BODY).text(s.p, { align: 'left', lineGap: 2 })
      pdf.moveDown(0.7)
    })

    // Signatures
    pdf.moveDown(0.3)
    rule(CYAN, 2)
    pdf.moveDown(0.6)
    pdf.font('Helvetica-Bold').fontSize(11).fillColor(NAVY).text('Signatures')
    pdf.moveDown(0.8)
    const sig = (who: string, name: string, org: boolean) => {
      pdf.font('Helvetica-Bold').fontSize(9).fillColor(MUT).text(who.toUpperCase())
      pdf.moveDown(1.4)
      const y = pdf.y
      pdf.moveTo(L, y).lineTo(L + 260, y).strokeColor(INK).lineWidth(0.8).stroke()
      pdf.y = y + 2
      pdf.font('Helvetica').fontSize(8).fillColor(MUT).text('Signature')
      pdf.moveDown(0.3)
      pdf.fontSize(9.5).fillColor(INK).text(
        `Name: ${name || '____________________'}\nTitle: ____________________${org ? '\nOrganization: ____________________' : ''}\nDate: ____________________`,
        { lineGap: 2 }
      )
      pdf.moveDown(0.9)
    }
    sig('Gate Guard, LLC', 'Russel Feldman', false)
    sig('Customer', '', true)

    pdf.end()
  })
}
