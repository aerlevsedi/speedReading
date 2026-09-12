import type { SupabaseClient } from "@supabase/supabase-js";

export const VISIBLE_EXERCISE_TYPES = [
  "animated_pacer",
  "focus_sprint",
  "speed_scan",
  "peripheral_vision_grid",
] as const;

type ExerciseType = (typeof VISIBLE_EXERCISE_TYPES)[number];

/**
 * Returns the exercise type the user has completed least often (least-used wins;
 * tie or zero history → alphabetically first). Used to render the "Recommended"
 * badge on the dashboard. Falls back to "animated_pacer" on any DB error.
 *
 * RLS (completions_select_own) scopes rows to the caller; userId must be derived
 * from the authenticated session, never from client input.
 */
export async function getRecommendedExerciseType(supabase: SupabaseClient, userId: string): Promise<ExerciseType> {
  const result = await supabase
    .from("exercise_completions")
    .select("exercises!inner(exercise_type)")
    .eq("user_id", userId);

  if (result.error) {
    console.error("getRecommendedExerciseType error:", result.error);
    return "animated_pacer";
  }

  const counts = new Map<ExerciseType, number>(VISIBLE_EXERCISE_TYPES.map((t) => [t, 0]));

  interface Row {
    exercises: { exercise_type: string } | ({ exercise_type: string } | undefined)[];
  }
  for (const row of result.data as Row[]) {
    const ex = Array.isArray(row.exercises) ? row.exercises[0] : row.exercises;
    const type = ex?.exercise_type as ExerciseType | undefined;
    if (type && counts.has(type)) {
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
  }

  const minCount = Math.min(...counts.values());
  const candidates = VISIBLE_EXERCISE_TYPES.filter((t) => counts.get(t) === minCount);
  candidates.sort();

  return candidates[0];
}
