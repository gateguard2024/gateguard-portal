import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/training/reset-attempts
// Resets quiz attempt records for a user so they can retake failed exams.
// Body: { user_id: string, course_id?: string }
// If course_id is omitted, resets ALL quiz chapters for the user.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, course_id } = body;

    if (!user_id) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }

    // Quiz chapter IDs follow the pattern: `${course_id}_quiz`
    // We delete those rows from training_progress so the user starts fresh.
    let query = supabase
      .from("training_progress")
      .delete()
      .eq("user_id", user_id)
      .like("chapter_id", "%_quiz");

    if (course_id) {
      query = query.eq("course_id", course_id);
    }

    const { error } = await query;

    if (error) {
      if (
        error.code === "42P01" ||
        error.message?.includes("does not exist")
      ) {
        // Table not yet migrated — treat as no-op success
        return NextResponse.json({ success: true, reset: 0 });
      }
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/training/reset-attempts error:", err);
    return NextResponse.json(
      { error: "Failed to reset attempts" },
      { status: 500 }
    );
  }
}
