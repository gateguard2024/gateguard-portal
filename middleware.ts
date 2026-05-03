/**
 * middleware.ts
 *
 * Clerk auth middleware for portal.gateguard.co
 *
 * Public routes (no Clerk session required):
 *   /tech          — field tech tool (uses x-tech-code header auth instead)
 *   /api/kb/ask    — also accepts x-tech-code (checked inside the route)
 *   /api/kb/products — also accepts x-tech-code (checked inside the route)
 *   /sign-in, /sign-up, /sso-callback
 *
 * Everything else requires a valid Clerk session.
 */

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublic = createRouteMatcher([
  '/tech(.*)',
  '/api/kb/ask(.*)',
  '/api/kb/products(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/sso-callback(.*)',
])

export default clerkMiddleware((auth, req) => {
  if (!isPublic(req)) {
    auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
