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
import type { PartnershipConfig } from '@/lib/partnership-proposal'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Quote = Record<string, any>

export async function agreementPdfBuffer(quote: Quote, cfg: PartnershipConfig = {}): Promise<Buffer> {
  const doc = buildPartnershipAgreement(quote, cfg)
  return await new Promise<Buffer>((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'LETTER', margin: 54 })
    const chunks: Buffer[] = []
    pdf.on('data', (c: Buffer) => chunks.push(c))
    pdf.on('end', () => resolve(Buffer.concat(chunks)))
    pdf.on('error', reject)
    pdf.fontSize(16).fillColor('#0B1728').text(doc.title)
    pdf.moveDown(0.2)
    pdf.fontSize(10).fillColor('#5a708c').text(doc.subtitle)
    pdf.moveDown(0.7)
    for (const s of doc.sections) {
      pdf.fontSize(11).fillColor('#17293e').text(s.h)
      pdf.moveDown(0.15)
      pdf.fontSize(9.5).fillColor('#33465c').text(s.p, { align: 'left', lineGap: 1.5 })
      pdf.moveDown(0.5)
    }
    pdf.end()
  })
}
