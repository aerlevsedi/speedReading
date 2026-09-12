import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const { user } = context.locals;

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const formData = await context.request.formData();
  const exerciseType = formData.get("exercise_type") as string;

  if (!exerciseType) {
    return new Response(JSON.stringify({ error: "exercise_type is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const VALID_TYPES = ["animated_pacer", "smart_questions", "focus_sprint", "speed_scan"] as const;
  if (!(VALID_TYPES as readonly string[]).includes(exerciseType)) {
    return new Response(JSON.stringify({ error: "Invalid exercise_type" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = await supabase
    .from("user_intro_views")
    .upsert(
      { user_id: user.id, exercise_type: exerciseType, seen_at: new Date().toISOString() },
      { onConflict: "user_id,exercise_type" },
    );

  if (result.error) {
    return new Response(JSON.stringify({ error: "Failed to save intro view" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const prerender = false;
