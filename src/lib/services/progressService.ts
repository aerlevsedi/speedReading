import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProgressPoint } from "@/types";

/**
 * Upper bound for a plausible reading speed. Focus Sprint WPM is derived from
 * word count / duration, so a stray too-fast completion (e.g. a 1-second click)
 * yields an absurd value; points above this ceiling are dropped so junk sessions
 * can't distort the progress trend.
 */
const MAX_PLAUSIBLE_WPM = 2000;

/**
 * Get the authenticated user's Focus Sprint WPM series in chronological order
 * (oldest → newest), so the last element is the most recent session.
 *
 * Only Focus Sprint completions are included: it is the only exercise type whose
 * WPM reflects the user's own reading pace (Animated Pacer WPM is pacer-imposed,
 * Speed Scan has no WPM). Powers the progress chart (S-05, FR-014).
 *
 * RLS (completions_select_own) scopes rows to the caller; `userId` must be derived
 * from the authenticated session, never from client input.
 */
export async function getFocusSprintProgress(supabase: SupabaseClient, userId: string): Promise<ProgressPoint[]> {
  const result = await supabase
    .from("exercise_completions")
    .select("type_data, completed_at, exercises!inner(exercise_type)")
    .eq("user_id", userId)
    .eq("exercises.exercise_type", "focus_sprint")
    .order("completed_at", { ascending: true });

  if (result.error) {
    return [];
  }

  return (result.data as { type_data: { wpm?: number } | null; completed_at: string }[])
    .map((row) => ({
      completedAt: row.completed_at,
      wpm: row.type_data?.wpm ?? NaN,
    }))
    .filter(
      (point): point is ProgressPoint => Number.isFinite(point.wpm) && point.wpm > 0 && point.wpm <= MAX_PLAUSIBLE_WPM,
    );
}
