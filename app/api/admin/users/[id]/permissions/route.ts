/**
 * GET   /api/admin/users/[id]/permissions  — get a user's permissions
 * PATCH /api/admin/users/[id]/permissions  — update permissions + sync to Clerk metadata
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await supabase
    .from('user_permissions')
    .select('*')
    .eq('clerk_user_id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const clerk_user_id = params.id

    // Upsert into Supabase
    const { data, error } = await supabase
      .from('user_permissions')
      .upsert({
        ...body,
        clerk_user_id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'clerk_user_id' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Sync critical permissions to Clerk publicMetadata (embedded in JWT)
    // This means the portal can check perms without a DB call on every page load
    try {
      const client = await clerkClient()
      await client.users.updateUserMetadata(clerk_user_id, {
        publicMetadata: {
          role: body.role,
          can_see_admin:    body.can_see_admin,
          can_see_crm:      body.can_see_crm,
          can_see_billing:  body.can_see_billing,
          can_create:       body.can_create,
          can_edit:         body.can_edit,
          // Full permissions fetched from Supabase when needed
          perms_updated_at: new Date().toISOString(),
        }
      })
    } catch (clerkErr: any) {
      // Log but don't fail — Supabase is source of truth
      console.warn('[permissions] Clerk metadata sync failed:', clerkErr.message)
    }

    return NextResponse.json(data)
  } catch (err: any) {
    console.error('[admin/users/permissions PATCH]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
