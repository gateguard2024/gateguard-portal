import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

// GET /api/auth/google/connect?type=gmail|caldav|both
// Server-side OAuth initiation — same pattern as /api/calendar/google/connect
// Redirects to Google consent screen with the correct scopes and state.
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "gmail"; // "gmail" | "caldav" | "both"

  // Use whichever Google client ID is configured — same credential works for Gmail + Calendar
  const clientId = process.env.GOOGLE_CLIENT_ID
    ?? process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? "https://portal.gateguard.co";

  if (!clientId) {
    return NextResponse.redirect(
      `${appUrl}/messages/settings?error=google_not_configured`
    );
  }

  // Scopes by connection type
  const scopeMap: Record<string, string> = {
    gmail:  "https://mail.google.com/ openid email",
    caldav: "https://www.googleapis.com/auth/calendar openid email",
    both:   "https://mail.google.com/ https://www.googleapis.com/auth/calendar openid email",
  };
  const scope = scopeMap[type] ?? scopeMap.gmail;

  // Callback goes to /api/auth/gmail-oauth (handles both gmail + caldav)
  const redirectUri = `${appUrl}/api/auth/gmail-oauth`;

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: "code",
    scope,
    access_type:   "offline",
    prompt:        "consent",
    state:         type, // passed through to gmail-oauth callback
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}
