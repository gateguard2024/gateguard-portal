/**
 * /app — one link for the GateGuard resident app (emails, texts, move-in Done screen).
 * iPhone → App Store, Android → Google Play, anything else → a page with both buttons.
 * Store links come from RESIDENT_APP_STORE_URL / RESIDENT_PLAY_STORE_URL (Vercel env).
 * Until the app is published, everyone gets the page with a "coming soon" note.
 */
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Get the GateGuard app' }

export default function AppLinkPage() {
  const ua = headers().get('user-agent') ?? ''
  const ios = process.env.RESIDENT_APP_STORE_URL || ''
  const play = process.env.RESIDENT_PLAY_STORE_URL || ''
  const isIOS = /iPhone|iPad|iPod/i.test(ua)
  const isAndroid = /Android/i.test(ua)
  if (isIOS && ios) redirect(ios)
  if (isAndroid && play) redirect(play)

  const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif'
  const store = (href: string, small: string, big: string) => (
    <a href={href} style={{ display: 'block', background: '#000', color: '#fff', textDecoration: 'none', borderRadius: 12, padding: '10px 20px', minWidth: 200, border: '1px solid rgba(255,255,255,.25)' }}>
      <span style={{ display: 'block', fontSize: 11, opacity: 0.8 }}>{small}</span>
      <span style={{ display: 'block', fontSize: 20, fontWeight: 600 }}>{big}</span>
    </a>
  )
  return (
    <main style={{ minHeight: '100vh', background: 'radial-gradient(120% 80% at 50% 0%, #12305C 0%, #0A192F 55%, #060D1A 100%)', color: '#fff', fontFamily: FONT, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, padding: 24, textAlign: 'center' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-sm.png" width={72} height={72} alt="GateGuard" />
      <h1 style={{ margin: 0, fontSize: 32, fontWeight: 600, letterSpacing: '-.02em' }}>Get the GateGuard app</h1>
      <p style={{ margin: 0, maxWidth: 380, color: 'rgba(255,255,255,.75)', fontSize: 16, lineHeight: 1.5 }}>
        Your phone is your key. Download the app, then sign in with the email you set up with — we’ll send a code. No password.
      </p>
      {ios || play ? (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          {(isIOS || !isAndroid) && ios ? store(ios, 'Download on the', 'App Store') : null}
          {(isAndroid || !isIOS) && play ? store(play, 'GET IT ON', 'Google Play') : null}
        </div>
      ) : (
        <div style={{ background: 'rgba(255,255,255,.08)', borderRadius: 12, padding: '14px 18px', maxWidth: 380, fontSize: 14, color: 'rgba(255,255,255,.85)' }}>
          The app is on its way to the App Store and Google Play. Your access is already on — we’ll email you the moment it’s ready.
        </div>
      )}
    </main>
  )
}
