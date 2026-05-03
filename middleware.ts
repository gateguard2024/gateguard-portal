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
    pathname.startsWith('/tech') ||
    pathname.startsWith('/api/kb/ask') ||
    pathname.startsWith('/api/kb/products') ||
    pathname.startsWith('/api/kb/analyze-image') ||
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/sign-up') ||
    pathname.startsWith('/sso-callback')
  )
}

// Clerk handler — only invoked for portal routes
const clerkHandler = clerkMiddleware(async (auth, req) => {
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
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico).*)',
  ],
}
