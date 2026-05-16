import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/current-user";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/reps/commissions?period=2026-05 — payout records for current org
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period"); // optional "YYYY-MM" filter

    let query = supabase
      .from("rep_commissions")
      .select(`
        id, rep_id, pay_period, amount_cents, door_count, status, paid_at,
        sales_reps ( name )
      `)
      .order("pay_period", { ascending: false })
      .order("amount_cents", { ascending: false });

    if (!user.isCorporate && user.org_id) {
      query = query.eq("org_id", user.org_id);
    }
    if (period) {
      query = query.eq("pay_period", period);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ commissions: data ?? [] });
  } catch (err) {
    console.error("GET /api/reps/commissions error:", err);
    return NextResponse.json({ error: "Failed to load commissions" }, { status: 500 });
  }
}

// PATCH /api/reps/commissions — mark payout as paid/approved
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user.isCorporate && !user.isMasterDealer) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id, status } = await req.json();
    if (!id || !status) {
      return NextResponse.json({ error: "id and status required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (status === "paid") updates.paid_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("rep_commissions")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ commission: data });
  } catch (err) {
    console.error("PATCH /api/reps/commissions error:", err);
    return NextResponse.json({ error: "Failed to update commission" }, { status: 500 });
  }
}
