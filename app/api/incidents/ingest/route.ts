import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/incidents/ingest — ingest an incident event from an external source
// (GGSOC bridge, webhook, hardware alarm, etc.)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      title,
      description,
      severity = "medium",
      site_id,
      source = "external",
      metadata = {},
    } = body;

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("incidents")
      .insert({
        title,
        description,
        severity,
        site_id: site_id || null,
        source,
        status: "open",
        metadata,
        occurred_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ incident: data }, { status: 201 });
  } catch (err) {
    console.error("POST /api/incidents/ingest error:", err);
    return NextResponse.json({ error: "Failed to ingest incident" }, { status: 500 });
  }
}
