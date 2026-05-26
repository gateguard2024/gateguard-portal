import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

const GOOGLE_TOKEN_URL    = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

// GET /api/auth/gmail-oauth?code=...&state=...
// Google redirects here after user approves Gmail/CalDAV scope.
export async function GET(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  const { searchParams } = new URL(req.url);
  const code  = searchParams.get("code");
  const error = searchParams.get("error");
  const state = searchParams.get("state"); // "gmail" | "caldav" | "both"

  if (error || !code) {
    return NextResponse.redirect(new URL("/messages/settings?error=oauth_denied", req.url));
  }

  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri  = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/auth/gmail-oauth`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/messages/settings?error=google_not_configured", req.url));
  }

  // Exchange code for tokens
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     clientId,
      client_secret: clientSecret,
      redirect_uri:  redirectUri,
      grant_type:    "authorization_code",
    }).toString(),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/messages/settings?error=token_exchange_failed", req.url));
  }

  const tokens = await tokenRes.json() as {
    access_token:  string;
    refresh_token?: string;
    expires_in:    number;
    scope:         string;
  };

  // Get Gmail address for display name
  let emailAddress = "Gmail account";
  try {
    const infoRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (infoRes.ok) {
      const info = await infoRes.json() as { email?: string };
      if (info.email) emailAddress = info.email;
    }
  } catch (_) {}

  const expiry = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();
  const isCalDAV = state === "caldav" || state === "both";
  const isGmail  = !state || state === "gmail" || state === "both";

  const supabase = createClient();

  // Upsert Gmail channel
  if (isGmail) {
    void (async () => {
      try {
        const existing = await supabase
          .from("message_channels")
          .select("id")
          .eq("user_id", userId)
          .eq("channel_type", "gmail")
          .maybeSingle();

        if (existing.data?.id) {
          await supabase
            .from("message_channels")
            .update({
              oauth_access_token:  tokens.access_token,
              oauth_refresh_token: tokens.refresh_token ?? null,
              oauth_expiry:        expiry,
              oauth_scope:         tokens.scope,
              display_name:        emailAddress,
              is_active:           true,
            })
            .eq("id", existing.data.id);
        } else {
          await supabase
            .from("message_channels")
            .insert({
              user_id:             userId,
              org_id:              orgId ?? null,
              channel_type:        "gmail",
              display_name:        emailAddress,
              is_active:           true,
              oauth_access_token:  tokens.access_token,
              oauth_refresh_token: tokens.refresh_token ?? null,
              oauth_expiry:        expiry,
              oauth_scope:         tokens.scope,
              config:              { email: emailAddress },
            });
        }
      } catch (_) {}
    })();
  }

  // Upsert CalDAV channel (uses same Google OAuth token)
  if (isCalDAV) {
    void (async () => {
      try {
        const existing = await supabase
          .from("message_channels")
          .select("id")
          .eq("user_id", userId)
          .eq("channel_type", "caldav")
          .maybeSingle();

        if (existing.data?.id) {
          await supabase
            .from("message_channels")
            .update({
              oauth_access_token:  tokens.access_token,
              oauth_refresh_token: tokens.refresh_token ?? null,
              oauth_expiry:        expiry,
              is_active:           true,
            })
            .eq("id", existing.data.id);
        } else {
          await supabase
            .from("message_channels")
            .insert({
              user_id:             userId,
              org_id:              orgId ?? null,
              channel_type:        "caldav",
              display_name:        `Google Calendar (${emailAddress})`,
              is_active:           true,
              oauth_access_token:  tokens.access_token,
              oauth_refresh_token: tokens.refresh_token ?? null,
              oauth_expiry:        expiry,
              config:              {
                caldav_url:  "https://apidata.googleusercontent.com/caldav/v2/",
                email:       emailAddress,
              },
            });
        }
      } catch (_) {}
    })();
  }

  return NextResponse.redirect(new URL("/messages/settings?connected=gmail", req.url));
}
