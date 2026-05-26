import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/incidents/ingest — ingest an incident from an external source
// (GGSOC alarm bridge, EEN webhook, hardware alarm, etc.)
//
// Body: { title, description?, severity?, site_id?, source?, source_ext_id?, source_system?, metadata? }
// source_ext_id = GGSOC alarm UUID (stored for later resolution via PATCH)
// source_system = 'ggsoc' | 'brivo' | 'eagle_eye' etc.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      title,
      description,
      severity = "medium",
      site_id,
      source = "external",
      source_ext_id,
      source_system,
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
        source_ext_id: source_ext_id || null,
        source_system: source_system || null,
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

// PATCH /api/incidents/ingest — resolve a bridged incident by source_ext_id
//
// Body: { source_ext_id, source_system?, resolution_note?, resolved_by? }
// Used by GGSOC audit route when an operator marks an alarm resolved.
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      source_ext_id,
      source_system = "ggsoc",
      resolution_note,
      resolved_by = "GGSOC Operator",
    } = body;

    if (!source_ext_id) {
      return NextResponse.json({ error: "source_ext_id is required" }, { status: 400 });
    }

    // Find the open incident for this external alarm ID
    const { data: incidents, error: findErr } = await supabase
      .from("incidents")
      .select("id, status, metadata")
      .eq("source_ext_id", source_ext_id)
      .eq("source_system", source_system)
      .limit(1);

    if (findErr) throw findErr;

    if (!incidents?.length) {
      // Incident not found — not an error; alarm may have been auto-dismissed before bridge ran
      return NextResponse.json({ resolved: false, reason: "incident not found" });
    }

    const incident = incidents[0];

    if (incident.status === "resolved") {
      return NextResponse.json({ resolved: false, reason: "already resolved" });
    }

    const updatedMetadata = {
      ...(incident.metadata ?? {}),
      resolved_by,
      resolution_note: resolution_note || null,
      resolved_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("incidents")
      .update({
        status: "resolved",
        metadata: updatedMetadata,
      })
      .eq("id", incident.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ resolved: true, incident: data });
  } catch (err) {
    console.error("PATCH /api/incidents/ingest error:", err);
    return NextResponse.json({ error: "Failed to resolve incident" }, { status: 500 });
  }
}
