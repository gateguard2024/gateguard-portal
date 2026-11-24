// /portal/<slug>/clip/<secret> — a shared clip (police / insurance). Public: the private
// link is the permission (lib/clip-shares.ts). Shows the property, camera, time and the
// recording; expired / turned-off links say so.
import { createClient } from '@supabase/supabase-js'
import { resolveShare } from '@/lib/clip-shares'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false, follow: false } }

export default async function SharedClip({ params }: { params: { slug: string; token: string } }) {
  const r = await resolveShare(params.token)
  const ok = !('error' in r) && r.share.slug.toLowerCase() === params.slug.toLowerCase()
  let property = ''
  if (ok) {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data } = await sb.from('sites').select('name').eq('id', r.share.site_id).maybeSingle()
    property = data?.name ?? ''
  }
  const when = ok ? new Date(r.share.ts).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'long' }) : ''
  const src = ok ? `/api/portal/${encodeURIComponent(params.slug)}/shared-clip/${params.token}` : ''
  return (
    <main style={{ minHeight: '100dvh', background: '#F5F5F7', color: '#1D1D1F', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif', padding: '32px 16px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gap: 16 }}>
        <div style={{ fontSize: 13, color: '#6E6E73', fontWeight: 600 }}>Gate Guard · shared recording</div>
        {!ok ? (
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, border: '1px solid rgba(0,0,0,.08)' }}>
            <h1 style={{ fontSize: 22, margin: 0 }}>{'error' in r && r.error === 'expired' ? 'This link has expired' : 'error' in r && r.error === 'revoked' ? 'This link was turned off' : 'Link not found'}</h1>
            <p style={{ color: '#6E6E73', marginBottom: 0 }}>Ask the property for a new link.</p>
          </div>
        ) : (
          <>
            <div>
              <h1 style={{ fontSize: 24, margin: 0, fontWeight: 600 }}>{r.share.camera_name}{property ? ` — ${property}` : ''}</h1>
              <div style={{ color: '#3A3A3C', marginTop: 4 }}>{when} (Eastern)</div>
              {r.share.note && <div style={{ color: '#6E6E73', marginTop: 4 }}>{r.share.note}</div>}
            </div>
            <video src={src} controls playsInline preload="metadata" style={{ width: '100%', borderRadius: 14, background: '#000', aspectRatio: '16 / 9' }} />
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 13, color: '#6E6E73' }}>
              <a href={src} download style={{ padding: '9px 14px', borderRadius: 10, background: '#0071E3', color: '#fff', fontWeight: 600, textDecoration: 'none' }}>Download video</a>
              <span>Shared by {r.share.by} · link works until {new Date(r.share.expires_at).toLocaleDateString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium' })}</span>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
