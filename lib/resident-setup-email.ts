/**
 * "Set up your access" email — step 2 of the resident lifecycle (Part 3).
 * Sent when the PMS (Yardi / Brivo sync) or the property tells us about a new resident.
 * Links to that resident's move-in setup page in the portal. Same look as the
 * key-ready email (lib/resident-welcome-email.ts).
 *
 * kind:
 *   'invite'   — first email, right after the resident appears in the PMS
 *   'reminder' — setup not finished (e.g. 3 days before move-in, move-in day)
 *   'renewal'  — lease renewed; renew the parking & access fee
 *
 * Pure function (no imports) so it can be previewed anywhere; send with lib/email-sender.
 */

export type ResidentSetupEmailKind = 'invite' | 'reminder' | 'renewal'

export interface ResidentSetupFee {
  /** Full parking & access (P&A) fee for the lease term, in cents. */
  amountCents: number
  /** Who pays: the resident, the property, or split. */
  paidBy: 'resident' | 'property' | 'partial'
  /** For 'partial': what the resident pays, in cents. */
  residentCents?: number
}

export interface ResidentSetupEmailInput {
  kind?: ResidentSetupEmailKind
  firstName: string | null
  propertyName: string
  unit?: string | null
  /** ISO date (YYYY-MM-DD) of move-in or renewal start. */
  startDate?: string | null
  /** The resident's own setup link (token in the URL). */
  setupUrl: string
  fee?: ResidentSetupFee | null
  officePhone?: string | null
  logoUrl?: string
  supportUrl?: string
}

