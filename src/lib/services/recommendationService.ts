import type { SupabaseClient } from "@supabase/supabase-js";

const VISIBLE_EXERCISE_TYPES = ["animated_pacer", "focus_sprint", "speed_scan"] as const;

type ExerciseType = (typeof VISIBLE_EXERCISE_TYPES)[number];

export async function getRecommendedExerciseType(supabase: SupabaseClient, userId: string): Promise<ExerciseType> {
  const result = await supabase
    .from("exercise_completions")
    .select("exercises!inner(exercise_type)")
    .eq("user_id", userId)
    .in("exercises.exercise_type", VISIBLE_EXERCISE_TYPES);

  if (result.error) {
    return "animated_pacer";
  }

  const counts = new Map<ExerciseType, number>(VISIBLE_EXERCISE_TYPES.map((t) => [t, 0]));

  for (const row of result.data as { exercises: { exercise_type: string } }[]) {
    const type = row.exercises.exercise_type as ExerciseType;
    if (counts.has(type)) {
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
  }

  const minCount = Math.min(...counts.values());
  const candidates = VISIBLE_EXERCISE_TYPES.filter((t) => counts.get(t) === minCount);
  candidates.sort();

  return candidates[0];
}
