/**
 * Send the resident app welcome email for one resident_app_access row.
 * Call it when access is granted: move-in "Setup complete" (Part 3), the property
 * turning App access on (Part 2), or by hand from POST /api/mobile/welcome-email.
 */
import { createServiceClient } from '@/lib/supabase'
import { sendEmail } from '@/lib/email-sender'
import { renderResidentWelcomeEmail } from '@/lib/resident-welcome-email'

export async function sendResidentWelcome(accessId: string): Promise<{ ok: boolean; error?: string }> {
  const db = createServiceClient()
  const { data: row, error } = await db
    .from('resident_app_access')
    .select('id, site_id, email, first_name, unit_number, active')
    .eq('id', accessId)
    .maybeSingle()
  if (error || !row) return { ok: false, error: error?.message ?? 'Access row not found' }
  if (!row.active) return { ok: false, error: 'Access is not active' }

  const { data: site } = await db.from('sites').select('name, primary_contact_phone').eq('id', row.site_id).maybeSingle()

  const mail = renderResidentWelcomeEmail({
    firstName: row.first_name,
    email: row.email,
    propertyName: site?.name ?? 'your community',
    unit: row.unit_number,
    officePhone: site?.primary_contact_phone ?? null,
    appStoreUrl: process.env.RESIDENT_APP_STORE_URL || undefined,
    playStoreUrl: process.env.RESIDENT_PLAY_STORE_URL || undefined,
  })
  const sent = await sendEmail({ to: row.email, subject: mail.subject, html: mail.html })
  return sent.success ? { ok: true } : { ok: false, error: sent.error }
}
