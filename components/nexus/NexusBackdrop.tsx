'use client'

// The Nexus backdrop — ONE source of truth for the app's background.
//
// Why this exists: the dashboard painted its background inline in
// NexusHomeClient, while OpportunityLifecycle painted a DIFFERENT navy
// (`radial-gradient(circle at top left, #11183a, #050712 50%)`) at
// minHeight:100vh — which covered the dashboard's background whenever it opened.
// /aria and /tracker each had their own thing again. Same app, four navies.
//
// Two intensities:
//   'hero' — home screen: gradient + 48px grid + centre glow + top hairline.
//   'page' — every other full page: same gradient + same 48px grid + hairline,
//            but no centre glow. The glow is a hero device (an 860x360 ellipse
//            behind the logo) and reads as clutter behind dense data; the grid
//            is what makes a page feel like part of the app, so it carries.
//
// Sub-surfaces that already render inside a backdrop must stay TRANSPARENT and
// inherit it. Painting your own background is what caused this in the first place.

export type BackdropVariant = 'hero' | 'page'

// The base gradient. Every Nexus screen shares this exact value.
export const NEXUS_BG =
  'radial-gradient(ellipse at 50% 0%, rgba(0,124,255,0.22) 0%, transparent 42%),' +
  'radial-gradient(ellipse at 12% 32%, rgba(0,200,255,0.12) 0%, transparent 32%),' +
  'radial-gradient(ellipse at 84% 18%, rgba(79,70,229,0.18) 0%, transparent 34%),' +
  'linear-gradient(180deg, #020713 0%, #061426 48%, #01040d 100%)'

/**
 * Decorative layers only — render inside a `relative` container that already
 * carries `background: NEXUS_BG`. All layers are pointer-events-none and
 * aria-hidden so they never intercept a click or reach a screen reader.
 */
export function NexusBackdropLayers({ variant = 'page' }: { variant?: BackdropVariant }) {
  return (
    <>
      {/* The 48px grid — on EVERY variant. This is the layer that makes a screen
          read as part of Nexus, so it must not stop at the home screen. It fades
          out down the page, so long content-heavy screens (Ops Hub, Work Orders)
          aren't sitting on a full-strength grid all the way to the footer. */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,200,255,0.095) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(0,124,255,0.095) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.85), rgba(0,0,0,0.28) 62%, transparent)',
        }}
      />
      {/* Centre glow — hero only. It's an 860x360 ellipse positioned behind the
          home logo; on a data page it just reads as a smudge. */}
      {variant === 'hero' && (
        <div
          className="pointer-events-none absolute left-1/2 top-[24%]"
          aria-hidden="true"
          style={{
            transform: 'translate(-50%, -50%)',
            width: 860,
            height: 360,
            background: 'radial-gradient(ellipse, rgba(0,124,255,0.22) 0%, rgba(0,200,255,0.10) 28%, transparent 70%)',
            borderRadius: '999px',
            filter: 'blur(10px)',
          }}
        />
      )}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        aria-hidden="true"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(0,200,255,0.55), transparent)' }}
      />
    </>
  )
}

/**
 * Full-page wrapper for standalone routes (/aria, /tracker, /lifecycle) that are
 * NOT nested inside NexusHomeClient's shell and therefore have to paint their
 * own background. Children render above the decorative layers.
 */
export function NexusBackdrop({
  variant = 'page',
  className = '',
  children,
}: {
  variant?: BackdropVariant
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={`relative min-h-screen ${className}`} style={{ background: NEXUS_BG }}>
      <NexusBackdropLayers variant={variant} />
      <div className="relative">{children}</div>
    </div>
  )
}
