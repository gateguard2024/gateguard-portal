/**
 * lib/partnership-proposal-pdf.ts — SERVER-ONLY. Renders the Property Partnership
 * proposal letter to a PDF Buffer (for email attachment) via pdfkit, from the same
 * resolved model the on-screen proposal + email body use. Keep out of client bundles.
 */
import PDFDocument from 'pdfkit'
import { resolvePartnership, money, type PartnershipConfig } from '@/lib/partnership-proposal'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Quote = Record<string, any>
const NAVY = '#12233b', MUT = '#5a6c84', BODY = '#27364a', CYAN = '#2f7fb8', INK = '#1a2432', GREEN = '#12855f', LINE = '#e5ebf1'

export async function proposalPdfBuffer(quote: Quote, cfg: PartnershipConfig = {}): Promise<Buffer> {
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
    const H = (t: string) => { pdf.moveDown(0.5); pdf.font('Helvetica-Bold').fontSize(11).fillColor(CYAN).text(t.toUpperCase(), { characterSpacing: 0.6 }); pdf.moveDown(0.2) }
    const p = (t: string) => { pdf.font('Helvetica').fontSize(10).fillColor(BODY).text(t, { lineGap: 2 }); pdf.moveDown(0.3) }
    const check = (t: string) => { const y = pdf.y; pdf.font('Helvetica-Bold').fontSize(11).fillColor(GREEN).text('•', L, y, { width: 14 }); pdf.font('Helvetica').fontSize(10).fillColor(BODY).text(t, L + 16, y, { width: W - 16, lineGap: 1 }); pdf.moveDown(0.25) }

    // Letterhead
    const top = pdf.y
    pdf.font('Helvetica-Bold').fontSize(16).fillColor(NAVY).text('GATEGUARD', L, top)
    pdf.font('Helvetica').fontSize(8.5).fillColor(MUT).text('Gate Guard, LLC · 980 Hammond Drive, Ste. 200 · Atlanta, GA 30328\n844-4MY-GATE | (770) 776-8095 · rfeldman@gateguard.co', L, top + 1, { align: 'right', width: W })
    pdf.moveDown(0.6); rule(CYAN, 2); pdf.moveDown(0.6)

    pdf.font('Helvetica').fontSize(9).fillColor(MUT).text(dateStr)
    pdf.moveDown(0.2)
    if (r.contactName) pdf.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(`${r.contactName}${r.contactTitle ? `, ${r.contactTitle}` : ''}`)
    pdf.font('Helvetica').fontSize(10).fillColor(BODY).text(`${r.property}${r.managementCo ? ` — ${r.managementCo}` : ''}`)
    if (r.address) pdf.font('Helvetica').fontSize(10).fillColor(BODY).text(r.address)
    pdf.moveDown(0.5)
    pdf.font('Helvetica-Bold').fontSize(12).fillColor(INK).text('RE: Proposal — GateGuard Property Partnership Program')
    pdf.font('Helvetica').fontSize(9.5).fillColor(MUT).text(`Gate, access control, and resident technology management for ${r.property}`)
    pdf.moveDown(0.5)

    p(`Dear ${r.contactFirst},`)
    p(`Thank you for your time and for walking me through ${r.propertyShort}. This is our proposal to take over ${r.accessPoints ? `all ${r.accessPoints} openings` : 'the gates'}${r.openingsBreakdown ? ` — ${r.openingsBreakdown} —` : ' '} together with the access control${r.camerasIncluded ? ', cameras,' : ','} monitoring, and resident support behind them, under our Property Partnership model.`)
    p(`The structure is different from every gate quote you've received. The property pays a single, one-time set-up fee of ${money(r.setupFee)}${r.setupNote ? ` — ${r.setupNote}` : ''}, half at signing and half at Go-Live. ${resident ? `After that, GateGuard does not invoice the property again. The program is funded by residents through a parking & amenity fee of ${money(r.residentFee)} per unit, billed and collected by us at each lease signing and renewal.` : `After that, the property covers the program at a flat ${money(r.propertyMonthly)} per month, billed in bulk.`}`)

    // Terms
    H('The terms')
    const ty = pdf.y, cw = (W - 20) / 3
    const termCell = (x: number, label: string, big: string, sub: string) => {
      pdf.font('Helvetica-Bold').fontSize(8).fillColor(MUT).text(label.toUpperCase(), x, ty, { width: cw })
      pdf.font('Helvetica-Bold').fontSize(16).fillColor(NAVY).text(big, x, ty + 12, { width: cw })
      pdf.font('Helvetica').fontSize(8.5).fillColor(MUT).text(sub, x, ty + 34, { width: cw })
    }
    termCell(L, 'One-time set-up', money(r.setupFee), `${money(r.deposit)} at signing · ${money(r.goLive)} at Go-Live`)
    termCell(L + cw + 10, 'Ongoing to property', resident ? '$0' : money(r.propertyMonthly) + '/mo', resident ? 'No monthly fee or service calls' : 'Billed in bulk')
    termCell(L + (cw + 10) * 2, r.residentFeeLabel, resident ? money(r.residentFee) : '$0', resident ? 'Per unit, at lease signing + renewal' : '')
    pdf.y = ty + 62

    // Delivers
    H('What GateGuard delivers')
    check(`All ${r.accessPoints} access points brought online and kept that way — parts, welding, and operator repair at install, in the set-up fee with no change orders.`)
    check(`Every repair for the full ${r.termYears}-year term — parts, labor, trip charges, and monthly preventative maintenance.`)
    check('Mobile access with PMS integration — no fobs or cards; move-ins and move-outs sync with Yardi, Entrata, or RealPage.')
    if (r.camerasIncluded && r.cameras > 0) check(`${r.cameras} monitored camera${r.cameras === 1 ? '' : 's'}${r.cameraNote ? ` — ${r.cameraNote}` : ''}, so a struck gate can be attributed and pursued as a chargeback.`)
    if (r.offerPackageRoom) check(`Package ${r.packageRooms > 1 ? 'rooms' : 'room'} on the same credential — optional, adds ${money(r.packageRoomFeeAdd)} per unit to the P&A (${money(r.residentFeeWithPackage)} total).`)
    check('Resident support handled by GateGuard directly, so your leasing office is not the help desk.')

    // Value panel
    if (r.showValuePanel && r.valueUplift > 0) {
      H('What this adds to the property’s value')
      p(`Eliminated repair, capital, fobs, and staff time are net operating income. At a ${r.capRate}% cap rate, ${money(r.annualSavings)} of annual savings is worth about ${money(r.valueUplift)} in property value.`)
    }

    // Optional add-ons
    const addons: string[] = []
    if (r.offerGateCoverage) addons.push(`Physical gate & hinge coverage — ${money(r.addonGateRate)}/gate/mo (${money(r.addonGateTotal)}/mo).`)
    if (r.offerExtraCameras) addons.push(`Additional monitored cameras — ${money(r.addonCameraRate)}/camera/mo.`)
    if (r.offerSmartLocks) addons.push(`Smart locks at turn — ${money(r.smartLockResidentFee)}/unit resident, ${money(r.smartLockInstallPerUnit)}/unit install.`)
    if (r.offerLpr) addons.push(`License-plate recognition — ${money(r.lprRate)}/camera/mo${r.lprCount ? ` (${r.lprCount} = ${money(r.lprMonthlyTotal)}/mo)` : ''}.`)
    if (addons.length) { H('Optional add-ons (none required)'); for (const a of addons) check(a) }

    // Term + next steps
    H('Term and next steps')
    check(`${r.termYears}-year term from Go-Live, renewing in one-year terms unless either party gives 60 days' notice. The matching service agreement accompanies this proposal.`)
    check(`Execute the proposal and agreement, pay the ${money(r.deposit)} deposit; the balance is due at Go-Live.`)
    if (r.takeoverCompetitor) check(`Cancel ${r.takeoverCompetitor} — we assume the remaining invoices.`)

    pdf.moveDown(0.6)
    pdf.font('Helvetica').fontSize(10).fillColor(BODY).text('Respectfully,')
    pdf.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(String(quote?.created_by_name || 'Gate Guard'))
    pdf.font('Helvetica').fontSize(9).fillColor(MUT).text('Gate Guard, LLC · (770) 776-8095 · rfeldman@gateguard.co')

    pdf.end()
  })
}
