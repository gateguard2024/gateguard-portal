import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/messages/threads
// Query params: channel_id, linked_wo_id, linked_quote_id, unread=true, limit, offset
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const channelId   = searchParams.get("channel_id");
  const linkedWoId  = searchParams.get("linked_wo_id");
  const linkedQuote = searchParams.get("linked_quote_id");
  const unreadOnly  = searchParams.get("unread") === "true";
  const limit       = Math.min(parseInt(searchParams.get("limit")  ?? "50"), 100);
  const offset      = parseInt(searchParams.get("offset") ?? "0");

  const supabase = createClient();

  let query = supabase
    .from("message_threads")
    .select(`
      id,
      channel_id,
      subject,
      participants,
      last_message_at,
      unread_count,
      linked_wo_id,
      linked_quote_id,
      linked_site_id,
      linked_calendar_event_id,
      created_at,
      message_channels ( channel_type, display_name ),
      messages ( id, body, direction, source_type, from_name, sent_at, created_at )
    `)
    .eq("user_id", userId)
    .order("last_message_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (channelId)   query = query.eq("channel_id", channelId);
  if (linkedWoId)  query = query.eq("linked_wo_id", linkedWoId);
  if (linkedQuote) query = query.eq("linked_quote_id", linkedQuote);
  if (unreadOnly)  query = query.gt("unread_count", 0);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ threads: data ?? [] });
}

// POST /api/messages/threads — create a new thread
export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    channel_id: string;
    subject?: string;
    participants: { name?: string; address: string }[];
    linked_wo_id?: string;
    linked_quote_id?: string;
    linked_site_id?: string;
  };

  if (!body.channel_id || !body.participants?.length) {
    return NextResponse.json({ error: "channel_id and participants required" }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("message_threads")
    .insert({
      user_id:         userId,
      org_id:          orgId ?? null,
      channel_id:      body.channel_id,
      subject:         body.subject ?? null,
      participants:    body.participants,
      linked_wo_id:    body.linked_wo_id    ?? null,
      linked_quote_id: body.linked_quote_id ?? null,
      linked_site_id:  body.linked_site_id  ?? null,
    })
    .select("id, channel_id, subject, participants, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ thread: data }, { status: 201 });
}
