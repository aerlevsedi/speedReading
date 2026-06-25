import { adminClient, anonClient } from "./supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export const SEEDED_EXERCISE_ID = "a0000000-0000-0000-0000-000000000001";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

function isRetryableAuthError(error: { name?: string; status?: number } | null): boolean {
  if (!error) return false;
  if (error.name === "AuthRetryableFetchError") return true;
  if (error.status && error.status >= 500) return true;
  return false;
}

export async function createFixtureUser(email: string, password: string): Promise<{ id: string; jwt: string }> {
  const admin = adminClient();

  let lastCreateError: unknown = null;
  let userId = "";

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const result = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (!result.error) {
      userId = result.data.user.id;
      lastCreateError = null;
      break;
    }
    lastCreateError = result.error;
    if (!isRetryableAuthError(result.error) || attempt === MAX_RETRIES) break;
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  }

  if (lastCreateError) {
    throw new Error(`createFixtureUser: ${JSON.stringify(lastCreateError)}`);
  }

  let lastSignInError: unknown = null;
  let jwt = "";

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const result = await anonClient().auth.signInWithPassword({ email, password });
    if (!result.error) {
      jwt = result.data.session.access_token;
      lastSignInError = null;
      break;
    }
    lastSignInError = result.error;
    if (!isRetryableAuthError(result.error) || attempt === MAX_RETRIES) break;
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  }

  if (lastSignInError) {
    throw new Error(`createFixtureUser signIn: ${JSON.stringify(lastSignInError)}`);
  }

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
