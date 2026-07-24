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
  // 2036 Hybrid canvas: charcoal-navy that reads clearly (not near-black). Base runs
  // #0b1329 -> #101b3b -> #16254d with teal/cyan/indigo accent glows up top. One
  // token; every Nexus screen inherits it.
  'radial-gradient(ellipse at 50% -6%, rgba(45,212,191,0.16) 0%, transparent 44%),' +
  'radial-gradient(ellipse at 86% 8%, rgba(56,189,248,0.16) 0%, transparent 38%),' +
  'radial-gradient(ellipse at 8% 26%, rgba(79,70,229,0.14) 0%, transparent 36%),' +
  'linear-gradient(160deg, #0b1329 0%, #101b3b 55%, #16254d 100%)'

/**
 * Decorative layers only — render inside a `relative` container that already
 * carries `background: NEXUS_BG`. All layers are pointer-events-none and
 * aria-hidden so they never intercept a click or reach a screen reader.
 */
export function NexusBackdropLayers({ variant = 'page' }: { variant?: BackdropVariant }) {
  return (
    <>
      {/* Global darkening scrim — ~8%. The glass panels are translucent over the
          backdrop, so darkening behind them reads as slightly darker / less
          see-through glass across the whole app, in one place. Sits below the
          grid so the grid stays visible; behind all content so text is untouched. */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{ background: 'rgba(2,6,16,0.03)' }}
      />
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
      {/* Constellation mesh — hero only (July 2026 mockup, §1 of
          docs/nexus/COSMETIC_GUIDE_2026-07_MOCKUP.md). Fixed node positions —
          NEVER Math.random() here (SSR mismatch + the PIPELINE_PARTICLES lesson).
          Strokes sit at ~0.06 alpha so text contrast is untouched. */}
      {variant === 'hero' && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
          preserveAspectRatio="xMidYMin slice"
          viewBox="0 0 1440 900"
        >
          <g stroke="rgba(0,200,255,0.06)" strokeWidth="1" fill="none">
            <path d="M60 80 L220 40 L390 110 L300 250 L60 80" />
            <path d="M220 40 L300 250 L120 330 L60 80" />
            <path d="M390 110 L560 60 L640 200 L300 250" />
            <path d="M1380 90 L1220 50 L1080 130 L1180 270 L1380 90" />
            <path d="M1220 50 L1180 270 L1340 330" />
            <path d="M1080 130 L900 70 L840 210 L1180 270" />
            <path d="M120 330 L260 480 L90 560" />
            <path d="M1340 330 L1200 500 L1370 590" />
            <path d="M640 200 L720 90 L840 210" />
          </g>
          <g fill="rgba(0,200,255,0.16)">
            {[
              [60, 80], [220, 40], [390, 110], [300, 250], [120, 330], [560, 60],
              [640, 200], [720, 90], [840, 210], [900, 70], [1080, 130], [1220, 50],
              [1180, 270], [1380, 90], [1340, 330], [260, 480], [90, 560], [1200, 500], [1370, 590],
            ].map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="2" />
            ))}
          </g>
        </svg>
      )}
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
