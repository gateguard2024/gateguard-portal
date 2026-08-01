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

// Returned by sendClerkInvite. `alreadyExisted` tells the caller the person
// wasn't newly invited: 'user' = they already have a login (we re-stamped their
// org/role), 'invitation' = an invite was already pending (left as-is).
export type InviteResult = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  id: string; url?: string; alreadyExisted?: 'user' | 'invitation'; userId?: string; [k: string]: any
}

export async function sendClerkInvite(opts: InviteOpts): Promise<InviteResult> {
  const clerk = await clerkClient()

  // Clerk is SHARED across beta + main (satellite domain), so the invitee may
  // already exist as a user, or already have a pending invitation. In both cases
  // createInvitation THROWS — which used to bubble up as a raw 500 ("it won't let
  // me add a user"). Create the invite, and on an "already exists" failure fall
  // back to updating the existing user / returning the pending invite.
  try {
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
          from: FROM, to: opts.emailAddress, replyTo: 'rfeldman@gateguard.co',
          subject: "You're invited to Gate Guard", html: inviteHtml(url, opts),
        })
      } catch (e) {
        console.error('[sendClerkInvite] Resend delivery failed:', (e as Error).message)
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return invitation as any
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyErr = err as any
    const detail = String(anyErr?.errors?.[0]?.message ?? anyErr?.message ?? '').toLowerCase()
    const alreadyExists = ['already', 'taken', 'duplicate', 'exists'].some(k => detail.includes(k))
    if (!alreadyExists) throw err

    // (a) Already a Clerk user → re-stamp org/role so their access is correct,
    // and report success. No new invite needed; they already have a login.
    const found = await clerk.users.getUserList({ emailAddress: [opts.emailAddress] })
    const existing = found?.data?.[0]
    if (existing) {
      await clerk.users.updateUserMetadata(existing.id, {
        publicMetadata: { ...(existing.publicMetadata ?? {}), ...opts.publicMetadata },
      })
      return { id: `existing-user-${existing.id}`, alreadyExisted: 'user', userId: existing.id }
    }

    // (b) A pending invitation already exists → return it (idempotent).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invs = await clerk.invitations.getInvitationList({ status: 'pending' } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pending = (invs?.data ?? []).find((i: any) => i.emailAddress === opts.emailAddress)
    if (pending) return { ...(pending as object), id: String((pending as { id: string }).id), alreadyExisted: 'invitation' }

    throw err
  }
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
