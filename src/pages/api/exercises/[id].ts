import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import type { Exercise } from "@/types";

// No auth guard — exercise content is publicly readable by design.
// The `exercises` table RLS policy uses USING (true), meaning all
// callers (authenticated or not) can SELECT exercise rows. This is
// intentional: exercise text/metadata is not user-private data.
// If exercise content ever becomes gated, update both this endpoint
// and the RLS policy in supabase/migrations/*.sql simultaneously.
export const GET: APIRoute = async (context) => {
  const id = context.params.id;
  if (!id) {
    return new Response(JSON.stringify({ error: "Missing exercise ID" }), { status: 400 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), { status: 500 });
  }

  const result = await supabase.from("exercises").select("*").eq("id", id).single();

  if (result.error || !result.data) {
    return new Response(JSON.stringify({ error: "Exercise not found" }), { status: 404 });
  }

  return new Response(JSON.stringify(result.data as Exercise), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const prerender = false; // SSR required (dynamic route)
