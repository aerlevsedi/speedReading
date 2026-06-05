import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const { user } = context.locals;

  if (!user) {
    return context.redirect("/auth/signin?error=Authentication+required");
  }

  const formData = await context.request.formData();
  const exerciseId = formData.get("exercise_id") as string;
  const durationSeconds = parseInt(formData.get("duration_seconds") as string, 10);
  const errors = parseInt(formData.get("errors") as string, 10);

  if (!exerciseId || isNaN(durationSeconds) || isNaN(errors)) {
    return context.redirect("/dashboard?error=Invalid+completion+data");
  }

  const supabase = createClient(context.request.headers, context.cookies);

  // Fetch exercise to calculate WPM
  const exerciseResult = await supabase.from("exercises").select("content").eq("id", exerciseId).single();

  if (!exerciseResult.data) {
    return context.redirect("/dashboard?error=Exercise+not+found");
  }

  const wordCount = (exerciseResult.data.content as string).split(/\s+/).length;
  const wpm = durationSeconds > 0 ? Math.round(wordCount / (durationSeconds / 60)) : 0;

  // Insert completion
  const completionResult = await supabase
    .from("exercise_completions")
    .insert({
      user_id: user.id,
      exercise_id: exerciseId,
      duration_seconds: durationSeconds,
      errors,
      type_data: { wpm },
    })
    .select()
    .single();

  if (completionResult.error || !completionResult.data) {
    console.error("Failed to save completion:", completionResult.error);
    return context.redirect("/dashboard?error=Failed+to+save+completion");
  }

  return context.redirect(`/results/${(completionResult.data as { id: string }).id}`);
};

export const prerender = false;
