import type { SupabaseClient } from "@supabase/supabase-js";
import type { Exercise } from "@/types";

/**
 * Get the next exercise for a given exercise type based on user's completion history.
 * Implements dataset alternation: if user last completed dataset_1, return dataset_2, and vice versa.
 * Cold-start (no history) defaults to dataset_1.
 */
export async function getNextExerciseForType(
  supabase: SupabaseClient,
  userId: string,
  exerciseType: "animated_pacer" | "smart_questions" | "focus_sprint" | "speed_scan",
): Promise<Exercise | null> {
  // Step 1: Fetch user's last completion for this exercise type
  const historyResult = await supabase
    .from("exercise_completions")
    .select("exercise_id, exercises!inner(dataset_id)")
    .eq("user_id", userId)
    .eq("exercises.exercise_type", exerciseType)
    .order("completed_at", { ascending: false })
    .limit(1)
    .single();

  // Step 2: Determine which dataset to select
  let selectedDataset = "dataset_1"; // Cold-start default

  if (historyResult.data) {
    // Type assertion for exercises nested data
    const lastDataset = (historyResult.data.exercises as unknown as { dataset_id: string }).dataset_id;
    // Alternate between dataset_1 and dataset_2
    selectedDataset = lastDataset === "dataset_1" ? "dataset_2" : "dataset_1";
  }

  // Step 3: Fetch exercise with the selected dataset
  const exerciseResult = await supabase
    .from("exercises")
    .select("*")
    .eq("exercise_type", exerciseType)
    .eq("dataset_id", selectedDataset)
    .limit(1)
    .single();

  if (exerciseResult.error) {
    return null;
  }

  return exerciseResult.data as Exercise;
}
