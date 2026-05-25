import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/contracts — list contracts for the current org
// Falls back to empty array if the contracts table doesn't exist yet (pre-migration)
export async function GET(_req: NextRequest) {
  try {
    const { data, error } = await supabase
      .from("contracts")
      .select(`
        id,
        contract_number,
        title,
        status,
        setup_amount,
        mrr,
        total_value,
        start_date,
        end_date,
        terms_summary,
        assigned_rep,
        client_org:organizations!client_org_id(id, name),
        site:sites!site_id(id, name),
        signatories:contract_signatories(id, role, name, email, signed, signed_at)
      `)
      .order("created_at", { ascending: false });

    // Table may not exist yet — return empty list gracefully
    if (error) {
      if (
        error.code === "42P01" || // relation does not exist
        error.message?.includes("does not exist")
      ) {
        return NextResponse.json({ contracts: [] });
      }
      throw error;
    }

    return NextResponse.json({ contracts: data ?? [] });
  } catch (err) {
    console.error("GET /api/contracts error:", err);
    return NextResponse.json({ contracts: [] });
  }
}

// POST /api/contracts — create a new contract
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      title,
      status = "draft",
      setup_amount = 0,
      mrr = 0,
      total_value = 0,
      start_date,
      end_date,
      terms_summary,
      assigned_rep,
      client_org_id,
      site_id,
    } = body;

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    // Generate contract number
    const { count } = await supabase
      .from("contracts")
      .select("*", { count: "exact", head: true });
    const contractNumber = `GG-CTR-${String((count ?? 0) + 1).padStart(5, "0")}`;

    const { data, error } = await supabase
      .from("contracts")
      .insert({
        contract_number: contractNumber,
        title,
        status,
        setup_amount,
        mrr,
        total_value,
        start_date: start_date || null,
        end_date: end_date || null,
        terms_summary: terms_summary || null,
        assigned_rep: assigned_rep || null,
        client_org_id: client_org_id || null,
        site_id: site_id || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return NextResponse.json(
          { error: "Contracts table not yet migrated. Run migration first." },
          { status: 503 }
        );
      }
      throw error;
    }

    return NextResponse.json({ contract: data }, { status: 201 });
  } catch (err) {
    console.error("POST /api/contracts error:", err);
    return NextResponse.json({ error: "Failed to create contract" }, { status: 500 });
  }
}
