// JSON contract — consumed via fetch() from GoalWidget; not a form-submit/redirect endpoint
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
  const raw = formData.get("target_wpm") as string;
  const wpm = parseInt(raw, 10);

  if (isNaN(wpm) || wpm < 50 || wpm > 1000) {
    return new Response(JSON.stringify({ error: "target_wpm must be between 50 and 1000" }), {
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
    .from("user_goals")
    .upsert({ user_id: user.id, target_wpm: wpm, updated_at: new Date().toISOString() }, { onConflict: "user_id" });

  if (result.error) {
    return new Response(JSON.stringify({ error: "Failed to save goal" }), {
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
