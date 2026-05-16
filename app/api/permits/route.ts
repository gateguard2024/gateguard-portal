import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/current-user";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/permits — list permits for current org, using permits_with_status view
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status"); // optional: expired | expiring_soon | compliant

    let query = supabase
      .from("permits_with_status")
      .select("*")
      .order("expiry_date", { ascending: true, nullsFirst: false });

    if (!user.isCorporate && user.org_id) {
      query = query.eq("org_id", user.org_id);
    }
    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ permits: data ?? [] });
  } catch (err) {
    console.error("GET /api/permits error:", err);
    return NextResponse.json({ error: "Failed to load permits" }, { status: 500 });
  }
}

// POST /api/permits — create a new permit record
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user.isCorporate && !user.isMasterDealer && !user.isFullDealer) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      site_id, type, label, issued_by, permit_number,
      issue_date, expiry_date, document_url, notes,
    } = body;

    if (!type) {
      return NextResponse.json({ error: "type is required" }, { status: 400 });
    }

    const { data, error } = await supabase.from("permits").insert({
      org_id:        user.org_id,
      site_id:       site_id || null,
      type,
      label:         label?.trim() || null,
      issued_by:     issued_by?.trim() || null,
      permit_number: permit_number?.trim() || null,
      issue_date:    issue_date || null,
      expiry_date:   expiry_date || null,
      document_url:  document_url || null,
      notes:         notes?.trim() || null,
    }).select().single();

    if (error) throw error;
    return NextResponse.json({ permit: data }, { status: 201 });
  } catch (err) {
    console.error("POST /api/permits error:", err);
    return NextResponse.json({ error: "Failed to create permit" }, { status: 500 });
  }
}
