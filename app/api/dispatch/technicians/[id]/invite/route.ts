import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/dispatch/technicians/[id]/invite
// Sends a Clerk portal invite to the tech's email using the Clerk invitations API
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}))
    const overrideEmail = body.email as string | undefined

    // Load the tech record
    const { data: tech, error: fetchErr } = await supabase
      .from('technicians')
      .select('id, name, email, employment_type, can_access_portal, portal_invite_sent_at')
      .eq('id', params.id)
      .single()

    if (fetchErr || !tech) {
      return NextResponse.json({ error: 'Technician not found' }, { status: 404 })
    }

    const inviteEmail = overrideEmail || tech.email
    if (!inviteEmail) {
      return NextResponse.json({ error: 'No email address on file. Add an email to send the invite.' }, { status: 400 })
    }

    // Send a Clerk invitation using the Clerk Backend API
    const clerkSecretKey = process.env.CLERK_SECRET_KEY
    if (!clerkSecretKey) {
      return NextResponse.json({ error: 'Clerk not configured' }, { status: 500 })
    }

    const clerkRes = await fetch('https://api.clerk.com/v1/invitations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${clerkSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email_address: inviteEmail,
        redirect_url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.gateguard.co'}/sign-in`,
        public_metadata: {
          role: 'tech',
          technician_id: tech.id,
        },
        notify: true,
      }),
    })

    if (!clerkRes.ok) {
      const clerkError = await clerkRes.json().catch(() => ({}))
      // If already invited / already has account, treat as success
      const errCode = clerkError?.errors?.[0]?.code ?? ''
      if (errCode !== 'duplicate_record') {
        console.error('[invite] Clerk error:', clerkError)
        return NextResponse.json(
          { error: clerkError?.errors?.[0]?.long_message ?? 'Failed to send invite' },
          { status: 400 }
        )
      }
    }

    // Mark invite as sent
    await supabase
      .from('technicians')
      .update({
        can_access_portal: true,
        portal_invite_sent_at: new Date().toISOString(),
        portal_invite_email: inviteEmail,
      })
      .eq('id', params.id)

    return NextResponse.json({
      success: true,
      message: `Portal invite sent to ${inviteEmail}`,
    })
  } catch (err) {
    console.error('[invite] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
