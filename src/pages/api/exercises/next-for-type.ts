import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { getNextExerciseForType } from "@/lib/services/exerciseService";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const { user } = context.locals;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const type = context.url.searchParams.get("type");
  if (!type) {
    return new Response(JSON.stringify({ error: "Missing type parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Validate exercise type
  const validTypes = ["animated_pacer", "smart_questions", "focus_sprint", "speed_scan"];
  if (!validTypes.includes(type)) {
    return new Response(JSON.stringify({ error: "Invalid exercise type" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const exercise = await getNextExerciseForType(
    supabase,
    user.id,
    type as "animated_pacer" | "smart_questions" | "focus_sprint" | "speed_scan",
  );

  if (!exercise) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(exercise), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
