import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/renewals — contracts expiring within 90 days, bucketed by urgency
// Falls back to empty array if the contracts table doesn't exist yet (pre-migration)
export async function GET(_req: NextRequest) {
  try {
    const today = new Date();
    const in90Days = new Date(today);
    in90Days.setDate(today.getDate() + 90);

    const { data, error } = await supabase
      .from("contracts")
      .select(`
        id,
        title,
        mrr,
        end_date,
        assigned_rep,
        status,
        client_org:organizations!client_org_id(id, name),
        site:sites!site_id(id, name)
      `)
      .lte("end_date", in90Days.toISOString().slice(0, 10))
      .gte("end_date", today.toISOString().slice(0, 10))
      .in("status", ["active", "pending_signature"])
      .order("end_date", { ascending: true });

    // Table may not exist yet — return empty list gracefully
    if (error) {
      if (
        error.code === "42P01" ||
        error.message?.includes("does not exist")
      ) {
        return NextResponse.json({ renewals: [] });
      }
      throw error;
    }

    // Bucket each renewal by days remaining
    const renewals = (data ?? []).map((row) => {
      const endDate = new Date(row.end_date as string);
      const daysLeft = Math.ceil(
        (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      const bucket = daysLeft <= 30 ? "30" : daysLeft <= 60 ? "60" : "90";
      const renewalStatus =
        daysLeft <= 30 ? "action_needed" : "on_track";

      const clientName =
        (row.client_org as { name?: string } | null)?.name ??
        (row.site as { name?: string } | null)?.name ??
        null;

      return {
        id: row.id,
        title: row.title,
        mrr: row.mrr ?? 0,
        end_date: row.end_date,
        assigned_rep: row.assigned_rep,
        renewal_status: renewalStatus,
        bucket,
        client_name: clientName,
        site_name: (row.site as { name?: string } | null)?.name ?? null,
      };
    });

    return NextResponse.json({ renewals });
  } catch (err) {
    console.error("GET /api/renewals error:", err);
    return NextResponse.json({ renewals: [] });
  }
}
