import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/messages/channels — list all channels for the current user
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient();
  void (async () => {
    try {
      await supabase.from("message_channels").select("id").limit(1);
    } catch (_) {}
  })();

  const { data, error } = await supabase
    .from("message_channels")
    .select("id, channel_type, display_name, is_active, last_synced_at, config, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Strip sensitive fields from config before returning
  const sanitized = (data ?? []).map((ch) => ({
    ...ch,
    config: sanitizeConfig(ch.config as Record<string, unknown>),
  }));

  return NextResponse.json({ channels: sanitized });
}

// POST /api/messages/channels — create a new channel (SMTP, phone, Twilio, CalDAV)
export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    channel_type: string;
    display_name: string;
    config: Record<string, unknown>;
  };

  const { channel_type, display_name, config } = body;
  if (!channel_type || !display_name) {
    return NextResponse.json({ error: "channel_type and display_name are required" }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("message_channels")
    .insert({
      user_id:      userId,
      org_id:       orgId ?? null,
      channel_type,
      display_name,
      config:       config ?? {},
      is_active:    true,
    })
    .select("id, channel_type, display_name, is_active, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ channel: data }, { status: 201 });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeConfig(config: Record<string, unknown>): Record<string, unknown> {
  const sensitive = ["password", "auth_token", "smtp_password", "secret", "oauth_access_token", "oauth_refresh_token"];
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    out[k] = sensitive.some((s) => k.toLowerCase().includes(s)) ? "••••••••" : v;
  }
  return out;
}
