/**
 * Resident app welcome email — sent when a resident (or household member) is given app
 * access (a resident_app_access row: move-in "Setup complete", or the property turns
 * App access on). Modeled on Brivo's "Your Mobile Key is ready" email, minus the
 * redeem code: residents just sign in with this email address.
 *
 * Pure function (no imports) so it can be previewed anywhere; send with lib/email-sender.
 */

export interface ResidentWelcomeEmailInput {
  firstName: string | null
  email: string // the address they sign in with
  propertyName: string
  unit?: string | null
  officePhone?: string | null
  appStoreUrl?: string
  playStoreUrl?: string
  logoUrl?: string
  supportUrl?: string
}

const BLUE = '#1665D8'
const NAVY = '#0A192F'
const INK = '#0F172A'
const INK2 = '#475569'
const BG = '#F2F4F8'

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function renderResidentWelcomeEmail(input: ResidentWelcomeEmailInput): { subject: string; html: string; text: string } {
  const name = input.firstName?.trim() || 'there'
  const property = esc(input.propertyName)
  const email = esc(input.email)
  const unit = input.unit ? ` · Unit ${esc(input.unit)}` : ''
  const appStore = input.appStoreUrl ?? 'https://gateguard.co/app'
  const play = input.playStoreUrl ?? 'https://gateguard.co/app'
  const logo = input.logoUrl ?? 'https://portal.gateguard.co/logo-sm.png'
  const support = input.supportUrl ?? 'https://gateguard.co/support'
  const office = input.officePhone
    ? `Questions about your lease or access? Call the ${property} leasing office at <a href="tel:${esc(input.officePhone)}" style="color:${BLUE};text-decoration:none;">${esc(input.officePhone)}</a>.`
    : `Questions about your lease or access? Contact the ${property} leasing office.`

  const subject = `Your GateGuard key for ${input.propertyName} is ready`

  const step = (n: number, title: string, body: string) => `
    <tr><td style="padding:0 0 20px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
        <td width="36" valign="top">
          <div style="width:28px;height:28px;border-radius:14px;background:${BLUE};color:#fff;font:600 14px/28px -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;text-align:center;">${n}</div>
        </td>
        <td valign="top" style="font:600 16px/22px -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK};">
          ${title}
          <div style="font:400 14px/20px -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK2};padding-top:4px;">${body}</div>
        </td>
      </tr></table>
    </td></tr>`

  const storeButton = (href: string, small: string, big: string) =>
    `<a href="${href}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;border-radius:10px;padding:8px 18px;margin:0 8px 8px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
      <span style="display:block;font-size:10px;line-height:12px;opacity:.85;">${small}</span>
      <span style="display:block;font-size:17px;line-height:22px;font-weight:600;">${big}</span>
    </a>`

  const feature = (title: string, body: string) => `
    <tr><td style="padding:0 0 12px 0;font:400 14px/20px -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK2};">
      <span style="color:${INK};font-weight:600;">${title}</span> — ${body}
    </td></tr>`

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${BG};">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${BG};"><tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;width:100%;">

    <!-- Header -->
    <tr><td style="background:${NAVY};border-radius:14px 14px 0 0;padding:28px 32px 26px 32px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td><img src="${logo}" width="40" height="40" alt="GateGuard" style="display:block;border:0;"></td>
        <td style="padding-left:10px;font:600 13px/16px -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;letter-spacing:2px;color:rgba(255,255,255,.75);">GATEGUARD</td>
      </tr></table>
      <div style="font:600 26px/32px -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#fff;padding-top:22px;">Welcome home, ${esc(name)}.</div>
      <div style="font:400 15px/21px -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:rgba(255,255,255,.75);padding-top:6px;">Your phone is now your key at ${property}${unit}.</div>
    </td></tr>

    <!-- Body -->
    <tr><td style="background:#fff;padding:28px 32px 8px 32px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        ${step(1, 'Download the GateGuard app', `${storeButton(appStore, 'Download on the', 'App Store')}${storeButton(play, 'GET IT ON', 'Google Play')}`)}
        ${step(2, 'Sign in with this email', `Use <span style="color:${INK};font-weight:600;">${email}</span>. No password — we send a 6-digit code to this inbox.`)}
        ${step(3, 'Swipe to open', 'Your gates and doors are ready the moment you sign in. No key, no fob, no code to redeem.')}
      </table>
    </td></tr>

    <tr><td style="background:#fff;padding:0 32px;"><div style="height:1px;background:rgba(15,23,42,.08);"></div></td></tr>

    <tr><td style="background:#fff;padding:22px 32px 10px 32px;">
      <div style="font:600 12px/16px -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;letter-spacing:1.2px;color:${INK2};padding-bottom:12px;">WITH THE GATEGUARD APP YOU CAN</div>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        ${feature('Open gates and doors', 'swipe to open from your phone')}
        ${feature('See who is at the guest gate', 'live camera before you let them in')}
        ${feature('Let guests in', 'send a pass by text; they don’t need the app')}
        ${feature('Get your packages', 'alerts, shelf spot and pickup code')}
      </table>
    </td></tr>

    <!-- Help -->
    <tr><td style="background:#fff;border-radius:0 0 14px 14px;padding:10px 32px 28px 32px;">
      <div style="background:${BG};border-radius:10px;padding:14px 16px;font:400 13px/19px -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK2};">
        Signing in with a different email? Ask your leasing office to update it — your key is tied to this address.<br><br>${office}
      </div>
    </td></tr>

    <!-- Footer -->
    <tr><td align="center" style="padding:20px 12px;font:400 12px/18px -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#94A3B8;">
      <a href="${support}" style="color:#94A3B8;">Help</a> &nbsp;·&nbsp; <a href="https://gateguard.co/privacy" style="color:#94A3B8;">Privacy</a><br>
      Gate Guard, LLC · 980 Hammond Drive, Suite 200, Atlanta, GA 30328<br>
      You're receiving this because ${property} gave you resident access.
    </td></tr>

  </table>
</td></tr></table>
</body></html>`

  const text = [
    `Welcome home, ${name}.`,
    `Your phone is now your key at ${input.propertyName}${input.unit ? ` · Unit ${input.unit}` : ''}.`,
    '',
    `1. Download the GateGuard app: App Store ${appStore} · Google Play ${play}`,
    `2. Sign in with this email: ${input.email} — we send a 6-digit code, no password.`,
    '3. Swipe to open. No key, no fob, no code to redeem.',
    '',
    input.officePhone ? `Questions? ${input.propertyName} leasing office: ${input.officePhone}` : `Questions? Contact the ${input.propertyName} leasing office.`,
  ].join('\n')

  return { subject, html, text }
}
