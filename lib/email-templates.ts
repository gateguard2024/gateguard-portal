/**
 * GateGuard Email Template Library
 * All templates share a common layout: dark navy header, white card, brand-blue CTA, muted footer.
 * Each function returns a complete HTML string ready to pass to Resend.
 */

/* ─── Shared layout helpers ──────────────────────────────────────────── */

function header(): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0B1728;">
      <tr>
        <td style="padding:20px 32px;">
          <span style="font-family:Arial,sans-serif;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">
            Gate<span style="color:#6B7EFF;">Guard</span>
          </span>
        </td>
      </tr>
    </table>
  `
}

function footer(): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;margin-top:32px;">
      <tr>
        <td style="padding:20px 32px;text-align:center;">
          <p style="font-family:Arial,sans-serif;font-size:12px;color:#94a3b8;margin:0;line-height:1.6;">
            GateGuard &nbsp;&middot;&nbsp; rfeldman@gateguard.co &nbsp;&middot;&nbsp;
            <a href="https://portal.gateguard.co" style="color:#6B7EFF;text-decoration:none;">portal.gateguard.co</a>
          </p>
          <p style="font-family:Arial,sans-serif;font-size:11px;color:#cbd5e1;margin:8px 0 0;">
            This email was sent by GateGuard. If you have questions, reply directly to this message.
          </p>
        </td>
      </tr>
    </table>
  `
}

function ctaButton(label: string, url: string): string {
  return `
    <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td style="border-radius:8px;background:#6B7EFF;">
          <a href="${url}"
            style="display:inline-block;font-family:Arial,sans-serif;font-size:14px;font-weight:600;
                   color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;
                   line-height:20px;min-height:48px;box-sizing:border-box;">
            ${label}
          </a>
        </td>
      </tr>
    </table>
  `
}

function infoRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-family:Arial,sans-serif;
                 font-size:13px;color:#94a3b8;width:150px;vertical-align:top;">${label}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-family:Arial,sans-serif;
                 font-size:13px;color:#1e293b;font-weight:600;">${value}</td>
    </tr>
  `
}

function wrap(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
          style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;
                 border:1px solid #e2e8f0;overflow:hidden;">
          <tr><td>${header()}</td></tr>
          <tr>
            <td style="padding:32px;">
              ${body}
            </td>
          </tr>
          <tr><td>${footer()}</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/* ─── Template 1: Dealer Welcome ─────────────────────────────────────── */

export interface DealerWelcomeParams {
  recipientName: string
  orgName: string
  tier: string
  portalUrl: string
}

export function generateDealerWelcomeEmail(params: DealerWelcomeParams): string {
  const { recipientName, orgName, tier, portalUrl } = params
  const body = `
    <h1 style="font-family:Arial,sans-serif;font-size:22px;font-weight:700;color:#0f172a;margin:0 0 8px;">
      Welcome to GateGuard, ${recipientName}!
    </h1>
    <p style="font-family:Arial,sans-serif;font-size:15px;color:#475569;line-height:1.7;margin:0 0 20px;">
      <strong>${orgName}</strong> has been set up on the GateGuard Dealer Portal as a
      <strong>${tier}</strong>. You now have access to quoting, work orders, field diagnostics,
      knowledge base, and your full dealer dashboard.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${infoRow('Organization', orgName)}
      ${infoRow('Account Type', tier)}
      ${infoRow('Portal Access', 'Active')}
    </table>

    <p style="font-family:Arial,sans-serif;font-size:14px;color:#475569;line-height:1.7;margin:0 0 4px;">
      Click below to sign in to your portal and complete your setup:
    </p>
    ${ctaButton('Access GateGuard Portal', portalUrl)}

    <div style="background:#f0f4ff;border-left:3px solid #6B7EFF;border-radius:0 6px 6px 0;
                padding:14px 16px;margin-top:8px;">
      <p style="font-family:Arial,sans-serif;font-size:13px;color:#3b4fd8;margin:0;font-weight:600;">
        Your field diagnostic tool is live at portal.gateguard.co/tech
      </p>
      <p style="font-family:Arial,sans-serif;font-size:13px;color:#475569;margin:4px 0 0;line-height:1.5;">
        Share the link with your techs — no separate login required.
        They use your TECH_ACCESS_CODE PIN.
      </p>
    </div>
  `
  return wrap(body)
}

/* ─── Template 2: NDA ────────────────────────────────────────────────── */

export interface NdaEmailParams {
  recipientName: string
  orgName: string
  ndaType: 'A' | 'B' | 'C'
  signUrl: string
  senderName: string
}

const NDA_DESCRIPTIONS: Record<'A' | 'B' | 'C', string> = {
  A: 'Mutual NDA — full mutual non-disclosure for Master Agent and MSO-level agreements.',
  B: 'Dealer NDA — one-way non-disclosure protecting dealer client lists and proprietary information.',
  C: 'Sales Partner NDA — lightweight non-disclosure covering leads, pricing, and pipeline information.',
}

export function generateNdaEmail(params: NdaEmailParams): string {
  const { recipientName, orgName, ndaType, signUrl, senderName } = params
  const body = `
    <h1 style="font-family:Arial,sans-serif;font-size:22px;font-weight:700;color:#0f172a;margin:0 0 8px;">
      NDA Ready to Sign
    </h1>
    <p style="font-family:Arial,sans-serif;font-size:15px;color:#475569;line-height:1.7;margin:0 0 20px;">
      Hi ${recipientName}, a Non-Disclosure Agreement has been prepared for
      <strong>${orgName}</strong>. Please review and sign at your earliest convenience.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      ${infoRow('Organization', orgName)}
      ${infoRow('Document Type', `NDA-${ndaType}`)}
      ${infoRow('Prepared by', senderName)}
    </table>

    <p style="font-family:Arial,sans-serif;font-size:13px;color:#64748b;line-height:1.7;margin:0 0 4px;">
      ${NDA_DESCRIPTIONS[ndaType]}
    </p>

    <p style="font-family:Arial,sans-serif;font-size:14px;color:#475569;line-height:1.7;margin:16px 0 4px;">
      Click the button below to review and sign the NDA:
    </p>
    ${ctaButton('Review &amp; Sign NDA', signUrl)}

    <p style="font-family:Arial,sans-serif;font-size:12px;color:#94a3b8;line-height:1.6;margin:0;">
      This link is unique to your account. Do not share it. If you have questions about the
      agreement, reply to this email and ${senderName} will follow up.
    </p>
  `
  return wrap(body)
}

/* ─── Template 3: Agreement ──────────────────────────────────────────── */

export interface AgreementEmailParams {
  recipientName: string
  orgName: string
  agreementType: string
  signUrl: string
  senderName: string
}

export function generateAgreementEmail(params: AgreementEmailParams): string {
  const { recipientName, orgName, agreementType, signUrl, senderName } = params
  const body = `
    <h1 style="font-family:Arial,sans-serif;font-size:22px;font-weight:700;color:#0f172a;margin:0 0 8px;">
      Agreement Ready to Sign
    </h1>
    <p style="font-family:Arial,sans-serif;font-size:15px;color:#475569;line-height:1.7;margin:0 0 20px;">
      Hi ${recipientName}, your <strong>${agreementType}</strong> with GateGuard has been
      prepared for <strong>${orgName}</strong>. Please review and execute the agreement to activate
      your account.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      ${infoRow('Organization', orgName)}
      ${infoRow('Agreement', agreementType)}
      ${infoRow('Prepared by', senderName)}
    </table>

    <p style="font-family:Arial,sans-serif;font-size:14px;color:#475569;line-height:1.7;margin:0 0 4px;">
      Click below to review and sign the agreement:
    </p>
    ${ctaButton('Review &amp; Sign Agreement', signUrl)}

    <p style="font-family:Arial,sans-serif;font-size:12px;color:#94a3b8;line-height:1.6;margin:0;">
      Once signed, your portal account will be fully activated. If you have questions, reply to
      this email and ${senderName} will reach out directly.
    </p>
  `
  return wrap(body)
}

/* ─── Template 4: Work Order ─────────────────────────────────────────── */

export interface WorkOrderEmailParams {
  techName: string
  propertyName: string
  address: string
  woNumber: string
  scheduledDate: string
  portalUrl: string
}

export function generateWorkOrderEmail(params: WorkOrderEmailParams): string {
  const { techName, propertyName, address, woNumber, scheduledDate, portalUrl } = params
  const body = `
    <h1 style="font-family:Arial,sans-serif;font-size:22px;font-weight:700;color:#0f172a;margin:0 0 8px;">
      Work Order Assigned
    </h1>
    <p style="font-family:Arial,sans-serif;font-size:15px;color:#475569;line-height:1.7;margin:0 0 20px;">
      Hi ${techName}, you have been assigned to a new work order. Please review the details below
      and confirm your availability.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${infoRow('Work Order', woNumber)}
      ${infoRow('Property', propertyName)}
      ${infoRow('Address', address)}
      ${infoRow('Scheduled Date', scheduledDate)}
    </table>

    ${ctaButton('View Work Order Details', portalUrl)}

    <div style="background:#f0fdf4;border-left:3px solid #22c55e;border-radius:0 6px 6px 0;
                padding:14px 16px;">
      <p style="font-family:Arial,sans-serif;font-size:13px;color:#15803d;margin:0;font-weight:600;">
        Field diagnostic tool available
      </p>
      <p style="font-family:Arial,sans-serif;font-size:13px;color:#475569;margin:4px 0 0;line-height:1.5;">
        Use the /tech tool on-site for AI-powered troubleshooting, wiring guides, and
        resolution capture.
      </p>
    </div>
  `
  return wrap(body)
}

/* ─── Template 5: Quote Approval ─────────────────────────────────────── */

export interface QuoteApprovalEmailParams {
  clientName: string
  propertyName: string
  quoteNumber: string
  quoteTotal: string
  approvalUrl: string
  expiryDate: string
}

export function generateQuoteApprovalEmail(params: QuoteApprovalEmailParams): string {
  const { clientName, propertyName, quoteNumber, quoteTotal, approvalUrl, expiryDate } = params
  const body = `
    <h1 style="font-family:Arial,sans-serif;font-size:22px;font-weight:700;color:#0f172a;margin:0 0 8px;">
      Your Quote is Ready
    </h1>
    <p style="font-family:Arial,sans-serif;font-size:15px;color:#475569;line-height:1.7;margin:0 0 20px;">
      Hi ${clientName}, your GateGuard quote for <strong>${propertyName}</strong> is ready for
      your review. Please click below to view the full proposal and approve or request changes.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${infoRow('Quote Number', quoteNumber)}
      ${infoRow('Property', propertyName)}
      ${infoRow('Total', quoteTotal)}
      ${infoRow('Expires', expiryDate)}
    </table>

    ${ctaButton('Review &amp; Approve Quote', approvalUrl)}

    <p style="font-family:Arial,sans-serif;font-size:12px;color:#94a3b8;line-height:1.6;margin:0;">
      No account or password needed — the link above takes you directly to your quote.
      This quote expires on ${expiryDate}.
    </p>
  `
  return wrap(body)
}

/* ─── Template 6: Permit Renewal ─────────────────────────────────────── */

export interface PermitRenewalEmailParams {
  recipientName: string
  propertyName: string
  permitType: string
  expiryDate: string
  daysRemaining: number
  portalUrl: string
}

export function generatePermitRenewalEmail(params: PermitRenewalEmailParams): string {
  const { recipientName, propertyName, permitType, expiryDate, daysRemaining, portalUrl } = params
  const urgencyColor = daysRemaining <= 7 ? '#ef4444' : daysRemaining <= 30 ? '#f59e0b' : '#6B7EFF'
  const urgencyLabel = daysRemaining <= 7 ? 'URGENT' : daysRemaining <= 30 ? 'ACTION REQUIRED' : 'REMINDER'

  const body = `
    <div style="background:${urgencyColor}12;border:1px solid ${urgencyColor}30;border-radius:8px;
                padding:10px 16px;margin-bottom:20px;display:inline-block;">
      <span style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;
                   color:${urgencyColor};letter-spacing:0.5px;">${urgencyLabel}</span>
    </div>

    <h1 style="font-family:Arial,sans-serif;font-size:22px;font-weight:700;color:#0f172a;margin:0 0 8px;">
      Permit Expiring in ${daysRemaining} Days
    </h1>
    <p style="font-family:Arial,sans-serif;font-size:15px;color:#475569;line-height:1.7;margin:0 0 20px;">
      Hi ${recipientName}, a permit renewal is required for <strong>${propertyName}</strong>.
      Please take action before the expiry date to maintain compliance.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${infoRow('Property', propertyName)}
      ${infoRow('Permit Type', permitType)}
      ${infoRow('Expiry Date', `<span style="color:${urgencyColor};font-weight:700;">${expiryDate}</span>`)}
      ${infoRow('Days Remaining', `<span style="color:${urgencyColor};font-weight:700;">${daysRemaining}</span>`)}
    </table>

    ${ctaButton('Manage Compliance in Portal', portalUrl)}

    <p style="font-family:Arial,sans-serif;font-size:12px;color:#94a3b8;line-height:1.6;margin:0;">
      Log in to the compliance tracker to upload renewal documents and update the permit status.
    </p>
  `
  return wrap(body)
}

/* ─── Template 7: Invoice ────────────────────────────────────────────── */

export interface InvoiceEmailParams {
  clientName: string
  propertyName: string
  invoiceNumber: string
  amount: string
  dueDate: string
  paymentUrl: string
}

export function generateInvoiceEmail(params: InvoiceEmailParams): string {
  const { clientName, propertyName, invoiceNumber, amount, dueDate, paymentUrl } = params
  const body = `
    <h1 style="font-family:Arial,sans-serif;font-size:22px;font-weight:700;color:#0f172a;margin:0 0 8px;">
      Invoice Ready for Payment
    </h1>
    <p style="font-family:Arial,sans-serif;font-size:15px;color:#475569;line-height:1.7;margin:0 0 20px;">
      Hi ${clientName}, your GateGuard invoice for <strong>${propertyName}</strong> is ready.
      Payment is accepted via ACH or credit card — no portal account required.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${infoRow('Invoice Number', invoiceNumber)}
      ${infoRow('Property', propertyName)}
      ${infoRow('Amount Due', `<span style="font-size:16px;color:#0f172a;">${amount}</span>`)}
      ${infoRow('Due Date', dueDate)}
    </table>

    ${ctaButton('Pay Invoice Now', paymentUrl)}

    <p style="font-family:Arial,sans-serif;font-size:12px;color:#94a3b8;line-height:1.6;margin:0;">
      Payments are processed securely via Stripe. ACH transfers typically clear within 2–3 business days.
      For billing questions, reply to this email.
    </p>
  `
  return wrap(body)
}
