/**
 * middleware.ts
 *
 * Auth middleware for portal.gateguard.co
 *
 * /tech and its API routes bypass Clerk entirely — they use
 * x-tech-code header auth handled inside the route handlers.
 *
 * Everything else requires a valid Clerk session.
 */

import { NextRequest, NextResponse } from 'next/server'
import { clerkMiddleware } from '@clerk/nextjs/server'

// These paths never touch Clerk — short-circuit immediately
function isBypassPath(pathname: string): boolean {
  return (
    pathname.startsWith('/tech') ||
    pathname.startsWith('/api/kb/ask') ||
    pathname.startsWith('/api/kb/products') ||
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/sign-up') ||
    pathname.startsWith('/sso-callback') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  )
}

export default clerkMiddleware(async (auth, req: NextRequest) => {
  // Hard bypass — never run Clerk for these paths
  if (isBypassPath(req.nextUrl.pathname)) {
    return NextResponse.next()
  }

  // Require Clerk session for everything else
  const { userId } = await auth()
  if (!userId) {
    const signInUrl = new URL('/sign-in', req.url)
    signInUrl.searchParams.set('redirect_url', req.url)
    return NextResponse.redirect(signInUrl)
  }
})

export const config = {
  matcher: ['/(.*)'],
}
