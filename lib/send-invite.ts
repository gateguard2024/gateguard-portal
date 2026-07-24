// lib/send-invite.ts — reliable Clerk invitations.
//
// Clerk's own invitation email has been unreliable for us (nothing arrives), so
// this creates the Clerk invitation WITH its org/role publicMetadata (applied
// automatically on accept — no manual JSON) and then delivers the accept link
// ourselves through Resend on our verified domain. Drop-in for
// `clerk.invitations.createInvitation({...})` — same args, returns the same
// invitation object.
import { clerkClient } from '@clerk/nextjs/server'
import { Resend } from 'resend'

const FROM = process.env.RESEND_DOCUMENTS_FROM_EMAIL ?? 'GateGuard Nexus <documents@nexus.gateguard.co>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.gateguard.co'
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export interface InviteOpts {
  emailAddress: string
  publicMetadata: Record<string, unknown>
  redirectUrl?: string
  inviterName?: string
  orgName?: string
}

export async function sendClerkInvite(opts: InviteOpts) {
  const clerk = await clerkClient()
  const invitation = await clerk.invitations.createInvitation({
    emailAddress: opts.emailAddress,
    publicMetadata: opts.publicMetadata,
    redirectUrl: opts.redirectUrl ?? `${APP_URL}/sign-up`,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const url = (invitation as any).url as string | undefined
  if (resend && url) {
    try {
      await resend.emails.send({
        from: FROM,
        to: opts.emailAddress,
        replyTo: 'rfeldman@gateguard.co',
        subject: "You're invited to Gate Guard",
        html: inviteHtml(url, opts),
      })
    } catch (e) {
      console.error('[sendClerkInvite] Resend delivery failed:', (e as Error).message)
    }
  }
  return invitation
}

function inviteHtml(url: string, opts: InviteOpts): string {
  const org = opts.orgName ? ` to <strong>${opts.orgName}</strong>` : ''
  const who = opts.inviterName ? `${opts.inviterName} invited you` : 'You have been invited'
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0C111D;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#131B2E;border:1px solid #1E2A45;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,rgba(107,126,255,0.16),#0B1728);padding:30px 32px;border-bottom:1px solid #1E2A45;">
      <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#7DE5FF;font-weight:700;">Gate Guard · Nexus</div>
      <div style="font-size:22px;font-weight:800;color:#ffffff;margin-top:6px;">You're invited</div>
    </div>
    <div style="padding:28px 32px;color:#cbd5e1;font-size:15px;line-height:1.6;">
      <p style="margin:0 0 16px;">${who}${org} on the Gate Guard portal.</p>
      <p style="margin:0 0 22px;">Click below to set up your login. This link is unique to you.</p>
      <a href="${url}" style="display:inline-block;background:#6B7EFF;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 26px;border-radius:10px;">Accept invitation &rarr;</a>
      <p style="margin:22px 0 0;font-size:12px;color:#64748b;">If the button doesn't work, paste this link into your browser:<br><span style="color:#7DE5FF;word-break:break-all;">${url}</span></p>
    </div>
  </div>
</body></html>`
}
