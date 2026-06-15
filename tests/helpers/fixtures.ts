import { adminClient, anonClient, authClient } from "./supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export const SEEDED_EXERCISE_ID = "a0000000-0000-0000-0000-000000000001";

export async function createFixtureUser(email: string, password: string): Promise<{ id: string; jwt: string }> {
  const admin = adminClient();

  const createResult = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createResult.error) {
    throw new Error(`createFixtureUser: ${createResult.error.message}`);
  }

  const userId = createResult.data.user.id;

  const signInResult = await anonClient().auth.signInWithPassword({ email, password });

  if (signInResult.error) {
    throw new Error(`createFixtureUser signIn: ${signInResult.error.message}`);
  }

  const jwt = signInResult.data.session.access_token;
  return { id: userId, jwt };
}

export async function createFixtureCompletion(
  admin: SupabaseClient,
  userId: string,
  exerciseId: string = SEEDED_EXERCISE_ID,
): Promise<string> {
  const result = await admin
    .from("exercise_completions")
    .insert({
      user_id: userId,
      exercise_id: exerciseId,
      duration_seconds: 60,
      errors: 0,
      type_data: { wpm: 200 },
    })
    .select("id")
    .single();

  if (result.error) {
    throw new Error(`createFixtureCompletion: ${result.error.message}`);
  }

  return result.data.id as string;
}

export async function deleteFixtureUsers(admin: SupabaseClient, userIds: string[]): Promise<void> {
  const results = await Promise.allSettled(userIds.map((id) => admin.auth.admin.deleteUser(id)));
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.warn(`deleteFixtureUsers: failed to delete ${userIds[i]}: ${String(r.reason)}`);
    } else if (r.value.error) {
      console.warn(`deleteFixtureUsers: failed to delete ${userIds[i]}: ${r.value.error.message}`);
    }
  });
}
