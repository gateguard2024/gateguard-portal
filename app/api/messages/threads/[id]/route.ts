import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/messages/threads/[id] — thread detail + messages
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient();

  // Fetch thread (verifies ownership via RLS)
  const { data: thread, error: threadErr } = await supabase
    .from("message_threads")
    .select(`
      id, channel_id, subject, participants,
      last_message_at, unread_count,
      linked_wo_id, linked_quote_id, linked_site_id, linked_calendar_event_id,
      created_at,
      message_channels ( channel_type, display_name )
    `)
    .eq("id", params.id)
    .eq("user_id", userId)
    .single();

  if (threadErr) return NextResponse.json({ error: threadErr.message }, { status: 500 });
  if (!thread)   return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch messages for this thread
  const { data: messages, error: msgErr } = await supabase
    .from("messages")
    .select("id, direction, source_type, from_address, from_name, subject, body, body_html, attachments, status, sent_at, read_at, created_at")
    .eq("thread_id", params.id)
    .order("created_at", { ascending: true });

  if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 });

  // Mark thread as read
  void (async () => {
    try {
      await supabase
        .from("message_threads")
        .update({ unread_count: 0 })
        .eq("id", params.id)
        .eq("user_id", userId);

      await supabase
        .from("messages")
        .update({ status: "read", read_at: new Date().toISOString() })
        .eq("thread_id", params.id)
        .eq("direction", "inbound")
        .is("read_at", null);
    } catch (_) {}
  })();

  return NextResponse.json({ thread, messages: messages ?? [] });
}

// PATCH /api/messages/threads/[id] — update links or metadata
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;
  const allowed = ["subject", "linked_wo_id", "linked_quote_id", "linked_site_id", "linked_calendar_event_id"];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No updatable fields" }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("message_threads")
    .update(update)
    .eq("id", params.id)
    .eq("user_id", userId)
    .select("id, subject, linked_wo_id, linked_quote_id, linked_site_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ thread: data });
}
