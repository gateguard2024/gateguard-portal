/**
 * middleware.ts
 *
 * Auth middleware for portal.gateguard.co
 *
 * /tech is a fully public route — Clerk never touches it.
 * The plain middleware function intercepts /tech first and returns
 * NextResponse.next() before Clerk's wrapper ever initialises.
 *
 * Everything else goes through Clerk — requires a valid session.
 */

import { NextRequest, NextFetchEvent, NextResponse } from 'next/server'
import { clerkMiddleware } from '@clerk/nextjs/server'

// Paths that bypass Clerk entirely
function isBypassPath(pathname: string): boolean {
  return (
    // /tech tool — field techs auth via x-tech-code header, not Clerk
    pathname.startsWith('/tech') ||
    // All /tech API routes — authenticated via x-tech-code only
    // Exception: parse-survey-transcript is also called from the portal (/survey page)
    // so it needs Clerk to run. It accepts EITHER x-tech-code OR a Clerk session.
    (pathname.startsWith('/api/kb/') && !pathname.startsWith('/api/kb/parse-survey-transcript')) ||
    pathname.startsWith('/api/plaud/') ||
    // Client-facing quote pages ONLY — the internal builder (/quotes, /quotes/new,
    // /quotes/[id]) stays behind Clerk. Public = proposal + approve views only.
    (/^\/quotes\/[^/]+\/(proposal|approve)(\/|$)/.test(pathname)) ||
    // Conference landing page — public lead capture
    pathname.startsWith('/show') ||
    // Show lead API — called from public page
    pathname.startsWith('/api/show-lead') ||
    // NOTE: /api/crm/ was previously bypassed here — removed because it caused
    // getCurrentUser() to fall back to SYSTEM_USER for all CRM routes,
    // logging every activity under Russel's account instead of the logged-in user.
    // show_leads capture uses /api/show-lead (already bypassed above), not /api/crm/.
    // Property request portal — public form for property managers (no Clerk)
    pathname.startsWith('/request/') ||
    pathname.startsWith('/api/request') ||
    // E-sign pages — public signing UI, token IS the auth
    pathname.startsWith('/sign/') ||
    // Public signature token endpoints — GET doc info + POST sign (token-based, no Clerk)
    // /send, /countersign, /by-record, /upload all require Clerk
    // /[token]/sign, /[id]/cert are public (token/ID-based access)
    (pathname.startsWith('/api/signatures/') &&
      !['send', 'countersign', 'by-record', 'upload'].some(
        p => pathname.slice('/api/signatures/'.length).startsWith(p)
      )
    ) ||
    // Inngest webhook — event routing; platform authenticates via signing key
    pathname.startsWith('/api/inngest') ||
    // Stripe webhook — raw HTTP POST with Stripe-Signature header, no Clerk session
    pathname.startsWith('/api/billing/webhook') ||
    // Clerk webhook — verified via Svix signature, no Clerk session
    pathname.startsWith('/api/webhooks/clerk') ||
    // Public Nexus Document Portal — external no-login document pages (slug + token credential)
    pathname.startsWith('/document/') ||
    pathname.startsWith('/api/document/') ||
    // Auth flows
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/sign-up') ||
    pathname.startsWith('/sso-callback')
  )
}

// Clerk handler — only invoked for portal routes
const clerkHandler = clerkMiddleware(async (auth, req) => {
  const pathname = req.nextUrl.pathname

  // ARIA API routes: Clerk initialises here so auth() calls in handlers work,
  // but we do NOT force a redirect — each handler validates auth itself.
  // This supports both portal sessions (GET routes) and server-to-server
  // service-key POSTs (deep research → /api/aria/properties upsert, Inngest).
  if (pathname.startsWith('/api/aria/')) {
    return NextResponse.next()
  }

  const { userId } = await auth()
  if (!userId) {
    const signInUrl = new URL('/sign-in', req.url)
    signInUrl.searchParams.set('redirect_url', req.url)
    return NextResponse.redirect(signInUrl)
  }
})

// Plain Next.js middleware — runs before Clerk
export function middleware(req: NextRequest, event: NextFetchEvent) {
  if (isBypassPath(req.nextUrl.pathname)) {
    return NextResponse.next()
  }
  return clerkHandler(req, event)
}

export const config = {
  // Note: favicon.ico must NOT be escaped — path-to-regexp does not use regex backslash syntax
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
