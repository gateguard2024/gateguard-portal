import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/current-user";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/reps — list reps for current org (+ sub-orgs if corporate/master_dealer)
export async function GET() {
  try {
    const user = await getCurrentUser();

    let query = supabase
      .from("sales_reps")
      .select(`
        id, name, email, phone, tier, parent_rep_id,
        commission_rate, pipeline_value, active_sites, is_active, notes,
        created_at
      `)
      .order("tier", { ascending: true })
      .order("name", { ascending: true });

    if (!user.isCorporate && user.org_id) {
      query = query.eq("org_id", user.org_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ reps: data ?? [] });
  } catch (err) {
    console.error("GET /api/reps error:", err);
    return NextResponse.json({ error: "Failed to load reps" }, { status: 500 });
  }
}

// POST /api/reps — create a new rep
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user.isCorporate && !user.isMasterDealer && !user.isFullDealer) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { name, email, phone, tier, parent_rep_id, commission_rate, notes } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const { data, error } = await supabase.from("sales_reps").insert({
      org_id:          user.org_id,
      name:            name.trim(),
      email:           email?.trim() || null,
      phone:           phone?.trim() || null,
      tier:            tier || "rep",
      parent_rep_id:   parent_rep_id || null,
      commission_rate: commission_rate ?? 0,
      notes:           notes?.trim() || null,
    }).select().single();

    if (error) throw error;
    return NextResponse.json({ rep: data }, { status: 201 });
  } catch (err) {
    console.error("POST /api/reps error:", err);
    return NextResponse.json({ error: "Failed to create rep" }, { status: 500 });
  }
}
