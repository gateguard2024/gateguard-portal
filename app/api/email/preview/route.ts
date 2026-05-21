/**
 * GET /api/email/preview?template=<name>
 *
 * Dev-only endpoint — renders any email template with realistic demo data.
 * Returns Content-Type: text/html so you can view it directly in a browser.
 *
 * Supported templates:
 *   dealer_welcome | nda | agreement | work_order | quote_approval | permit_renewal | invoice
 *
 * Example: GET /api/email/preview?template=nda
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  generateDealerWelcomeEmail,
  generateNdaEmail,
  generateAgreementEmail,
  generateWorkOrderEmail,
  generateQuoteApprovalEmail,
  generatePermitRenewalEmail,
  generateInvoiceEmail,
} from '@/lib/email-templates'

export const dynamic = 'force-dynamic'

const PORTAL_URL = 'https://portal.gateguard.co'

function renderTemplate(template: string): string | null {
  switch (template) {
    case 'dealer_welcome':
      return generateDealerWelcomeEmail({
        recipientName: 'Jamie Rodriguez',
        orgName: 'Sunshine Gate Services LLC',
        tier: 'Full Dealership',
        portalUrl: PORTAL_URL,
      })

    case 'nda':
      return generateNdaEmail({
        recipientName: 'Jamie Rodriguez',
        orgName: 'Sunshine Gate Services LLC',
        ndaType: 'B',
        signUrl: `${PORTAL_URL}/sign/nda?dealer=demo-dealer-id`,
        senderName: 'Russel Feldman',
      })

    case 'agreement':
      return generateAgreementEmail({
        recipientName: 'Jamie Rodriguez',
        orgName: 'Sunshine Gate Services LLC',
        agreementType: 'Dealer Agreement',
        signUrl: `${PORTAL_URL}/sign/agreement?dealer=demo-dealer-id`,
        senderName: 'Russel Feldman',
      })

    case 'work_order':
      return generateWorkOrderEmail({
        techName: 'Marcus Webb',
        propertyName: 'Stonegate at Peachtree',
        address: '1234 Peachtree Rd NW, Atlanta, GA 30309',
        woNumber: 'WO-2026-00847',
        scheduledDate: 'Thursday, May 22, 2026 at 9:00 AM',
        portalUrl: `${PORTAL_URL}/maintenance/WO-2026-00847`,
      })

    case 'quote_approval':
      return generateQuoteApprovalEmail({
        clientName: 'Sarah Mitchell',
        propertyName: 'Stonegate at Peachtree',
        quoteNumber: 'GG-Q-00241',
        quoteTotal: '$18,450.00',
        approvalUrl: `${PORTAL_URL}/quotes/demo-quote-id/approve`,
        expiryDate: 'June 15, 2026',
      })

    case 'permit_renewal':
      return generatePermitRenewalEmail({
        recipientName: 'Jamie Rodriguez',
        propertyName: 'Stonegate at Peachtree',
        permitType: 'Gate Operator Permit',
        expiryDate: 'May 27, 2026',
        daysRemaining: 7,
        portalUrl: `${PORTAL_URL}/compliance`,
      })

    case 'invoice':
      return generateInvoiceEmail({
        clientName: 'Sarah Mitchell',
        propertyName: 'Stonegate at Peachtree',
        invoiceNumber: 'GG-INV-120051',
        amount: '$2,150.00',
        dueDate: 'June 1, 2026',
        paymentUrl: 'https://buy.stripe.com/demo',
      })

    default:
      return null
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const template = searchParams.get('template') ?? ''

  const html = renderTemplate(template)

  if (!html) {
    const available = [
      'dealer_welcome',
      'nda',
      'agreement',
      'work_order',
      'quote_approval',
      'permit_renewal',
      'invoice',
    ]
    return NextResponse.json(
      {
        error: `Unknown template: "${template}"`,
        available,
        usage: '/api/email/preview?template=nda',
      },
      { status: 400 }
    )
  }

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