const BLUE = '#1665D8'
const NAVY = '#0A192F'
const INK = '#0F172A'
const INK2 = '#475569'
const BG = '#F2F4F8'
const FONT = '-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif'

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function money(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`
}

/** "Friday, December 4" — date-only, no time zone shift. */
function niceDate(iso?: string | null) {
  if (!iso) return null
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
}

function feeLine(fee?: ResidentSetupFee | null): { title: string; body: string } {
  if (!fee) return { title: 'Review and finish', body: 'Check everything over and tap Finish.' }
  if (fee.paidBy === 'property')
    return { title: 'Review and finish', body: 'Your parking &amp; access fee is covered by the property — nothing to pay.' }
  const due = fee.paidBy === 'partial' && fee.residentCents != null ? fee.residentCents : fee.amountCents
  const note = fee.paidBy === 'partial' ? ` (the property covers the rest of the ${money(fee.amountCents)} fee)` : ''
  return {
    title: 'Pay your parking &amp; access fee',
    body: `${money(due)} for your lease term${note}. Card or bank. Have a redemption code? Enter it there.`,
  }
}

export function renderResidentSetupEmail(input: ResidentSetupEmailInput): { subject: string; html: string; text: string } {
  const kind = input.kind ?? 'invite'
  const name = input.firstName?.trim() || 'there'
  const propertyRaw = input.propertyName
  const property = esc(propertyRaw)
  const unit = input.unit ? ` · Unit ${esc(input.unit)}` : ''
  const date = niceDate(input.startDate)
  const url = esc(input.setupUrl)
  const logo = input.logoUrl ?? 'https://portal.gateguard.co/logo-sm.png'
  const support = input.supportUrl ?? 'https://gateguard.co/support'
  const fee = feeLine(input.fee)

  const subject =
    kind === 'renewal'
      ? `Renew your parking & access at ${propertyRaw}`
      : kind === 'reminder'
        ? `Reminder: set up your access at ${propertyRaw}${date ? ` before ${date}` : ''}`
        : `Set up your access at ${propertyRaw}`

  const headline =
    kind === 'renewal' ? `Time to renew, ${esc(name)}.` : kind === 'reminder' ? `Almost there, ${esc(name)}.` : `Welcome to ${property}, ${esc(name)}.`

  const sub =
    kind === 'renewal'
      ? `Your lease${unit ? ` (${unit.slice(3)})` : ''} is renewing${date ? ` on ${esc(date)}` : ''}. Renew your parking &amp; access to keep your gates and doors working.`
      : kind === 'reminder'
        ? `Your access isn't set up yet${date ? ` and move-in is ${esc(date)}` : ''}. It takes about 3 minutes.`
        : `Set up your gate and door access before you move in${date ? ` on ${esc(date)}` : ''}. It takes about 3 minutes.`

  const cta = kind === 'renewal' ? 'Renew my access' : 'Set up my access'

  const step = (n: number, title: string, body: string) => `
    <tr><td style="padding:0 0 18px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
        <td width="36" valign="top">
          <div style="width:28px;height:28px;border-radius:14px;background:${BLUE};color:#fff;font:600 14px/28px ${FONT};text-align:center;">${n}</div>
        </td>
        <td valign="top" style="font:600 16px/22px ${FONT};color:${INK};">
          ${title}
          <div style="font:400 14px/20px ${FONT};color:${INK2};padding-top:4px;">${body}</div>
        </td>
      </tr></table>
    </td></tr>`

  const steps =
    kind === 'renewal'
      ? [
          step(1, 'Check who has access', 'Add or remove people on your lease and your vehicles.'),
          step(2, fee.title, fee.body),
        ]
      : [
          step(1, 'Confirm your details', 'Name, phone and move-in date — we filled in what we have from your lease.'),
          step(2, 'Add your photo', 'Helps the office and gate staff recognize you. Only staff can see it. You can skip this.'),
          step(3, 'Choose who gets access', 'You and anyone else on your lease. Each person gets their own key.'),
          step(4, fee.title, fee.body),
        ]

  const after =
    kind === 'renewal'
      ? 'Your app keeps working — nothing to download again.'
      : 'Then we email you a link to the GateGuard app. Sign in with this email address and your phone is your key — no fob, no code.'

  const office = input.officePhone
    ? `Questions about your lease? Call the ${property} leasing office at <a href="tel:${esc(input.officePhone)}" style="color:${BLUE};text-decoration:none;">${esc(input.officePhone)}</a>.`
    : `Questions about your lease? Contact the ${property} leasing office.`

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${BG};">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${BG};"><tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;width:100%;">

    <!-- Header -->
    <tr><td style="background:${NAVY};border-radius:14px 14px 0 0;padding:28px 32px 26px 32px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td><img src="${logo}" width="40" height="40" alt="GateGuard" style="display:block;border:0;"></td>
        <td style="padding-left:10px;font:600 13px/16px ${FONT};letter-spacing:2px;color:rgba(255,255,255,.75);">GATEGUARD</td>
      </tr></table>
      <div style="font:600 26px/32px ${FONT};color:#fff;padding-top:22px;">${headline}</div>
      <div style="font:400 15px/21px ${FONT};color:rgba(255,255,255,.75);padding-top:6px;">${sub}</div>
      <div style="padding-top:22px;">
        <a href="${url}" style="display:inline-block;background:${BLUE};color:#fff;text-decoration:none;border-radius:10px;padding:14px 26px;font:600 16px/20px ${FONT};">${cta}</a>
      </div>
    </td></tr>

    <!-- Steps -->
    <tr><td style="background:#fff;padding:28px 32px 6px 32px;">
      <div style="font:600 12px/16px ${FONT};letter-spacing:1.2px;color:${INK2};padding-bottom:16px;">${kind === 'renewal' ? 'TWO QUICK STEPS' : 'WHAT YOU’LL DO'}${unit ? ` · ${property}${unit}`.toUpperCase() : ''}</div>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">${steps.join('')}</table>
    </td></tr>

    <tr><td style="background:#fff;padding:0 32px 22px 32px;">
      <div style="font:400 14px/20px ${FONT};color:${INK2};">${after}</div>
    </td></tr>

    <!-- Help -->
    <tr><td style="background:#fff;border-radius:0 0 14px 14px;padding:0 32px 28px 32px;">
      <div style="background:${BG};border-radius:10px;padding:14px 16px;font:400 13px/19px ${FONT};color:${INK2};">
        Button not working? Copy this link into your browser:<br>
        <a href="${url}" style="color:${BLUE};word-break:break-all;">${url}</a><br><br>
        This link is just for you — please don't forward it.<br><br>${office}
      </div>
    </td></tr>

    <!-- Footer -->
    <tr><td align="center" style="padding:20px 12px;font:400 12px/18px ${FONT};color:#94A3B8;">
      <a href="${support}" style="color:#94A3B8;">Help</a> &nbsp;·&nbsp; <a href="https://gateguard.co/privacy" style="color:#94A3B8;">Privacy</a><br>
      Gate Guard, LLC · 980 Hammond Drive, Suite 200, Atlanta, GA 30328<br>
      You're receiving this because ${property} added you as a resident.
    </td></tr>

  </table>
</td></tr></table>
</body></html>`

  const strip = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&')
  const text = [
    strip(headline),
    strip(sub),
    '',
    `${cta}: ${input.setupUrl}`,
    '',
    ...(kind === 'renewal'
      ? ['1. Check who has access', `2. ${strip(fee.title)} — ${strip(fee.body)}`]
      : [
          '1. Confirm your details',
          '2. Add your photo (optional — only staff can see it)',
          '3. Choose who gets access',
          `4. ${strip(fee.title)} — ${strip(fee.body)}`,
        ]),
    '',
    after,
    '',
    input.officePhone ? `Questions? ${propertyRaw} leasing office: ${input.officePhone}` : `Questions? Contact the ${propertyRaw} leasing office.`,
  ].join('\n')

  return { subject, html, text }
}
