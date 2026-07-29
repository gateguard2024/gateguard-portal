import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { CustomerPortalTemplate, type PortalConfig } from '@/components/portal/CustomerPortalTemplate'
import { PinGate } from '@/components/portal/PinGate'

export const dynamic = 'force-dynamic'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Customer-facing portal for one property. Fetches ONLY this site's config
// (branding, modules, cameras) and renders it through the single shared template.
// Redesigning CustomerPortalTemplate updates every site — this page never forks it.
export default async function ClientPortalPage({ params }: { params: { slug: string } }) {
  const { data: portal } = await supabase
    .from('client_portals')
    .select('*')
    .ilike('slug', params.slug)
    .maybeSingle()

  if (!portal || portal.status === 'disabled') notFound()

  const branding = (portal.branding ?? {}) as { display_name?: string; accent?: string; logo_url?: string }

  // PIN gate — if a passcode is set, require a matching cookie before showing anything.
  if (portal.access_pin) {
    const verified = cookies().get(`pp_${params.slug}`)?.value === portal.access_pin
    if (!verified) return <PinGate slug={params.slug} displayName={branding.display_name || 'Community portal'} />
  }
  const config: PortalConfig = {
    display_name: branding.display_name || 'Community portal',
    accent: branding.accent || null,
    modules: (portal.modules as string[]) ?? ['gate', 'cameras', 'passes', 'activity', 'billing', 'service'],
    login_type: portal.login_type,
    slug: params.slug,
  }

  // Live data (real cameras, activity, balance) is wired in the next pass — for now
  // the template renders from config with the site's camera list + sensible demos.
  const camCfg = (portal.camera_ids as string[] | null) ?? null
  const cameras = (camCfg && camCfg.length)
    ? camCfg.map((c) => ({ id: c, name: c }))
    : [{ id: 'gate', name: 'Front gate' }, { id: 'lobby', name: 'Lobby' }, { id: 'pool', name: 'Pool' }, { id: 'garage', name: 'Garage' }]

  return (
    <CustomerPortalTemplate
      config={config}
      user={{ name: 'Resident', initials: 'R' }}
      cameras={cameras}
      balanceDue={180}
    />
  )
}
