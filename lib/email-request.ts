/**
 * lib/email-request.ts
 *
 * Email helpers for the public property request portal.
 * Sends two emails per new request:
 *   1. Alert to the dealer (with portal deep link)
 *   2. Confirmation to the property manager (with reference number)
 */

const FROM = process.env.RESEND_FROM_EMAIL ?? 'GateGuard <notifications@gateguard.co>'

export async function sendRequestEmail(opts: {
  to:      string
  subject: string
  html:    string
  text:    string
}) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log(`[email-request] RESEND_API_KEY not set. Skipping: "${opts.subject}" → ${opts.to}`)
    return
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ from: FROM, to: [opts.to], subject: opts.subject, text: opts.text, html: opts.html }),
    })
    if (!res.ok) console.error('[email-request] Resend error:', res.status, await res.text())
  } catch (err) {
    console.error('[email-request] Send failed:', err)
  }
}

// ── Dealer alert email ─────────────────────────────────────────────────────────

export function dealerAlertHtml(
  siteName: string,
  title:    string,
  priority: string,
  contactName:  string,
  contactEmail: string,
  portalLink:   string,
): string {
  const priorityColor: Record<string, string> = {
    urgent: '#ef4444', high: '#f97316', normal: '#6B7EFF', low: '#64748b',
  }
  const color = priorityColor[priority] ?? '#6B7EFF'

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
  <tr><td style="background:#0C111D;padding:24px 32px">
    <span style="font-size:20px;font-weight:700;color:#fff">Gate<span style="color:#6B7EFF">Guard</span></span>
  </td></tr>
  <tr><td style="padding:28px 32px 0">
    <span style="display:inline-block;background:${color}22;color:${color};font-size:13px;font-weight:600;padding:6px 14px;border-radius:100px;border:1px solid ${color}44">
      🔔 New Property Request
    </span>
  </td></tr>
  <tr><td style="padding:16px 32px 0">
    <h1 style="margin:0;font-size:22px;font-weight:700;color:#0f172a">${title}</h1>
    <p style="margin:6px 0 0;font-size:14px;color:#64748b">${siteName}</p>
  </td></tr>
  <tr><td style="padding:24px 32px">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0">
      <tr><td style="padding:16px 20px">
        <table width="100%" cellpadding="4" cellspacing="0">
          <tr>
            <td style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;width:110px">Priority</td>
            <td style="font-size:13px;color:${color};font-weight:600;text-transform:capitalize">${priority}</td>
          </tr>
          <tr>
            <td style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">Contact</td>
            <td style="font-size:13px;color:#0f172a">${contactName || '—'}</td>
          </tr>
          ${contactEmail ? `<tr><td style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">Email</td><td style="font-size:13px;color:#6B7EFF">${contactEmail}</td></tr>` : ''}
        </table>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:0 32px 28px">
    <a href="${portalLink}" style="display:inline-block;background:#6B7EFF;color:#fff;font-size:13px;font-weight:600;padding:12px 24px;border-radius:10px;text-decoration:none">
      View in Portal →
    </a>
  </td></tr>
  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px">
    <p style="margin:0;font-size:12px;color:#94a3b8">Automated alert — GateGuard portal.gateguard.co</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

// ── Property manager confirmation email ────────────────────────────────────────

export function pmConfirmHtml(
  siteName:  string,
  title:     string,
  refNumber: string,
): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
  <tr><td style="background:#0C111D;padding:24px 32px">
    <span style="font-size:20px;font-weight:700;color:#fff">Gate<span style="color:#6B7EFF">Guard</span></span>
  </td></tr>
  <tr><td style="padding:28px 32px 0">
    <span style="display:inline-block;background:#10b98122;color:#10b981;font-size:13px;font-weight:600;padding:6px 14px;border-radius:100px;border:1px solid #10b98144">
      ✅ Request Received
    </span>
  </td></tr>
  <tr><td style="padding:16px 32px 0">
    <h1 style="margin:0;font-size:22px;font-weight:700;color:#0f172a">${title}</h1>
    <p style="margin:6px 0 0;font-size:14px;color:#64748b">${siteName}</p>
  </td></tr>
  <tr><td style="padding:24px 32px">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0">
      <tr><td style="padding:20px">
        <p style="margin:0;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">Reference Number</p>
        <p style="margin:8px 0 0;font-size:22px;font-weight:700;color:#0f172a;font-family:monospace;letter-spacing:2px">${refNumber}</p>
      </td></tr>
    </table>
    <p style="margin:20px 0 0;font-size:14px;color:#475569;line-height:1.6">
      We've received your maintenance request and your dealer has been notified. You'll receive updates as we schedule and dispatch a technician.
    </p>
  </td></tr>
  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px">
    <p style="margin:0;font-size:12px;color:#94a3b8">Questions? Contact your GateGuard dealer directly. This confirmation is from GateGuard's property management system.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}
