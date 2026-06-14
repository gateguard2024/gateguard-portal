/**
 * POST /api/nexus/internal/add-person
 *
 * One front door for adding any kind of person, from the glass Admin hub.
 * Routes to the right table behind a 5th-grader-simple wizard:
 *
 *   kind = 'office'        → Clerk invitation + portal login, role Admin/Supervisor/User
 *   kind = 'technician'    → technicians row (employee)
 *   kind = 'contractor'    → technicians row (contractor)
 *   kind = 'subcontractor' → subcontractors row (company sub, own access_code portal)
 *
 * For technician/contractor, login_method decides access:
 *   'field_code'  → generate a tech_code for the /tech field tool (no Clerk account)
 *   'full_login'  → Clerk invitation with the Tech role + portal-access fields set
 *   'none'        → tracked only, no login yet
 *
 * All guarded by the Phase 1 helpers. Invited logins are stamped with the
 * target org's org_id + org_tier so downward isolation holds on signup.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { clerkClient } from '@clerk/nextjs/server'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'
import { canManageOrg, canInviteUser, normalizeRole, type SimpleRole } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.gateguard.co'

function initialsOf(name: string): string {
  return name.split(' ').map(w => w[0]).filter(Boolean).join('').toUpperCase().slice(0, 2) || 'GG'
}

function makeTechCode(initials: string): string {
  return `GG-${initials}-${Math.floor(1000 + Math.random() * 9000)}`
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getCurrentUser()
    if (!caller.isCorporate && normalizeRole(caller.role) !== 'admin') {
      return NextResponse.json({ success: false, message: 'Only an Admin can add people.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const kind = body.kind as 'office' | 'technician' | 'contractor' | 'subcontractor'
    const name = (body.name ?? '').trim()
    const email = (body.email ?? '').trim()
    const phone = (body.phone ?? '').trim() || null
    if (!name) return NextResponse.json({ success: false, message: 'Name is required.' }, { status: 400 })

    const scope = await resolveOrgScope(caller)

    // Target org: corporate may target any org they pass; others = own org.
    const targetOrgId = caller.isCorporate
      ? (body.org_id ?? caller.org_id ?? null)
      : (caller.org_id ?? null)
    if (targetOrgId && !canManageOrg(caller, targetOrgId, scope.ids)) {
      return NextResponse.json({ success: false, message: 'That organization is outside your control.' }, { status: 403 })
    }

    // Look up the target org's tier (stamped onto invited logins).
    let orgTier: string | null = caller.org_tier ?? null
    if (targetOrgId) {
      const { data: org } = await supabase.from('organizations').select('org_tier').eq('id', targetOrgId).maybeSingle()
      orgTier = org?.org_tier ?? orgTier
    }

    // ── Office / portal user ──────────────────────────────────────────────
    if (kind === 'office') {
      const role = (body.role ?? 'user') as SimpleRole
      if (!email) return NextResponse.json({ success: false, message: 'Email is required for a portal login.' }, { status: 400 })
      if (targetOrgId && !canInviteUser(caller, targetOrgId, role, scope.ids)) {
        return NextResponse.json({ success: false, message: 'You cannot invite a user at or above your own role.' }, { status: 403 })
      }
      const client = await clerkClient()
      const invitation = await client.invitations.createInvitation({
        emailAddress: email,
        redirectUrl: `${APP_URL}/sign-up`,
        publicMetadata: { role, org_id: targetOrgId, org_tier: orgTier, invited_by: caller.id },
      })
      return NextResponse.json({ success: true, kind, invitation_id: invitation.id, message: `Invite sent to ${email}.` })
    }

    // ── Technician / Contractor ───────────────────────────────────────────
    if (kind === 'technician' || kind === 'contractor') {
      const employment_type = kind === 'contractor' ? 'contractor' : 'employee'
      const login_method = (body.login_method ?? 'none') as 'field_code' | 'full_login' | 'none'
      const initials = initialsOf(name)

      const row: Record<string, unknown> = {
        name, initials, role: 'Tech', phone, email: email || null,
        status: 'offline', employment_type, org_id: targetOrgId,
      }
      if (login_method === 'field_code') row.tech_code = makeTechCode(initials)
      if (login_method === 'full_login') {
        row.can_access_portal = true
        row.portal_invite_email = email || null
        row.portal_invite_sent_at = new Date().toISOString()
      }

      const { data: tech, error } = await supabase.from('technicians').insert(row).select().single()
      if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 })

      let invitation_id: string | null = null
      if (login_method === 'full_login') {
        if (!email) return NextResponse.json({ success: false, message: 'Email is required for a full login.' }, { status: 400 })
        const client = await clerkClient()
        const invitation = await client.invitations.createInvitation({
          emailAddress: email,
          redirectUrl: `${APP_URL}/sign-up`,
          publicMetadata: { role: 'tech', org_id: targetOrgId, org_tier: orgTier, technician_id: tech.id, invited_by: caller.id },
        })
        invitation_id = invitation.id
      }

      return NextResponse.json({
        success: true, kind, technician: tech, invitation_id,
        tech_code: tech.tech_code ?? null,
        message: login_method === 'full_login' ? `Tech added and invite sent to ${email}.`
          : login_method === 'field_code' ? `Tech added with field code ${tech.tech_code}.`
          : 'Tech added.',
      })
    }

    // ── Subcontractor company ─────────────────────────────────────────────
    if (kind === 'subcontractor') {
      const { data: sub, error } = await supabase.from('subcontractors').insert({
        org_id: targetOrgId, name, company: body.company ?? null,
        email: email || null, phone, trade: body.trade ?? null,
      }).select().single()
      if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 })
      return NextResponse.json({ success: true, kind, subcontractor: sub, access_code: sub.access_code, message: 'Subcontractor company added.' })
    }

    return NextResponse.json({ success: false, message: 'Unknown person type.' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'Could not add person.' }, { status: 500 })
  }
}
