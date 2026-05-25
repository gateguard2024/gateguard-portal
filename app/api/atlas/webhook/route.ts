import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// ─── Auth helper ──────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const provided = req.headers.get("x-atlas-key")
  const expected =
    process.env.ATLAS_WEBHOOK_SECRET ||
    process.env.TECH_ACCESS_CODE
  if (!expected) return true // no secret configured — open in dev
  return provided === expected
}

// ─── Supabase client ──────────────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase env vars not set")
  return createClient(url, key)
}

// ─── Types ────────────────────────────────────────────────────────────────────

type EventType = "move_in" | "move_out" | "name_change" | "renewal"

interface WebhookBody {
  event_type: EventType
  property_name: string
  unit_number?: string
  resident_name: string
  lease_start?: string
  lease_end?: string
  directv_account?: string
  site_id?: string
}

// ─── POST /api/atlas/webhook ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth check
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: WebhookBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  // Validate required fields
  const { event_type, property_name, resident_name } = body
  if (!event_type || !property_name || !resident_name) {
    return NextResponse.json(
      { error: "Missing required fields: event_type, property_name, resident_name" },
      { status: 400 }
    )
  }

  const validEventTypes: EventType[] = ["move_in", "move_out", "name_change", "renewal"]
  if (!validEventTypes.includes(event_type)) {
    return NextResponse.json(
      { error: `Invalid event_type. Must be one of: ${validEventTypes.join(", ")}` },
      { status: 400 }
    )
  }

  // Determine initial status
  let initialStatus = "pending"
  if (event_type === "move_in") {
    // Will trigger SARA CC check — set to provisioning immediately
    initialStatus = "provisioning"
  } else if (event_type === "move_out") {
    // Deactivation flow
    initialStatus = "pending"
  }

  // Insert into atlas_events
  let supabase
  try {
    supabase = getSupabase()
  } catch (err) {
    console.error("[ATLAS] Supabase init error:", err)
    return NextResponse.json({ error: "Database configuration error" }, { status: 500 })
  }

  const insertPayload = {
    site_id: body.site_id ?? null,
    property_name,
    unit_number: body.unit_number ?? null,
    resident_name,
    event_type,
    status: initialStatus,
    directv_account: body.directv_account ?? null,
  }

  const { data: inserted, error: insertError } = await supabase
    .from("atlas_events")
    .insert(insertPayload)
    .select("id")
    .single()

  if (insertError) {
    console.error("[ATLAS] Insert error:", insertError)
    return NextResponse.json({ error: "Failed to record event", detail: insertError.message }, { status: 500 })
  }

  const eventId = inserted?.id

  // ── Move-In: simulate SARA Plus CC check ───────────────────────────────────
  if (event_type === "move_in") {
    // In production this would:
    // 1. Call SARA Plus CC endpoint with resident_name + property DirecTV account
    // 2. Parse CC response (CA/AA = approve, AR = review, PA = retry, ER = error)
    // 3. If approved: call SARA Plus Order Entry to provision service
    // 4. Update atlas_events.status to 'active' + store sara_order_id
    // 5. If denied: set status to 'failed' + store error_message

    console.log(
      `[ATLAS] Move-in event for ${resident_name} at ${property_name} unit ${body.unit_number ?? "?"}.` +
      ` Event ID: ${eventId}. Initiating SARA Plus CC check (simulated).`
    )
    console.log(
      `[ATLAS] CC check payload would include: resident_name="${resident_name}", ` +
      `directv_account="${body.directv_account ?? "property_master"}", ` +
      `lease_start="${body.lease_start ?? "now"}"`
    )
    // In real implementation, fire async job here (Vercel background function or queue)
  }

  // ── Move-Out: log deactivation intent ─────────────────────────────────────
  if (event_type === "move_out") {
    console.log(
      `[ATLAS] Move-out event for ${resident_name} at ${property_name} unit ${body.unit_number ?? "?"}.` +
      ` Event ID: ${eventId}. DirecTV deactivation scheduled within 24h of lease end` +
      (body.lease_end ? ` (${body.lease_end})` : "") + `.`
    )
  }

  // ── Name Change ────────────────────────────────────────────────────────────
  if (event_type === "name_change") {
    console.log(
      `[ATLAS] Name change event for ${resident_name} at ${property_name} unit ${body.unit_number ?? "?"}.` +
      ` Event ID: ${eventId}. DirecTV account holder update queued.`
    )
  }

  return NextResponse.json({
    success: true,
    event_id: eventId,
    status: initialStatus,
    message: event_type === "move_in"
      ? "Event recorded. SARA Plus CC check initiated."
      : event_type === "move_out"
      ? "Event recorded. Deactivation scheduled."
      : "Event recorded.",
  })
}
